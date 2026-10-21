import crypto from 'node:crypto';
import webpush from 'web-push';
const token=process.env.TELEGRAM_BOT_TOKEN;
const chatId=process.env.TELEGRAM_CHAT_ID;
const pushReady=!!(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT);
if(pushReady)webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
export const publicPushKey=pushReady?process.env.VAPID_PUBLIC_KEY:null;
export function isVisitPayload(data){return data&&typeof data.path==='string'&&data.path.startsWith('/')&&data.path.length<=250&&!data.path.startsWith('//')&&typeof data.referrer==='string'&&data.referrer.length<=250}
export function visitLimiter(){const seen=new Map();return (key)=>{const now=Date.now();if(seen.size>5000){for(const [k,t] of seen)if(now-t>600000)seen.delete(k)}if(now-(seen.get(key)||0)<600000)return false;seen.set(key,now);return true}}
export async function notifyVisit(pool,data){
 const msg=`BRILL TEAM: новый просмотр сайта\nСтраница: ${data.path}\nИсточник: ${data.referrer||'неизвестен'}\nВремя: ${new Date().toISOString()}`;
 if(token&&chatId){try{const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text:msg}),signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('Telegram HTTP '+response.status)}catch(e){console.error('Telegram notification failed:',e.message)}}
 if(!pushReady)return;
 try{const subscriptions=await pool.query('SELECT endpoint,p256dh,auth FROM visit_push_subscriptions LIMIT 30');await Promise.all(subscriptions.rows.map(async s=>{try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title:'BRILL TEAM — новый просмотр',body:data.path,tag:'brill-visit',url:'/admin'}),{TTL:120})}catch(e){if(e.statusCode===404||e.statusCode===410)await pool.query('DELETE FROM visit_push_subscriptions WHERE endpoint=$1',[s.endpoint]);else console.error('Push notification failed:',e.message)}}))}catch(e){console.error('Push subscription query failed:',e.message)}
}
export function validSubscription(s){return s&&typeof s.endpoint==='string'&&s.endpoint.length<2000&&s.endpoint.startsWith('https://')&&typeof s.keys?.p256dh==='string'&&s.keys.p256dh.length<256&&typeof s.keys?.auth==='string'&&s.keys.auth.length<256}
