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
 try{
  await pool.query('INSERT INTO admin_users(id,username,password_hash) VALUES($1,$2,$3)',[id,user,hashPassword(process.env.ADMIN_TEST_PASSWORD)]);
  const {spawn}=await import('node:child_process');
  server=spawn(process.execPath,['src/server.js'],{cwd:new URL('../',import.meta.url).pathname,env:{...process.env,PORT:'43789',PUBLIC_ORIGIN:origin},stdio:['ignore','pipe','pipe']});
  let ready=false;
  for(let i=0;i<50;i++){if(server.exitCode!==null)break;try{const r=await fetch(origin+'/health');if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
  assert.ok(ready,'API did not start');
  const request=await fetch(origin+'/api/inquiries',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Integration Test',email,message:'Real HTTP end-to-end persistence test',website:''})});
  assert.equal(request.status,201,await request.text());
  const persisted=await pool.query('SELECT id,message FROM inquiries WHERE email=$1',[email]);assert.equal(persisted.rowCount,1);
  const denied=await fetch(origin+'/api/admin/inquiries');assert.equal(denied.status,401);
  const login=await fetch(origin+'/api/admin/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:user,password:process.env.ADMIN_TEST_PASSWORD})});
  assert.equal(login.status,200,await login.text());
  const cookie=login.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);
  const inbox=await fetch(origin+'/api/admin/inquiries',{headers:{Cookie:cookie.split(';')[0]}});assert.equal(inbox.status,200);
  const data=await inbox.json();assert.ok(data.items.some(x=>x.email===email));
  const logout=await fetch(origin+'/api/admin/logout',{method:'POST',headers:{Origin:origin,Cookie:cookie.split(';')[0]}});assert.equal(logout.status,200);
  const deniedAgain=await fetch(origin+'/api/admin/inquiries',{headers:{Cookie:cookie.split(';')[0]}});assert.equal(deniedAgain.status,401);
 }finally{
  if(server){server.kill('SIGTERM');await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);setTimeout(resolve,2000)})}
  await pool.query('DELETE FROM inquiries WHERE email=$1',[email]);
  await pool.query('DELETE FROM admin_users WHERE id=$1',[id]);
  await pool.end();
 }
});
