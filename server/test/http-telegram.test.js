import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import {once} from 'node:events';
import {Pool} from 'pg';

// Exercise the real HTTP routes. PostgreSQL and Telegram are isolated test doubles;
// no production records or real Telegram messages are used.
test('Telegram webhook and client chat HTTP regression', async t => {
 const savedEnv={...process.env};
 const nativeFetch=globalThis.fetch,createServer=http.createServer;
 const originalQuery=Pool.prototype.query,originalConnect=Pool.prototype.connect;
 const owner='123456789',group='-100123456789';
 const actorId=crypto.randomUUID(),secret='test secret + / = with spaces';
 const digest=crypto.createHash('sha256').update(secret).digest('hex');
 const inquiries=new Map(),access=new Map(),messages=[],telegram=[];
 let server,failDatabase=false;
 Object.assign(process.env,{DATABASE_URL:'postgres://unused:unused@127.0.0.1:1/unused',PUBLIC_ORIGIN:'https://brill.test',HOST:'127.0.0.1',PORT:'0',TELEGRAM_BOT_TOKEN:'isolated-test-token',TELEGRAM_CHAT_ID:group,TELEGRAM_WEBHOOK_SECRET:secret,TELEGRAM_OWNER_USER_ID:owner,TELEGRAM_OWNER_CRM_USERNAME:'test-owner'});
 delete process.env.VAPID_PUBLIC_KEY;
 delete process.env.VAPID_PRIVATE_KEY;
 delete process.env.VAPID_SUBJECT;
 Pool.prototype.query=async function(sql,args=[]){
  if(failDatabase)throw Object.assign(new Error('Isolated database unavailable'),{code:'ECONNREFUSED'});
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {rowCount:0,rows:[]};
  if(sql.startsWith('SELECT id FROM admin_users'))return {rowCount:args[0]==='test-owner'?1:0,rows:[{id:actorId}]};
  if(sql.startsWith('INSERT INTO inquiries ')){inquiries.set(args[0],{id:args[0]});return {rowCount:1,rows:[]};}
  if(sql.startsWith('INSERT INTO inquiry_client_access')){access.set(args[0],args[1]);return {rowCount:1,rows:[]};}
  if(sql.startsWith('SELECT 1 FROM inquiry_client_access'))return {rowCount:access.get(args[0])===args[1]?1:0,rows:[]};
  if(sql.startsWith('INSERT INTO inquiry_chat_messages')){
   if(!inquiries.has(args[1]))return {rowCount:0,rows:[]};
   const employee=sql.includes("'employee'");
   const row={id:args[0],inquiry_id:args[1],sender_kind:employee?'employee':'client',sender_id:employee?args[2]:null,message:employee?args[3]:args[2],created_at:new Date().toISOString()};
   messages.push(row);return {rowCount:1,rows:[row]};
  }
  if(sql.startsWith('SELECT id,sender_kind,message,created_at FROM'))return {rowCount:messages.length,rows:messages.filter(m=>m.inquiry_id===args[0])};
  assert.fail('Unexpected database query: '+sql);
 };
 Pool.prototype.connect=async function(){return {query:this.query.bind(this),release(){}};};
 globalThis.fetch=async (url,options)=>{
  assert.ok(String(url).startsWith('https://api.telegram.org/'),'Unexpected outbound request');
  telegram.push({method:String(url).split('/').at(-1),body:JSON.parse(options.body)});
  return new Response(JSON.stringify({ok:true,result:true}),{status:200,headers:{'content-type':'application/json'}});
 };
 http.createServer=(...args)=>{server=createServer(...args);return server;};
 t.after(async()=>{
  http.createServer=createServer;
  if(server?.listening)await new Promise(resolve=>server.close(resolve));
  globalThis.fetch=nativeFetch;
  Pool.prototype.query=originalQuery;Pool.prototype.connect=originalConnect;
  for(const key of Object.keys(process.env))if(!(key in savedEnv))delete process.env[key];
  Object.assign(process.env,savedEnv);
 });
 await import('../src/server.js');
 http.createServer=createServer;
 if(!server.listening)await once(server,'listening');
 const origin='http://127.0.0.1:'+server.address().port;
 const request=(path,options={})=>nativeFetch(origin+path,{...options,signal:AbortSignal.timeout(3000)});
 const webhook=(text,from=owner,chat=owner,type='private',header=digest)=>request('/api/telegram/webhook',{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':header},body:JSON.stringify({message:{text,from:{id:from},chat:{id:chat,type}}})});
 let inquiryId,chatToken;

 await t.test('registers an allowed secret and retains pending updates',()=>{
  const call=telegram.find(c=>c.method==='setWebhook');
  assert.ok(call);assert.equal(call.body.secret_token,digest);
  assert.match(call.body.secret_token,/^[A-Za-z0-9_-]{1,256}$/);
  assert.equal(call.body.drop_pending_updates,false);
 });
 await t.test('rejects missing, incorrect and non-ASCII secrets',async()=>{
  const missing=await request('/api/telegram/webhook',{method:'POST',body:'{}'});assert.equal(missing.status,403);
  assert.equal((await webhook('/start',owner,owner,'private','x'.repeat(64))).status,403);
  assert.equal((await webhook('/start',owner,owner,'private','é'.repeat(64))).status,403);
 });
 await t.test('creates a client inquiry and formats the owner notification',async()=>{
  const response=await request('/api/inquiries',{method:'POST',headers:{Origin:'https://brill.test','content-type':'application/json'},body:JSON.stringify({name:'Isolated QA',email:'telegram-test@example.invalid',message:'Isolated Telegram chat regression',website:''})});
  assert.equal(response.status,201);const created=await response.json();
  inquiryId=created.inquiry_id;chatToken=created.chat_token;
  const notice=telegram.find(c=>c.method==='sendMessage'&&c.body.text.includes(inquiryId));
  assert.ok(notice);assert.equal(notice.body.chat_id,owner);
  assert.ok(notice.body.text.includes('\nНомер: '));
  assert.ok(!notice.body.text.includes('\\n'));
 });
 await t.test('stores a client message and restricts access to its history',async()=>{
  const path='/api/client/inquiries/'+inquiryId+'/chat';
  assert.equal((await request(path)).status,401);
  const sent=await request(path,{method:'POST',headers:{Origin:'https://brill.test','content-type':'application/json','x-brill-chat-token':chatToken},body:JSON.stringify({message:'Сообщение клиента'})});
  assert.equal(sent.status,201);
  assert.ok(telegram.some(c=>c.method==='sendMessage'&&c.body.text.includes('\nОбращение: '+inquiryId)));
 });
 await t.test('accepts owner replies, bot mentions and multilingual multiline text',async()=>{
  for(const [command,text] of [['/reply','Ответ клиенту'],['/reply@brillteamprojectbot','שלום\nClient reply']]){
   const response=await webhook(command+' '+inquiryId+' '+text);assert.equal(response.status,200);
   assert.ok(messages.some(m=>m.inquiry_id===inquiryId&&m.sender_kind==='employee'&&m.sender_id===actorId&&m.message===text));
  }
  const reopened=await request('/api/client/inquiries/'+inquiryId+'/chat',{headers:{'x-brill-chat-token':chatToken}});
  assert.equal(reopened.status,200);const history=(await reopened.json()).items;
  assert.deepEqual(history.map(m=>m.sender_kind),['client','employee','employee']);
 });
 await t.test('does not save replies from another user, the group or invalid commands',async()=>{
  const count=messages.length;
  for(const args of [
   ['/reply '+inquiryId+' чужой ответ','222222222','222222222'],
   ['/reply '+inquiryId+' group reply',owner,group,'supergroup'],
   ['/reply '+inquiryId+' spoofed sender','222222222',owner],
   ['/reply '+'-'.repeat(36)+' invalid id'],
   ['/reply '+inquiryId+'   '],
   ['/reply '+inquiryId+' '+'a'.repeat(2001)]
  ])assert.equal((await webhook(...args)).status,200);
  assert.equal(messages.length,count);
 });
 await t.test('returns controlled errors for malformed updates and remains healthy after a database error',async()=>{
  const malformed=await request('/api/telegram/webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':digest},body:'{'});assert.equal(malformed.status,400);
  failDatabase=true;
  assert.equal((await webhook('/reply '+inquiryId+' retry later')).status,500);
  failDatabase=false;
  assert.equal((await request('/health')).status,200);
 });
});
