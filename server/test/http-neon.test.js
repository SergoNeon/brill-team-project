import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Pool} from 'pg';
import {hashPassword} from '../src/auth.js';

// Run against a dedicated, disposable Neon test database only.
// DATABASE_URL and ADMIN_TEST_PASSWORD must be injected securely by CI.
test('HTTP inquiry write, admin login, inbox read and logout', {skip:!process.env.DATABASE_URL||!process.env.ADMIN_TEST_PASSWORD?'Set DATABASE_URL and ADMIN_TEST_PASSWORD':''},async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true}});
 const user='e2e_'+crypto.randomUUID().replaceAll('-','').slice(0,16);
 const email='e2e-'+crypto.randomUUID()+'@example.invalid';
 const origin='http://localhost:43789';
 const id=crypto.randomUUID();
 let server;
 const qaGuard=await pool.query("SELECT marker FROM public.qa_test_guard WHERE marker='brill-team-isolated-qa-20261021'");
 assert.equal(qaGuard.rowCount,1,'Refusing to run integration test without isolated QA marker');
 try{
  await pool.query('INSERT INTO admin_users(id,username,password_hash) VALUES($1,$2,$3)',[id,user,hashPassword(process.env.ADMIN_TEST_PASSWORD)]);
  const {spawn}=await import('node:child_process');
  server=spawn(process.execPath,['src/server.js'],{cwd:new URL('../',import.meta.url).pathname,env:{...process.env,PORT:'43789',PUBLIC_ORIGIN:origin},stdio:['ignore','pipe','pipe']});
  let ready=false;
  for(let i=0;i<50;i++){if(server.exitCode!==null)break;try{const r=await fetch(origin+'/health');if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
  assert.ok(ready,'API did not start');
  const request=await fetch(origin+'/api/inquiries',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Integration Test',email,message:'Real HTTP end-to-end persistence test',website:''})});
  assert.equal(request.status,201,await request.text());
  const created=await request.json();
  assert.match(created.chat_token,/^[A-Za-z0-9_-]{43}$/);
  const persisted=await pool.query('SELECT id,message FROM inquiries WHERE email=$1',[email]);assert.equal(persisted.rowCount,1);
  const inquiryId=created.inquiry_id;
  const clientUrl=origin+'/api/client/inquiries/'+inquiryId+'/chat';
  const clientHeaders={'x-brill-chat-token':created.chat_token};
  const anonymous=await fetch(clientUrl);assert.equal(anonymous.status,401);
  const wrongToken=await fetch(clientUrl,{headers:{'x-brill-chat-token':crypto.randomBytes(32).toString('base64url')}});
  assert.equal(wrongToken.status,403);
  const clientSend=await fetch(clientUrl,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...clientHeaders},body:JSON.stringify({message:'QA client message'})});
  assert.equal(clientSend.status,201,await clientSend.text());
  const firstRead=await fetch(clientUrl,{headers:clientHeaders});assert.equal(firstRead.status,200);
  assert.ok((await firstRead.json()).items.some(m=>m.sender_kind==='client'&&m.message==='QA client message'));
  const denied=await fetch(origin+'/api/admin/inquiries');assert.equal(denied.status,401);
  const login=await fetch(origin+'/api/admin/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:user,password:process.env.ADMIN_TEST_PASSWORD})});
  assert.equal(login.status,200,await login.text());
  const cookie=login.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);
  const inbox=await fetch(origin+'/api/admin/inquiries',{headers:{Cookie:cookie.split(';')[0]}});assert.equal(inbox.status,200);
  const data=await inbox.json();assert.ok(data.items.some(x=>x.email===email));
  const employeeUrl=origin+'/api/admin/inquiries/'+inquiryId+'/chat';
  const employeeSend=await fetch(employeeUrl,{method:'POST',headers:{Origin:origin,Cookie:cookie.split(';')[0],'x-brill-csrf':'1','Content-Type':'application/json'},body:JSON.stringify({message:'QA employee reply'})});
  assert.equal(employeeSend.status,201,await employeeSend.text());
  const employeeRead=await fetch(employeeUrl,{headers:{Cookie:cookie.split(';')[0]}});
  assert.equal(employeeRead.status,200);
  assert.ok((await employeeRead.json()).items.some(m=>m.sender_kind==='employee'&&m.message==='QA employee reply'));
  const reopened=await fetch(clientUrl,{headers:clientHeaders});
  assert.equal(reopened.status,200);
  const history=(await reopened.json()).items;
  assert.ok(history.some(m=>m.sender_kind==='client'&&m.message==='QA client message'));
  assert.ok(history.some(m=>m.sender_kind==='employee'&&m.message==='QA employee reply'));
  const foreignInquiry=crypto.randomUUID();
  await pool.query('INSERT INTO inquiries(id,name,email,message) VALUES($1,$2,$3,$4)',[foreignInquiry,'QA second client','second-'+email,'Separate client access check']);
  const foreignToken=crypto.randomBytes(32).toString('base64url');
  await pool.query('INSERT INTO inquiry_client_access(inquiry_id,token_hash) VALUES($1,$2)',[foreignInquiry,crypto.createHash('sha256').update(foreignToken).digest('hex')]);
  const crossAccess=await fetch(clientUrl,{headers:{'x-brill-chat-token':foreignToken}});
  assert.equal(crossAccess.status,403,'Second client must not read first client chat');
  const reverseAccess=await fetch(origin+'/api/client/inquiries/'+foreignInquiry+'/chat',{headers:clientHeaders});
  assert.equal(reverseAccess.status,403,'First client must not read second client chat');
  const logout=await fetch(origin+'/api/admin/logout',{method:'POST',headers:{Origin:origin,Cookie:cookie.split(';')[0]}});assert.equal(logout.status,200);
  const deniedAgain=await fetch(origin+'/api/admin/inquiries',{headers:{Cookie:cookie.split(';')[0]}});assert.equal(deniedAgain.status,401);
 }finally{
  if(server){server.kill('SIGTERM');await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);setTimeout(resolve,2000)})}
  await pool.query('DELETE FROM inquiries WHERE email=$1 OR email=$2',[email,'second-'+email]);
  await pool.query('DELETE FROM admin_users WHERE id=$1',[id]);
  await pool.end();
 }
});
