import http from 'node:http';
import {publicPushKey,isVisitPayload,visitLimiter,notifyVisit,validSubscription} from './visit-notifications.js';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
const adminHtml=readFileSync(new URL('./admin.html',import.meta.url),'utf8');
const activationHtml=readFileSync(new URL('./activate.html',import.meta.url),'utf8');
import { Pool } from 'pg';
import { hashPassword, verifyPassword, createSessionToken, tokenDigest, parseCookie, secureSessionCookie } from './auth.js';

const required=['DATABASE_URL','PUBLIC_ORIGIN'];
for(const k of required) if(!process.env[k]) throw new Error('Missing required environment variable: '+k);

const origins=new Set(process.env.PUBLIC_ORIGIN.split(',').map(value=>new URL(value.trim()).origin));
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:true},max:5});
const buckets=new Map();
const telegramToken=process.env.TELEGRAM_BOT_TOKEN||'';
const telegramChatId=process.env.TELEGRAM_CHAT_ID||'';
const telegramWebhookSecret=process.env.TELEGRAM_WEBHOOK_SECRET||'';
const telegramEnabled=Boolean(telegramToken&&telegramChatId&&telegramWebhookSecret);
const telegramOwnerUserId=process.env.TELEGRAM_OWNER_USER_ID||'';
const telegramOwnerCrmUsername=process.env.TELEGRAM_OWNER_CRM_USERNAME||'';
async function telegramSend(chatId,message){
 if(!telegramEnabled)return false;
 try{
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),7000);
  try{
   const response=await fetch('https://api.telegram.org/bot'+telegramToken+'/sendMessage',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({chat_id:chatId,text:message,disable_web_page_preview:true}),
    signal:controller.signal
   });
   if(!response.ok)console.error('Telegram send failed:',response.status);
   return response.ok;
  }finally{clearTimeout(timeout)}
 }catch(error){console.error('Telegram send unavailable:',error.name);return false}
}
function telegramNotice(message){if(telegramEnabled&&telegramOwnerUserId)void telegramSend(telegramOwnerUserId,message)}
async function registerTelegramWebhook(){
 if(!telegramToken||!telegramWebhookSecret){console.log('Telegram webhook inactive: token or secret missing');return}
 const webhookUrl='https://brill-team-project-api.onrender.com/api/telegram/webhook';
 try{
  const response=await fetch('https://api.telegram.org/bot'+telegramToken+'/setWebhook',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({url:webhookUrl,secret_token:telegramWebhookSecret,allowed_updates:['message'],drop_pending_updates:false}),
   signal:AbortSignal.timeout(10000)
  });
  const result=await response.json();
  if(response.ok&&result.ok)console.log('Telegram webhook registered');
  else console.error('Telegram webhook registration failed:',response.status,String(result.description||'').slice(0,150));
 }catch(error){console.error('Telegram webhook registration unavailable:',error.name)}
}


const allowVisit=visitLimiter();
const MAX_BODY=16*1024;
function json(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data))}
function fail(res,status,error){json(res,status,{error})}
async function auth(req){const token=parseCookie(req.headers.cookie,'brill_session');if(!/^[A-Za-z0-9_-]{43}$/.test(token))return false;const q=await pool.query('SELECT 1 FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true',[tokenDigest(token)]);return q.rowCount>0}
function rateLimit(ip){const now=Date.now();if(buckets.size>10000){for(const [k,v] of buckets)if(now-v.start>3600000)buckets.delete(k)}const v=buckets.get(ip)||{start:now,count:0};if(now-v.start>3600000){v.start=now;v.count=0}v.count++;buckets.set(ip,v);return v.count<=5}
async function body(req){let chunks=[],size=0;for await(const c of req){size+=c.length;if(size>MAX_BODY)throw Object.assign(new Error('Payload too large'),{status:413});chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Object.assign(new Error('Invalid JSON'),{status:400})}}
function text(v,max){return typeof v==='string'?v.trim().slice(0,max+1):''}
function validLang(v){return ['ru','he','en'].includes(v)}
function validOrigin(req){const requestOrigin=req.headers.origin;const renderOrigin=process.env.ADMIN_ORIGIN;return origins.has(requestOrigin)||(req.url?.startsWith('/api/admin/')&&renderOrigin&&requestOrigin===renderOrigin)}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(origins.has(req.headers.origin)){res.setHeader('access-control-allow-origin',req.headers.origin);res.setHeader('vary','Origin');res.setHeader('access-control-allow-credentials','true');res.setHeader('access-control-allow-headers','content-type,x-brill-csrf,x-brill-chat-token');res.setHeader('access-control-allow-methods','GET,POST,PUT,PATCH,DELETE,OPTIONS')}
 if(['/api/news','/api/catalog'].includes(url.pathname)&&req.method==='GET'){const origin=req.headers.origin;if(origins.has(origin)){res.setHeader('access-control-allow-origin',origin);res.setHeader('vary','Origin')}}
 if(req.method==='OPTIONS'){res.writeHead(validOrigin(req)?204:403);res.end();return}
 if(url.pathname==='/admin'&&req.method==='GET'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; worker-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(adminHtml);return}
 if(url.pathname==='/admin/activate'&&req.method==='GET'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; worker-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(activationHtml);return}
 if(url.pathname==='/admin/push-worker.js'&&req.method==='GET'){res.writeHead(200,{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store','service-worker-allowed':'/admin/','x-content-type-options':'nosniff'});res.end("self.addEventListener('push',event=>{const d=event.data?.json()||{};event.waitUntil(self.registration.showNotification(d.title||'BRILL TEAM',{body:d.body||'',tag:d.tag||'visit',data:{url:'/admin'}}))});self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.openWindow('/admin'))});");return}
 if(url.pathname==='/health'&&req.method==='GET'){json(res,200,{ok:true});return}
 if(url.pathname==='/api/telegram/webhook'&&req.method==='POST'){
  if(!telegramEnabled){fail(res,503,'Telegram not configured');return}
  const supplied=req.headers['x-telegram-bot-api-secret-token'];
  if(typeof supplied!=='string'||supplied.length!==telegramWebhookSecret.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(telegramWebhookSecret))){fail(res,403,'Forbidden');return}
  const update=await body(req);
  const msg=update?.message;
  if(msg?.text&&msg.chat?.type==='private'&&String(msg.chat?.id)===telegramOwnerUserId&&String(msg.from?.id)===telegramOwnerUserId&&telegramOwnerUserId&&telegramOwnerCrmUsername){
   const actor=await pool.query('SELECT id FROM admin_users WHERE username=$1 AND active=true',[telegramOwnerCrmUsername]);
   if(actor.rowCount){
    const match=msg.text.match(/^[/]reply(?:@\\w+)?\\s+([a-f0-9-]{36})\\s+([\\s\\S]{1,2000})$/i);
    if(match){
     const inquiryId=match[1].toLowerCase(),reply=match[2].trim();
     if(reply){
      const q=await pool.query("INSERT INTO inquiry_chat_messages(id,inquiry_id,sender_kind,sender_id,message) SELECT $1,id,'employee',$3,$4 FROM inquiries WHERE id=$2 RETURNING id",[crypto.randomUUID(),inquiryId,actor.rows[0].id,reply]);
      await telegramSend(telegramOwnerUserId,q.rowCount?'Ответ клиенту сохранён в CRM.':'Обращение не найдено.');
     }
    }else if(msg.text==='/start')await telegramSend(telegramOwnerUserId,'BRILL TEAM CRM подключена. Ответ: /reply UUID текст');
   }
  }
  if(msg?.text&&msg.chat?.type==='private'&&String(msg.chat?.id)!==telegramOwnerUserId){
   const command=msg.text.trim().split(/\s+/)[0].toLowerCase().split('@')[0];
   const answers={
    '/start':'Здравствуйте! BRILL TEAM PROJECT. Услуги: /services. Оставить заявку: /request. Поддержка: /support. Не отправляйте пароли или платёжные данные.',
    '/help':'Команды: /services, /request, /support. Личные заявки оформляются на сайте BRILL TEAM.',
    '/services':'Разработка сайтов, CRM и цифровых решений: https://brillteamp.com/',
    '/request':'Для защищённой заявки и личного чата откройте https://brillteamp.com/',
    '/support':'Поддержка и личные обращения: https://brillteamp.com/',
    '/status':'Статус обращения доступен через приватную ссылку, выданную после оформления заявки на сайте.'
   };
   if(answers[command])await telegramSend(msg.chat.id,answers[command]);
  }
  if(msg?.text&&msg.chat?.type!=='private'&&String(msg.chat?.id)===telegramChatId){
   const command=msg.text.trim().split(/\s+/)[0].toLowerCase().split('@')[0];
   if(command==='/start'||command==='/help'||command==='/services'||command==='/support'||command==='/request'){
    const message=command==='/services'?'BRILL TEAM PROJECT: разработка сайтов, CRM и цифровых решений. Подробнее: https://brillteamp.com/':command==='/request'||command==='/support'?'Для личного обращения напишите боту в приватном чате: https://t.me/brillteamprojectbot':'Добро пожаловать в BRILL TEAM PROJECT! Услуги: /services. Обращение: /request. Поддержка: /support. Не публикуйте личные данные в группе.';
    await telegramSend(msg.chat.id,message);
   }
  }
  json(res,200,{ok:true});return
 }

 if(!url.pathname.startsWith('/api/')){fail(res,404,'Not found');return}
 if(req.method!=='GET'&&!validOrigin(req)){fail(res,403,'Origin not allowed');return}
 try{
  if(url.pathname==='/api/visits'&&req.method==='POST'){
   const data=await body(req);
   if(!isVisitPayload(data)){fail(res,400,'Invalid visit');return}
   const ip=req.socket.remoteAddress||'unknown';
   const key=crypto.createHash('sha256').update(ip+'|'+(req.headers['user-agent']||'').slice(0,200)+'|'+data.path).digest('hex');
   if(allowVisit(key))void notifyVisit(pool,{path:data.path,referrer:data.referrer}).catch(e=>console.error('Visit notification failed:',e.message));
   json(res,202,{ok:true});return
  }
  if(url.pathname==='/api/inquiries'&&req.method==='POST'){
   const ip=req.socket.remoteAddress||'unknown';if(!rateLimit(ip)){fail(res,429,'Too many requests');return}
   const data=await body(req);if(data.website){json(res,202,{ok:true});return}
   const name=text(data.name,120),email=text(data.email,254),message=text(data.message,5000);
   if(!name||name.length>120||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||message.length<10||message.length>5000){fail(res,400,'Invalid fields');return}
   const inquiryId=crypto.randomUUID(),accessToken=crypto.randomBytes(32).toString('base64url'),accessHash=crypto.createHash('sha256').update(accessToken).digest('hex');
   const client=await pool.connect();try{await client.query('BEGIN');await client.query('INSERT INTO inquiries (id,name,email,message) VALUES ($1,$2,$3,$4)',[inquiryId,name,email,message]);await client.query('INSERT INTO inquiry_client_access(inquiry_id,token_hash) VALUES($1,$2)',[inquiryId,accessHash]);await client.query('COMMIT')}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
   telegramNotice('Новое обращение BRILL TEAM\\nНомер: '+inquiryId+'\\nИмя: '+name+'\\nСообщение: '+message.slice(0,700)+'\\nОтвет: /reply '+inquiryId+' текст');
   json(res,201,{ok:true,inquiry_id:inquiryId,chat_token:accessToken});return
  }
  if(/^\/api\/client\/inquiries\/[a-f0-9-]{36}\/chat$/.test(url.pathname)&&['GET','POST'].includes(req.method)){
   const inquiryId=url.pathname.split('/')[4],token=req.headers['x-brill-chat-token'];
   if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token)){fail(res,401,'Invalid chat access');return}
   const hash=crypto.createHash('sha256').update(token).digest('hex');
   const allowed=await pool.query('SELECT 1 FROM inquiry_client_access WHERE inquiry_id=$1 AND token_hash=$2',[inquiryId,hash]);
   if(!allowed.rowCount){fail(res,403,'Chat access denied');return}
   if(req.method==='GET'){const q=await pool.query("SELECT id,sender_kind,message,created_at FROM (SELECT id,sender_kind,message,created_at FROM inquiry_chat_messages WHERE inquiry_id=$1 ORDER BY created_at DESC,id DESC LIMIT 200) latest ORDER BY created_at,id",[inquiryId]);json(res,200,{items:q.rows});return}
   if(!rateLimit('chat:'+inquiryId+':'+(req.socket.remoteAddress||'unknown'))){fail(res,429,'Too many messages');return}
   const data=await body(req),message=text(data.message,2000);
   if(!message||message.length>2000){fail(res,400,'Invalid message');return}
   const q=await pool.query("INSERT INTO inquiry_chat_messages(id,inquiry_id,sender_kind,message) VALUES($1,$2,'client',$3) RETURNING id,created_at",[crypto.randomUUID(),inquiryId,message]);
   telegramNotice('Сообщение клиента\\nОбращение: '+inquiryId+'\\n'+message.slice(0,700)+'\\nОтвет: /reply '+inquiryId+' текст');
   json(res,201,{ok:true,...q.rows[0]});return
  }
  if(url.pathname==='/api/content'&&req.method==='GET'){
   const lang=url.searchParams.get('lang')||'ru';if(!validLang(lang)){fail(res,400,'Invalid language');return}
   const q=await pool.query('SELECT key,value FROM content_entries WHERE lang=$1',[lang]);json(res,200,{items:Object.fromEntries(q.rows.map(r=>[r.key,r.value]))});return
  }
  if(url.pathname==='/api/news'&&req.method==='GET'){
   const lang=url.searchParams.get('lang')||'ru';if(!validLang(lang)){fail(res,400,'Invalid language');return}
   const q=await pool.query('SELECT p.id,p.slug,p.created_at,t.title,t.body FROM news_posts p JOIN news_translations t ON t.post_id=p.id AND t.lang=$1 WHERE p.published=true ORDER BY p.created_at DESC LIMIT 30',[lang]);json(res,200,{items:q.rows});return
  }
  if(url.pathname==='/api/catalog'&&req.method==='GET'){
   const lang=url.searchParams.get('lang')||'ru',kind=url.searchParams.get('kind');
   if(!validLang(lang)||!['project','service'].includes(kind)){fail(res,400,'Invalid filters');return}
   const q=await pool.query('SELECT e.id,e.kind,e.slug,e.created_at,t.title,t.description FROM catalog_entries e JOIN catalog_translations t ON t.entry_id=e.id AND t.lang=$1 WHERE e.published=true AND e.kind=$2 ORDER BY e.sort_order ASC,e.created_at DESC LIMIT 100',[lang,kind]);
   json(res,200,{items:q.rows});return
  }
  if(url.pathname==='/api/admin/activate'&&req.method==='POST'){
   const d=await body(req),token=d.token,password=d.password;
   if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token)||typeof password!=='string'||password.length<12||password.length>256){fail(res,400,'Invalid activation details');return}
   if(!rateLimit('activate:'+(req.socket.remoteAddress||'unknown'))){fail(res,429,'Too many attempts');return}
   const client=await pool.connect();
   try{
    await client.query('BEGIN');
    const q=await client.query('SELECT email FROM admin_invites WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE',[tokenDigest(token)]);
    if(!q.rowCount){await client.query('ROLLBACK');fail(res,400,'Invalid or expired activation link');return}
    const email=q.rows[0].email;
    const exists=await client.query('SELECT 1 FROM admin_users WHERE username=$1',[email]);
    if(exists.rowCount){await client.query('ROLLBACK');fail(res,409,'Account already exists');return}
    await client.query('INSERT INTO admin_users(id,username,password_hash) VALUES($1,$2,$3)',[crypto.randomUUID(),email,hashPassword(password)]);
    await client.query('UPDATE admin_invites SET used_at=now() WHERE token_hash=$1',[tokenDigest(token)]);
    await client.query('COMMIT');
    json(res,201,{ok:true});
   }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}return
  }
  if(url.pathname==='/api/admin/login'&&req.method==='POST'){
   const d=await body(req);const username=text(d.username,80),password=d.password;
   if(!username||username.length>80||typeof password!=='string'||password.length>1024){fail(res,400,'Invalid credentials');return}
   if(!rateLimit('login:'+(req.socket.remoteAddress||'unknown'))){fail(res,429,'Too many attempts');return}
   const q=await pool.query('SELECT id,password_hash FROM admin_users WHERE username=$1 AND active=true',[username]);
   if(!q.rowCount||!verifyPassword(password,q.rows[0].password_hash)){fail(res,401,'Invalid credentials');return}
   const token=createSessionToken();await pool.query("INSERT INTO admin_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",[tokenDigest(token),q.rows[0].id]);
   res.setHeader('set-cookie',secureSessionCookie(token));json(res,200,{ok:true});return
  }
  if(url.pathname==='/api/admin/logout'&&req.method==='POST'){
   const token=parseCookie(req.headers.cookie,'brill_session');if(token)await pool.query('DELETE FROM admin_sessions WHERE token_hash=$1',[tokenDigest(token)]);
   res.setHeader('set-cookie',secureSessionCookie('',0));json(res,200,{ok:true});return
  }
  if(!await auth(req)){fail(res,401,'Unauthorized');return}
  if(req.method!=='GET'&&req.headers['x-brill-csrf']!=='1'){fail(res,403,'CSRF check failed');return}
  if(url.pathname==='/api/admin/sla-notifications'&&req.method==='GET'){
   const token=parseCookie(req.headers.cookie,'brill_session');
   const actor=await pool.query('SELECT u.id FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true',[tokenDigest(token)]);
   if(!actor.rowCount){fail(res,401,'Unauthorized');return}
   const userId=actor.rows[0].id;
   const client=await pool.connect();
   try{
    await client.query('BEGIN');
    await client.query(`INSERT INTO inquiry_sla_notifications(id,inquiry_id,recipient_id,notification_kind,due_at)
      SELECT gen_random_uuid(),i.id,i.assigned_to,
      CASE WHEN i.due_at<=now() THEN 'overdue' ELSE 'due_soon' END,i.due_at
      FROM inquiries i WHERE i.assigned_to=$1 AND i.status<>'closed' AND i.due_at IS NOT NULL
      AND i.due_at<=now()+interval '1 hour'
      ON CONFLICT(inquiry_id,recipient_id,notification_kind,due_at) DO NOTHING`,[userId]);
    const result=await client.query(`SELECT n.id,n.inquiry_id,n.notification_kind,n.due_at,n.created_at,i.name,i.priority
      FROM inquiry_sla_notifications n JOIN inquiries i ON i.id=n.inquiry_id
      WHERE n.recipient_id=$1 AND n.read_at IS NULL AND i.status<>'closed' AND i.assigned_to=$1 AND i.due_at=n.due_at
      AND (n.notification_kind='overdue' OR (n.notification_kind='due_soon' AND i.due_at>now()))
      ORDER BY n.created_at DESC LIMIT 50`,[userId]);
    await client.query('COMMIT');json(res,200,{items:result.rows});
   }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}return
  }
  if(url.pathname.startsWith('/api/admin/sla-notifications/')&&url.pathname.endsWith('/read')&&/^[a-f0-9-]{36}$/.test(url.pathname.split('/')[4])&&req.method==='POST'){
   const token=parseCookie(req.headers.cookie,'brill_session');
   const q=await pool.query(`UPDATE inquiry_sla_notifications SET read_at=now()
    WHERE id=$1 AND recipient_id IN (SELECT u.id FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=$2 AND s.expires_at>now() AND u.active=true)
    RETURNING id`,[url.pathname.split('/')[4],tokenDigest(token)]);
   json(res,q.rowCount?200:404,q.rowCount?{ok:true}:{error:'Not found'});return
  }
  if(url.pathname==='/api/admin/staff'&&req.method==='GET'){
   const q=await pool.query('SELECT id,username FROM admin_users WHERE active=true ORDER BY username');json(res,200,{items:q.rows});return
  }
  if(/^\/api\/admin\/inquiries\/[a-f0-9-]{36}\/chat$/.test(url.pathname)){
   const inquiryId=url.pathname.split('/')[4];
   const actor=await pool.query('SELECT u.id,u.username FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true',[tokenDigest(parseCookie(req.headers.cookie,'brill_session'))]);
   if(!actor.rowCount){fail(res,401,'Unauthorized');return}
   if(req.method==='GET'){
    const exists=await pool.query('SELECT 1 FROM inquiries WHERE id=$1',[inquiryId]);if(!exists.rowCount){fail(res,404,'Not found');return}
    const q=await pool.query("SELECT m.id,m.sender_kind,m.message,m.created_at,u.username AS employee FROM inquiry_chat_messages m LEFT JOIN admin_users u ON u.id=m.sender_id WHERE m.inquiry_id=$1 ORDER BY m.created_at,m.id LIMIT 200",[inquiryId]);
    json(res,200,{items:q.rows});return
   }
   if(req.method==='POST'){
    const data=await body(req),message=text(data.message,2000);
    if(!message||message.length>2000){fail(res,400,'Invalid message');return}
    const q=await pool.query("INSERT INTO inquiry_chat_messages(id,inquiry_id,sender_kind,sender_id,message) SELECT $1,id,'employee',$3,$4 FROM inquiries WHERE id=$2 RETURNING id,created_at",[crypto.randomUUID(),inquiryId,actor.rows[0].id,message]);
    json(res,q.rowCount?201:404,q.rowCount?{ok:true,...q.rows[0]}:{error:'Not found'});return
   }
  }
  if(url.pathname==='/api/admin/inquiries/overview'&&req.method==='GET'){
   const q=await pool.query(`SELECT
    count(*)::int AS total,
    count(*) FILTER (WHERE status='new')::int AS new_count,
    count(*) FILTER (WHERE status='read')::int AS in_progress,
    count(*) FILTER (WHERE status='closed')::int AS closed,
    count(*) FILTER (WHERE status<>'closed' AND assigned_to IS NULL)::int AS unassigned,
    count(*) FILTER (WHERE status<>'closed' AND due_at<now())::int AS overdue,
    count(*) FILTER (WHERE status<>'closed' AND priority='urgent')::int AS urgent
    FROM inquiries`);
   const employees=await pool.query(`SELECT u.id,u.username,
    count(i.id) FILTER (WHERE i.status<>'closed')::int AS active,
    count(i.id) FILTER (WHERE i.status<>'closed' AND i.due_at<now())::int AS overdue
    FROM admin_users u LEFT JOIN inquiries i ON i.assigned_to=u.id
    WHERE u.active=true GROUP BY u.id,u.username ORDER BY active DESC,u.username LIMIT 100`);
   json(res,200,{summary:q.rows[0],employees:employees.rows});return
  }
  if(url.pathname==='/api/admin/push-config'&&req.method==='GET'){json(res,200,{publicKey:publicPushKey});return}
  if(url.pathname==='/api/admin/push-subscriptions'&&req.method==='POST'){
   if(!publicPushKey){fail(res,503,'Push not configured');return}
   const subscription=await body(req);if(!validSubscription(subscription)){fail(res,400,'Invalid subscription');return}
   await pool.query('INSERT INTO visit_push_subscriptions(endpoint,p256dh,auth) VALUES($1,$2,$3) ON CONFLICT(endpoint) DO UPDATE SET p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth',[subscription.endpoint,subscription.keys.p256dh,subscription.keys.auth]);json(res,201,{ok:true});return
  }
  if(url.pathname==='/api/admin/inquiries'&&req.method==='GET'){
   const q=await pool.query('SELECT i.id,i.name,i.email,i.message,i.status,i.created_at,i.assigned_to,i.priority,i.due_at,u.username AS assignee_name FROM inquiries i LEFT JOIN admin_users u ON u.id=i.assigned_to ORDER BY i.created_at DESC LIMIT 100');json(res,200,{items:q.rows});return
  }
  if(/^\/api\/admin\/inquiries\/[a-f0-9-]{36}\/assignment$/.test(url.pathname)&&req.method==='PATCH'){
   const id=url.pathname.split('/')[4],d=await body(req);
   if(!['low','normal','high','urgent'].includes(d.priority)||!(d.assigned_to===null||typeof d.assigned_to==='string'&&/^[a-f0-9-]{36}$/.test(d.assigned_to))||!(d.due_at===null||typeof d.due_at==='string'&&!Number.isNaN(Date.parse(d.due_at)))){fail(res,400,'Invalid assignment');return}
   const token=parseCookie(req.headers.cookie,'brill_session'),client=await pool.connect();
   try{
    await client.query('BEGIN');
    const actor=await client.query('SELECT u.id,u.username FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true',[tokenDigest(token)]);
    if(!actor.rowCount){await client.query('ROLLBACK');fail(res,401,'Unauthorized');return}
    const old=await client.query('SELECT assigned_to,priority,due_at FROM inquiries WHERE id=$1 FOR UPDATE',[id]);
    if(!old.rowCount){await client.query('ROLLBACK');fail(res,404,'Inquiry not found');return}
    if(d.assigned_to){const valid=await client.query('SELECT 1 FROM admin_users WHERE id=$1 AND active=true',[d.assigned_to]);if(!valid.rowCount){await client.query('ROLLBACK');fail(res,400,'Employee not active');return}}
    const q=await client.query('UPDATE inquiries SET assigned_to=$1,priority=$2,due_at=$3 WHERE id=$4 RETURNING id,assigned_to,priority,due_at',[d.assigned_to,d.priority,d.due_at,id]);
    const previous=old.rows[0],next=q.rows[0];
    const changes=[];
    if(previous.assigned_to!==next.assigned_to)changes.push('Ответственный: '+(previous.assigned_to||'не назначен')+' → '+(next.assigned_to||'не назначен'));
    if(previous.priority!==next.priority)changes.push('Приоритет: '+previous.priority+' → '+next.priority);
    if((previous.due_at?new Date(previous.due_at).toISOString():null)!==(next.due_at?new Date(next.due_at).toISOString():null))changes.push('Срок: '+(previous.due_at?new Date(previous.due_at).toISOString():'не указан')+' → '+(next.due_at?new Date(next.due_at).toISOString():'не указан'));
    if(changes.length)await client.query("INSERT INTO inquiry_activity(id,inquiry_id,actor_id,actor_name,action,note) VALUES($1,$2,$3,$4,'note',$5)",[crypto.randomUUID(),id,actor.rows[0].id,actor.rows[0].username,'Изменение назначения: '+changes.join('; ')]);
    await client.query('COMMIT');json(res,200,next);
   }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}return
  }
  if(/^\/api\/admin\/inquiries\/[a-f0-9-]{36}\/activity$/.test(url.pathname)){
   const id=url.pathname.split('/')[4];
   if(req.method==='GET'){
    const exists=await pool.query('SELECT 1 FROM inquiries WHERE id=$1',[id]);if(!exists.rowCount){fail(res,404,'Not found');return}
    const q=await pool.query('SELECT id,action,actor_name,old_status,new_status,note,created_at FROM inquiry_activity WHERE inquiry_id=$1 ORDER BY created_at DESC,id DESC LIMIT 200',[id]);json(res,200,{items:q.rows});return
   }
   if(req.method==='POST'){
    const data=await body(req),note=text(data.note,2000);
    if(!note||note.length>2000){fail(res,400,'Invalid note');return}
    const actor=await pool.query('SELECT u.id,u.username FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[tokenDigest(parseCookie(req.headers.cookie,'brill_session'))]);
    if(!actor.rowCount){fail(res,401,'Unauthorized');return}
    const q=await pool.query("INSERT INTO inquiry_activity(id,inquiry_id,actor_id,actor_name,action,note) SELECT $1,id,$3,$4,'note',$5 FROM inquiries WHERE id=$2 RETURNING id",[crypto.randomUUID(),id,actor.rows[0].id,actor.rows[0].username,note]);json(res,q.rowCount?201:404,q.rowCount?{ok:true}:{error:'Not found'});return
   }
  }
  if(url.pathname.startsWith('/api/admin/inquiries/')&&/^[a-f0-9-]{36}$/.test(url.pathname.slice('/api/admin/inquiries/'.length))&&req.method==='PUT'){
   const data=await body(req);if(!['new','read','closed'].includes(data.status)){fail(res,400,'Invalid status');return}
   const id=url.pathname.split('/').pop(),client=await pool.connect();
   try{
    await client.query('BEGIN');
    const previous=await client.query('SELECT status FROM inquiries WHERE id=$1 FOR UPDATE',[id]);
    if(!previous.rowCount){await client.query('ROLLBACK');fail(res,404,'Not found');return}
    if(previous.rows[0].status!==data.status){
     const actor=await client.query('SELECT u.id,u.username FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[tokenDigest(parseCookie(req.headers.cookie,'brill_session'))]);
     if(!actor.rowCount){await client.query('ROLLBACK');fail(res,401,'Unauthorized');return}
     await client.query('UPDATE inquiries SET status=$1 WHERE id=$2',[data.status,id]);
     await client.query("INSERT INTO inquiry_activity(id,inquiry_id,actor_id,actor_name,action,old_status,new_status) VALUES($1,$2,$3,$4,'status',$5,$6)",[crypto.randomUUID(),id,actor.rows[0].id,actor.rows[0].username,previous.rows[0].status,data.status]);
    }
    await client.query('COMMIT');json(res,200,{id,status:data.status});
   }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}return
  }
  if(url.pathname==='/api/admin/content'&&req.method==='PUT'){
   const data=await body(req);const key=text(data.key,100),lang=data.lang,value=text(data.value,10000);
   if(!/^[a-zA-Z][a-zA-Z0-9_]{0,99}$/.test(key)||!validLang(lang)||!value||value.length>10000){fail(res,400,'Invalid content');return}
   await pool.query('INSERT INTO content_entries(key,lang,value) VALUES($1,$2,$3) ON CONFLICT(key,lang) DO UPDATE SET value=EXCLUDED.value,updated_at=now()',[key,lang,value]);json(res,200,{ok:true});return
  }
  if(url.pathname==='/api/admin/self-test'&&req.method==='POST'){
   const client=await pool.connect(),checks=[];
   try{
    await client.query('BEGIN');
    for(const [kind,translations,foreign,textColumn] of [['news','news_translations','post_id','body'],['project','catalog_translations','entry_id','description'],['service','catalog_translations','entry_id','description']]){
     const id=crypto.randomUUID(),slug='internal-self-test-'+kind+'-'+id.slice(0,8);
     if(kind==='news')await client.query('INSERT INTO news_posts(id,slug,published) VALUES($1,$2,false)',[id,slug]);
     else await client.query('INSERT INTO catalog_entries(id,kind,slug,published) VALUES($1,$2,$3,false)',[id,kind,slug]);
     for(const lang of ['ru','en','he'])await client.query('INSERT INTO '+translations+'('+foreign+',lang,title,'+textColumn+') VALUES($1,$2,$3,$4)',[id,lang,'Self test '+lang,'Draft '+lang]);
     const draft=await client.query('SELECT count(*)::int AS n FROM '+translations+' WHERE '+foreign+'=$1',[id]);
     if(draft.rows[0].n!==3)throw Error(kind+' translation persistence failed');
     checks.push(kind+': create and three languages');
     await client.query('UPDATE '+translations+' SET '+textColumn+'=$1 WHERE '+foreign+'=$2 AND lang=$3',['Edited content',id,'ru']);
     const edited=await client.query('SELECT '+textColumn+' AS value FROM '+translations+' WHERE '+foreign+'=$1 AND lang=$2',[id,'ru']);
     if(edited.rows[0]?.value!=='Edited content')throw Error(kind+' edit failed');
     checks.push(kind+': edit');
     const master=kind==='news'?'news_posts':'catalog_entries';
     await client.query('UPDATE '+master+' SET published=true WHERE id=$1',[id]);
     const visible=await client.query('SELECT count(*)::int AS n FROM '+master+' p JOIN '+translations+' t ON t.'+foreign+'=p.id WHERE p.id=$1 AND p.published=true AND t.lang=$2',[id,'ru']);
     if(visible.rows[0].n!==1)throw Error(kind+' publication failed');
     checks.push(kind+': publish and public query');
     await client.query('UPDATE '+master+' SET published=false WHERE id=$1',[id]);
     const hidden=await client.query('SELECT count(*)::int AS n FROM '+master+' p JOIN '+translations+' t ON t.'+foreign+'=p.id WHERE p.id=$1 AND p.published=true',[id]);
     if(hidden.rows[0].n!==0)throw Error(kind+' unpublish failed');
     checks.push(kind+': unpublish');
    }
    await client.query('ROLLBACK');
    json(res,200,{ok:true,checks,mode:'rolled-back transaction',note:'Test records were never committed or exposed to visitors'});
   }catch(e){await client.query('ROLLBACK');console.error('Admin self-test failed:',e.message);fail(res,500,'Self-test failed: '+e.message)}finally{client.release()}return
  }
  if(url.pathname==='/api/admin/inquiries/self-test'&&req.method==='POST'){
   const client=await pool.connect(),checks=[];
   try{
    await client.query('BEGIN');
    const actor=await client.query('SELECT u.id,u.username FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true',[tokenDigest(parseCookie(req.headers.cookie,'brill_session'))]);
    if(!actor.rowCount)throw Error('Authenticated actor missing');
    const user=actor.rows[0],id=crypto.randomUUID();
    await client.query('INSERT INTO inquiries(id,name,email,message) VALUES($1,$2,$3,$4)',[id,'Integration test','test@example.invalid','Temporary test inquiry']);
    checks.push('test inquiry created');
    const note='Internal note verification '+id;
    await client.query("INSERT INTO inquiry_activity(id,inquiry_id,actor_id,actor_name,action,note) VALUES($1,$2,$3,$4,'note',$5)",[crypto.randomUUID(),id,user.id,user.username,note]);
    const saved=await client.query("SELECT actor_name,note FROM inquiry_activity WHERE inquiry_id=$1 AND action='note'",[id]);
    if(saved.rows[0]?.note!==note||saved.rows[0]?.actor_name!==user.username)throw Error('Note or actor mismatch');
    checks.push('note persisted with authenticated employee');
    const old=await client.query('SELECT status FROM inquiries WHERE id=$1 FOR UPDATE',[id]);
    await client.query("UPDATE inquiries SET status='read' WHERE id=$1",[id]);
    await client.query("INSERT INTO inquiry_activity(id,inquiry_id,actor_id,actor_name,action,old_status,new_status) VALUES($1,$2,$3,$4,'status',$5,'read')",[crypto.randomUUID(),id,user.id,user.username,old.rows[0].status]);
    const status=await client.query('SELECT status FROM inquiries WHERE id=$1',[id]);
    const history=await client.query('SELECT action,actor_name,old_status,new_status,note FROM inquiry_activity WHERE inquiry_id=$1 ORDER BY created_at,id',[id]);
    if(status.rows[0]?.status!=='read'||history.rowCount!==2||!history.rows.some(x=>x.action==='status'&&x.new_status==='read'&&x.actor_name===user.username))throw Error('Status or activity history mismatch');
    checks.push('status transition and history readable');
    const deadline=new Date(Date.now()-3600000).toISOString();
    await client.query('UPDATE inquiries SET assigned_to=$1,priority=$2,due_at=$3 WHERE id=$4',[user.id,'urgent',deadline,id]);
    await client.query("INSERT INTO inquiry_activity(id,inquiry_id,actor_id,actor_name,action,note) VALUES($1,$2,$3,$4,'note',$5)",[crypto.randomUUID(),id,user.id,user.username,'Изменение назначения: ответственный, приоритет и срок']);
    const assignment=await client.query('SELECT assigned_to,priority,due_at,status FROM inquiries WHERE id=$1',[id]);
    if(assignment.rows[0]?.assigned_to!==user.id||assignment.rows[0]?.priority!=='urgent'||new Date(assignment.rows[0]?.due_at).toISOString()!==deadline)throw Error('Assignment fields not saved');
    checks.push('assignee priority and deadline persisted');
    const audit=await client.query("SELECT actor_name,note FROM inquiry_activity WHERE inquiry_id=$1 AND note LIKE 'Изменение назначения:%'",[id]);
    if(audit.rowCount!==1||audit.rows[0].actor_name!==user.username)throw Error('Assignment audit missing');
    checks.push('assignment audit linked to employee');
    const urgent=await client.query("SELECT count(*)::int AS n FROM inquiries WHERE id=$1 AND priority='urgent'",[id]);
    const overdue=await client.query("SELECT count(*)::int AS n FROM inquiries WHERE id=$1 AND status<>'closed' AND due_at<now()",[id]);
    if(urgent.rows[0].n!==1||overdue.rows[0].n!==1)throw Error('Urgent or overdue classification failed');
    checks.push('urgent and overdue classification');
    const createSla=()=>client.query(`INSERT INTO inquiry_sla_notifications(id,inquiry_id,recipient_id,notification_kind,due_at)
      SELECT gen_random_uuid(),i.id,i.assigned_to,
      CASE WHEN i.due_at<=now() THEN 'overdue' ELSE 'due_soon' END,i.due_at
      FROM inquiries i WHERE i.id=$1 AND i.assigned_to=$2 AND i.status<>'closed' AND i.due_at IS NOT NULL
      AND i.due_at<=now()+interval '1 hour'
      ON CONFLICT(inquiry_id,recipient_id,notification_kind,due_at) DO NOTHING`,[id,user.id]);
    const firstSla=await createSla(),secondSla=await createSla();
    const uniqueNotification=await client.query("SELECT id FROM inquiry_sla_notifications WHERE inquiry_id=$1 AND recipient_id=$2 AND notification_kind='overdue' AND due_at=$3",[id,user.id,deadline]);
    if(firstSla.rowCount!==1||secondSla.rowCount!==0||uniqueNotification.rowCount!==1)throw Error('SLA creation or duplicate protection failed');
    checks.push('SLA creation from actual inquiry conditions and duplicate prevention');
    await client.query('UPDATE inquiry_sla_notifications SET read_at=now() WHERE id=$1',[uniqueNotification.rows[0].id]);
    const unread=await client.query('SELECT count(*)::int AS n FROM inquiry_sla_notifications WHERE inquiry_id=$1 AND read_at IS NULL',[id]);
    if(unread.rows[0].n!==0)throw Error('SLA read status failed');
    checks.push('SLA read acknowledgement persisted');
    await client.query('ROLLBACK');
    json(res,200,{ok:true,checks,mode:'rolled-back transaction',note:'No test records committed'});
   }catch(e){await client.query('ROLLBACK');console.error('Inquiry self-test failed:',e.message);fail(res,500,'Inquiry self-test failed')}finally{client.release()}return
  }
  if(url.pathname==='/api/admin/catalog'&&req.method==='GET'){
   const q=await pool.query('SELECT e.id,e.kind,e.slug,e.published,e.sort_order,t.lang,t.title,t.description FROM catalog_entries e LEFT JOIN catalog_translations t ON t.entry_id=e.id ORDER BY e.sort_order,e.created_at DESC');
   const items=[];for(const row of q.rows){let item=items.find(x=>x.id===row.id);if(!item){item={id:row.id,kind:row.kind,slug:row.slug,published:row.published,sort_order:row.sort_order,translations:{}};items.push(item)}if(row.lang)item.translations[row.lang]={title:row.title,description:row.description}}
   json(res,200,{items});return
  }
  if(url.pathname==='/api/admin/catalog'&&req.method==='POST'){
   const d=await body(req),slug=text(d.slug,140),kind=d.kind;
   if(!['project','service'].includes(kind)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>140||!d.translations||typeof d.translations!=='object'||Array.isArray(d.translations)){fail(res,400,'Invalid catalog entry');return}
   const entries=Object.entries(d.translations);
   if(!entries.length||entries.some(([l,v])=>!validLang(l)||!v||typeof v.title!=='string'||!v.title.trim()||v.title.trim().length>180||typeof v.description!=='string'||!v.description.trim()||v.description.trim().length>10000)){fail(res,400,'Invalid translations');return}
   const client=await pool.connect();try{await client.query('BEGIN');const id=crypto.randomUUID();await client.query('INSERT INTO catalog_entries(id,kind,slug) VALUES($1,$2,$3)',[id,kind,slug]);for(const [lang,v] of entries)await client.query('INSERT INTO catalog_translations(entry_id,lang,title,description) VALUES($1,$2,$3,$4)',[id,lang,v.title.trim(),v.description.trim()]);await client.query('COMMIT');json(res,201,{id})}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}return
  }
  if(url.pathname.startsWith('/api/admin/catalog/')&&/^[a-f0-9-]{36}$/.test(url.pathname.slice('/api/admin/catalog/'.length))&&req.method==='PATCH'){
   const id=url.pathname.split('/').pop(),d=await body(req);
   if(typeof d.published!=='boolean'&&(!d.translations||typeof d.translations!=='object'||Array.isArray(d.translations))){fail(res,400,'Invalid update');return}
   const entries=d.translations?Object.entries(d.translations):[];
   if(entries.some(([l,v])=>!validLang(l)||!v||typeof v.title!=='string'||!v.title.trim()||v.title.trim().length>180||typeof v.description!=='string'||!v.description.trim()||v.description.trim().length>10000)){fail(res,400,'Invalid translations');return}
   const client=await pool.connect();try{await client.query('BEGIN');const q=await client.query('SELECT id FROM catalog_entries WHERE id=$1 FOR UPDATE',[id]);if(!q.rowCount){await client.query('ROLLBACK');fail(res,404,'Not found');return}
   for(const [lang,v] of entries)await client.query('INSERT INTO catalog_translations(entry_id,lang,title,description) VALUES($1,$2,$3,$4) ON CONFLICT(entry_id,lang) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description',[id,lang,v.title.trim(),v.description.trim()]);
   if(typeof d.published==='boolean')await client.query('UPDATE catalog_entries SET published=$1,updated_at=now() WHERE id=$2',[d.published,id]);else await client.query('UPDATE catalog_entries SET updated_at=now() WHERE id=$1',[id]);
   await client.query('COMMIT');json(res,200,{ok:true})}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}return
  }
  if(url.pathname==='/api/admin/news'&&req.method==='GET'){
   const q=await pool.query("SELECT p.id,p.slug,p.published,p.created_at,t.lang,t.title,t.body FROM news_posts p LEFT JOIN news_translations t ON t.post_id=p.id ORDER BY p.created_at DESC LIMIT 300");
   const items=[];for(const row of q.rows){let item=items.find(x=>x.id===row.id);if(!item){item={id:row.id,slug:row.slug,published:row.published,created_at:row.created_at,translations:{}};items.push(item)}if(row.lang)item.translations[row.lang]={title:row.title,body:row.body}}
   json(res,200,{items});return
  }
  if(url.pathname.startsWith('/api/admin/news/')&&/^[a-f0-9-]{36}$/.test(url.pathname.slice('/api/admin/news/'.length))&&req.method==='PUT'){
   const id=url.pathname.split('/').pop(),d=await body(req);
   if(typeof d.published!=='boolean'){fail(res,400,'Invalid publication state');return}
   const q=await pool.query('UPDATE news_posts SET published=$1,updated_at=now() WHERE id=$2 RETURNING id,published',[d.published,id]);
   json(res,q.rowCount?200:404,q.rows[0]||{error:'Not found'});return
  }
  if(url.pathname.startsWith('/api/admin/news/')&&/^[a-f0-9-]{36}$/.test(url.pathname.slice('/api/admin/news/'.length))&&req.method==='PATCH'){
   const id=url.pathname.split('/').pop(),d=await body(req);
   if(!d.translations||typeof d.translations!=='object'||Array.isArray(d.translations)){fail(res,400,'Invalid translations');return}
   const entries=Object.entries(d.translations);
   if(!entries.length||entries.some(([l,v])=>!validLang(l)||!v||typeof v.title!=='string'||!v.title.trim()||v.title.trim().length>180||typeof v.body!=='string'||!v.body.trim()||v.body.trim().length>10000)){fail(res,400,'Invalid translations');return}
   const client=await pool.connect();try{
    await client.query('BEGIN');
    const post=await client.query('SELECT id FROM news_posts WHERE id=$1 FOR UPDATE',[id]);
    if(!post.rowCount){await client.query('ROLLBACK');fail(res,404,'Not found');return}
    for(const [lang,v] of entries)await client.query('INSERT INTO news_translations(post_id,lang,title,body) VALUES($1,$2,$3,$4) ON CONFLICT(post_id,lang) DO UPDATE SET title=EXCLUDED.title,body=EXCLUDED.body',[id,lang,v.title.trim(),v.body.trim()]);
    await client.query('UPDATE news_posts SET updated_at=now() WHERE id=$1',[id]);
    await client.query('COMMIT');json(res,200,{ok:true});
   }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}return
  }
  if(url.pathname==='/api/admin/news'&&req.method==='POST'){
   const d=await body(req);const slug=text(d.slug,140);if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>140||typeof d.published!=='boolean'||!d.translations||typeof d.translations!=='object'){fail(res,400,'Invalid news');return}
   const entries=Object.entries(d.translations);if(!entries.length||entries.some(([l,v])=>!validLang(l)||!v||!text(v.title,180)||text(v.title,180).length>180||!text(v.body,10000)||text(v.body,10000).length>10000)){fail(res,400,'Invalid translations');return}
   const client=await pool.connect();try{await client.query('BEGIN');const id=crypto.randomUUID();await client.query('INSERT INTO news_posts(id,slug,published) VALUES($1,$2,$3)',[id,slug,d.published]);for(const [lang,v] of entries)await client.query('INSERT INTO news_translations(post_id,lang,title,body) VALUES($1,$2,$3,$4)',[id,lang,v.title.trim(),v.body.trim()]);await client.query('COMMIT');json(res,201,{id})}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}return
  }
  fail(res,404,'Not found');
 }catch(e){if(e.status){fail(res,e.status,e.message)}else{console.error('Request failed:',e.code||e.message);fail(res,e.code==='23505'?409:500,'Server error')}}
});
const port=Number(process.env.PORT||3000);server.listen(port,process.env.HOST||'127.0.0.1',()=>{console.log('BRILL API listening on '+(process.env.HOST||'127.0.0.1')+':'+port);void registerTelegramWebhook()});
process.on('SIGTERM',()=>server.close(()=>pool.end()));
