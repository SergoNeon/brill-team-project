import http from 'node:http';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import { verifyPassword, createSessionToken, tokenDigest, parseCookie, secureSessionCookie } from './auth.js';

const required=['DATABASE_URL','PUBLIC_ORIGIN'];
for(const k of required) if(!process.env[k]) throw new Error('Missing required environment variable: '+k);

const origin=new URL(process.env.PUBLIC_ORIGIN).origin;
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:true},max:5});
const buckets=new Map();
const MAX_BODY=16*1024;
function json(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data))}
function fail(res,status,error){json(res,status,{error})}
async function auth(req){const token=parseCookie(req.headers.cookie,'brill_session');if(!/^[A-Za-z0-9_-]{43}$/.test(token))return false;const q=await pool.query('SELECT 1 FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true',[tokenDigest(token)]);return q.rowCount>0}
function rateLimit(ip){const now=Date.now();if(buckets.size>10000){for(const [k,v] of buckets)if(now-v.start>3600000)buckets.delete(k)}const v=buckets.get(ip)||{start:now,count:0};if(now-v.start>3600000){v.start=now;v.count=0}v.count++;buckets.set(ip,v);return v.count<=5}
async function body(req){let chunks=[],size=0;for await(const c of req){size+=c.length;if(size>MAX_BODY)throw Object.assign(new Error('Payload too large'),{status:413});chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Object.assign(new Error('Invalid JSON'),{status:400})}}
function text(v,max){return typeof v==='string'?v.trim().slice(0,max+1):''}
function validLang(v){return ['ru','he','en'].includes(v)}
function validOrigin(req){return req.headers.origin===origin}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(req.headers.origin===origin){res.setHeader('access-control-allow-origin',origin);res.setHeader('vary','Origin');res.setHeader('access-control-allow-credentials','true');res.setHeader('access-control-allow-headers','content-type,x-brill-csrf');res.setHeader('access-control-allow-methods','GET,POST,PUT,DELETE,OPTIONS')}
 if(req.method==='OPTIONS'){res.writeHead(validOrigin(req)?204:403);res.end();return}
 if(url.pathname==='/health'&&req.method==='GET'){json(res,200,{ok:true});return}
 if(!url.pathname.startsWith('/api/')){fail(res,404,'Not found');return}
 if(req.method!=='GET'&&!validOrigin(req)){fail(res,403,'Origin not allowed');return}
 try{
  if(url.pathname==='/api/inquiries'&&req.method==='POST'){
   const ip=req.socket.remoteAddress||'unknown';if(!rateLimit(ip)){fail(res,429,'Too many requests');return}
   const data=await body(req);if(data.website){json(res,202,{ok:true});return}
   const name=text(data.name,120),email=text(data.email,254),message=text(data.message,5000);
   if(!name||name.length>120||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||message.length<10||message.length>5000){fail(res,400,'Invalid fields');return}
   await pool.query('INSERT INTO inquiries (id,name,email,message) VALUES ($1,$2,$3,$4)',[crypto.randomUUID(),name,email,message]);json(res,201,{ok:true});return
  }
  if(url.pathname==='/api/content'&&req.method==='GET'){
   const lang=url.searchParams.get('lang')||'ru';if(!validLang(lang)){fail(res,400,'Invalid language');return}
   const q=await pool.query('SELECT key,value FROM content_entries WHERE lang=$1',[lang]);json(res,200,{items:Object.fromEntries(q.rows.map(r=>[r.key,r.value]))});return
  }
  if(url.pathname==='/api/news'&&req.method==='GET'){
   const lang=url.searchParams.get('lang')||'ru';if(!validLang(lang)){fail(res,400,'Invalid language');return}
   const q=await pool.query('SELECT p.id,p.slug,p.created_at,t.title,t.body FROM news_posts p JOIN news_translations t ON t.post_id=p.id AND t.lang=$1 WHERE p.published=true ORDER BY p.created_at DESC LIMIT 30',[lang]);json(res,200,{items:q.rows});return
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
  if(url.pathname==='/api/admin/inquiries'&&req.method==='GET'){
   const q=await pool.query('SELECT id,name,email,message,status,created_at FROM inquiries ORDER BY created_at DESC LIMIT 100');json(res,200,{items:q.rows});return
  }
  if(/^\/api\/admin\/inquiries\/[a-f0-9-]+$/.test(url.pathname)&&req.method==='PUT'){
   const data=await body(req);if(!['new','read','closed'].includes(data.status)){fail(res,400,'Invalid status');return}
   const id=url.pathname.split('/').pop();const q=await pool.query('UPDATE inquiries SET status=$1 WHERE id=$2 RETURNING id,status',[data.status,id]);json(res,q.rowCount?200:404,q.rows[0]||{error:'Not found'});return
  }
  if(url.pathname==='/api/admin/content'&&req.method==='PUT'){
   const data=await body(req);const key=text(data.key,100),lang=data.lang,value=text(data.value,10000);
   if(!/^[a-zA-Z][a-zA-Z0-9_]{0,99}$/.test(key)||!validLang(lang)||!value||value.length>10000){fail(res,400,'Invalid content');return}
   await pool.query('INSERT INTO content_entries(key,lang,value) VALUES($1,$2,$3) ON CONFLICT(key,lang) DO UPDATE SET value=EXCLUDED.value,updated_at=now()',[key,lang,value]);json(res,200,{ok:true});return
  }
  if(url.pathname==='/api/admin/news'&&req.method==='POST'){
   const d=await body(req);const slug=text(d.slug,140);if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>140||typeof d.published!=='boolean'||!d.translations||typeof d.translations!=='object'){fail(res,400,'Invalid news');return}
   const entries=Object.entries(d.translations);if(!entries.length||entries.some(([l,v])=>!validLang(l)||!v||!text(v.title,180)||text(v.title,180).length>180||!text(v.body,10000)||text(v.body,10000).length>10000)){fail(res,400,'Invalid translations');return}
   const client=await pool.connect();try{await client.query('BEGIN');const id=crypto.randomUUID();await client.query('INSERT INTO news_posts(id,slug,published) VALUES($1,$2,$3)',[id,slug,d.published]);for(const [lang,v] of entries)await client.query('INSERT INTO news_translations(post_id,lang,title,body) VALUES($1,$2,$3,$4)',[id,lang,v.title.trim(),v.body.trim()]);await client.query('COMMIT');json(res,201,{id})}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}return
  }
  fail(res,404,'Not found');
 }catch(e){if(e.status){fail(res,e.status,e.message)}else{console.error('Request failed:',e.code||e.message);fail(res,e.code==='23505'?409:500,'Server error')}}
});
const port=Number(process.env.PORT||3000);server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log('BRILL API listening on '+(process.env.HOST||'127.0.0.1')+':'+port));
process.on('SIGTERM',()=>server.close(()=>pool.end()));
