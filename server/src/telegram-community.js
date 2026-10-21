import {readFileSync} from 'node:fs';
import crypto from 'node:crypto';

export const community=JSON.parse(readFileSync(new URL('../content/telegram-community.json',import.meta.url),'utf8'));
const languages=['ru','he','en'];
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
export const publicationText=post=>languages.map(lang=>post.translations?.[lang]||community.languages[lang][post.source]).join('\n\n');
export function publicTelegramAnswer(command,language='ru'){
 const lang=/^(he|iw)(-|$)/i.test(language)?'he':/^en(-|$)/i.test(language)?'en':'ru';
 const copy=community.languages[lang];
 if(command==='/services')return copy.directions+'\n\n'+community.siteUrl;
 if(command==='/request'||command==='/support')return copy.request;
 if(command==='/status')return copy.status;
 if(command==='/start'||command==='/help')return copy.welcome+'\n\n'+Object.entries(copy.commands).map(([key,label])=>'/'+key+' — '+label).join('\n')+'\n\n'+community.siteUrl;
 return null;
}

export const communityTable=`CREATE TABLE IF NOT EXISTS telegram_community_publications (
 chat_id text NOT NULL, publication_key text NOT NULL,
 message_id bigint, content_hash char(64) NOT NULL,
 status varchar(16) NOT NULL CHECK(status IN ('pending','published')),
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(chat_id,publication_key)
)`;

export async function setupTelegramCommunity(pool,{token,chatId,fetchApi=globalThis.fetch,log=console.log}={}){
 if(!token||!chatId)throw new Error('Telegram community configuration missing');
 async function api(method,params={}){
  let response;
  try{response=await fetchApi('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(params),signal:AbortSignal.timeout(12000)});}
  catch{throw Object.assign(new Error('Telegram '+method+' outcome unknown'),{method,uncertain:true});}
  let result;try{result=await response.json();}catch{throw Object.assign(new Error('Telegram '+method+' response unreadable'),{method,uncertain:true});}
  if(!response.ok||!result.ok)throw Object.assign(new Error('Telegram '+method+' failed ('+(result.error_code||response.status)+')'),{method,uncertain:response.status>=500});
  return result.result;
 }
 // Resolve the recipient before any Telegram writes or publication reservations.
 const me=await api('getMe'),chat=await api('getChat',{chat_id:chatId});
 log('Telegram community target: '+JSON.stringify({bot:me.username,title:chat.title,type:chat.type,isForum:!!chat.is_forum}));
 if(me.username?.toLowerCase()!==community.botUsername||!['group','supergroup'].includes(chat.type)||String(chat.id)!==String(chatId)||chat.title?.normalize('NFKC').trim().toLowerCase()!==community.groupTitle.toLowerCase())throw new Error('Telegram community recipient does not match the authorized group and bot');
 const membership=await api('getChatMember',{chat_id:chatId,user_id:me.id});
 const isAdmin=['administrator','creator'].includes(membership.status);
 const canChange=isAdmin&&(membership.status==='creator'||membership.can_change_info);
 const canPin=isAdmin&&(membership.status==='creator'||membership.can_pin_messages);
 log('Telegram community permissions: '+JSON.stringify({isAdmin,canChange:!!canChange,canPin:!!canPin}));
 if(!isAdmin||!canChange||!canPin)throw new Error('Telegram community requires bot administrator, change-info and pin permissions');
 const client=await pool.connect();let locked=false;
 try{
  await client.query(communityTable);
  locked=(await client.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',['brill-telegram-community:'+chatId])).rows[0].acquired;
  if(!locked)throw new Error('Telegram community publication already running');
  const configurationHash=hash(JSON.stringify(community));
  const configuration=await client.query('SELECT status,content_hash,message_id FROM telegram_community_publications WHERE chat_id=$1 AND publication_key=$2',[chatId,'configuration']);
  if(configuration.rows[0]?.content_hash!==configurationHash||configuration.rows[0]?.status!=='published'){
   for(const language_code of ['',...languages]){
    const copy=community.languages[language_code||'ru'];
    const commands=Object.entries(copy.commands).map(([command,description])=>({command,description}));
    await api('setMyCommands',{commands,scope:{type:'default'},language_code});
    await api('setMyCommands',{commands,scope:{type:'all_private_chats'},language_code});
    await api('setMyCommands',{commands:commands.filter(c=>c.command!=='status'),scope:{type:'chat',chat_id:chatId},language_code});
    await api('setMyDescription',{description:copy.description,language_code});
    await api('setMyShortDescription',{short_description:copy.shortDescription,language_code});
   }
   await api('setChatMenuButton',{menu_button:{type:'commands'}});
   await api('setChatDescription',{chat_id:chatId,description:community.groupDescription});
   await client.query("INSERT INTO telegram_community_publications(chat_id,publication_key,content_hash,status) VALUES($1,$2,$3,'published') ON CONFLICT(chat_id,publication_key) DO UPDATE SET content_hash=EXCLUDED.content_hash,status='published',updated_at=now()",[chatId,'configuration',configurationHash]);
  }
  const published=[];
  for(const post of community.posts){
   const text=publicationText(post),digest=hash(text);
   const existing=(await client.query('SELECT status,content_hash,message_id FROM telegram_community_publications WHERE chat_id=$1 AND publication_key=$2',[chatId,post.key])).rows[0];
   let messageId=existing?.message_id;
   if(existing?.status==='pending')throw new Error('Telegram publication '+post.key+' has an uncertain previous outcome; automatic resend stopped');
   const params={chat_id:chatId,text,link_preview_options:{is_disabled:true},reply_markup:{inline_keyboard:[[{text:'Сайт · אתר · Website',url:community.siteUrl},{text:'Бот · בוט · Bot',url:'https://t.me/'+community.botUsername}]]}};
   if(messageId){
    if(existing.content_hash!==digest){
     await api('editMessageText',{...params,message_id:Number(messageId)});
     await client.query('UPDATE telegram_community_publications SET content_hash=$3,updated_at=now() WHERE chat_id=$1 AND publication_key=$2',[chatId,post.key,digest]);
    }
   }else{
    await client.query("INSERT INTO telegram_community_publications(chat_id,publication_key,content_hash,status) VALUES($1,$2,$3,'pending')",[chatId,post.key,digest]);
    let sent;
    try{sent=await api('sendMessage',{...params,disable_notification:true});}
    catch(error){if(!error.uncertain)await client.query("DELETE FROM telegram_community_publications WHERE chat_id=$1 AND publication_key=$2 AND status='pending'",[chatId,post.key]);throw error;}
    messageId=sent.message_id;
    await client.query("UPDATE telegram_community_publications SET message_id=$3,status='published',updated_at=now() WHERE chat_id=$1 AND publication_key=$2",[chatId,post.key,messageId]);
   }
   if(post.pin)await api('pinChatMessage',{chat_id:chatId,message_id:Number(messageId),disable_notification:true});
   published.push({key:post.key,messageId:Number(messageId)});
  }
  // Read back public configuration after applying it.
  const updated=await api('getChat',{chat_id:chatId});
  if(updated.description!==community.groupDescription)throw new Error('Telegram community description verification failed');
  const groupCommands=await api('getMyCommands',{scope:{type:'chat',chat_id:chatId}});
  if(groupCommands.map(c=>c.command).sort().join(',')!=='help,request,services,start,support')throw new Error('Telegram community commands verification failed');
  const pinned=published.find(p=>p.key==='welcome');
  if(updated.pinned_message?.message_id!==pinned.messageId)throw new Error('Telegram community pinned message verification failed');
  const result={version:community.version,title:updated.title,username:updated.username||null,posts:published,pinnedMessageId:pinned.messageId};
  log('Telegram community ready: '+JSON.stringify(result));return result;
 }finally{
  try{if(locked)await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',['brill-telegram-community:'+chatId]);}finally{client.release();}
 }
}
