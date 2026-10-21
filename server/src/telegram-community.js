import {readFileSync} from 'node:fs';
import crypto from 'node:crypto';

export const community=JSON.parse(readFileSync(new URL('../content/telegram-community.json',import.meta.url),'utf8'));
const languages=['ru','he','en'];
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
export const groupSelectionRequestId=20261021;
export const publicationText=post=>languages.map(lang=>post.translations?.[lang]||community.languages[lang][post.source]).join('\n\n');
export function selectedTelegramGroup(message,ownerId){
 const shared=message?.chat_shared;
 if(!ownerId||message?.chat?.type!=='private'||String(message.chat.id)!==String(ownerId)||String(message.from?.id)!==String(ownerId)||shared?.request_id!==groupSelectionRequestId||!Number.isSafeInteger(shared.chat_id)||shared.chat_id>=0)return null;
 if(shared.title&&shared.title.normalize('NFKC').trim().toLowerCase()!==community.groupTitle.toLowerCase())return null;
 return String(shared.chat_id);
}
export function isAuthorizedCommunityStart(message,ownerId){
 return !!ownerId&&typeof message?.text==='string'&&['group','supergroup'].includes(message.chat?.type)&&String(message.from?.id)===String(ownerId)&&typeof message.chat?.title==='string'&&message.chat.title.normalize('NFKC').trim().toLowerCase()===community.groupTitle.toLowerCase()&&(/^(?:\/start|\/help)(?:@brillteamprojectbot)?(?:\s|$)/i.test(message.text)||message.text.trim().length>0);
}
export function publicTelegramAnswer(command,language='ru'){
 const lang=/^(he|iw)(-|$)/i.test(language)?'he':/^en(-|$)/i.test(language)?'en':'ru';
 const copy=community.languages[lang];
 if(command==='/sections')return community.sections.map((section,i)=>(i+1)+'. '+section.label[lang]+' — /section_'+section.key).join('\n')+'\n\n'+community.siteUrl;
 const section=community.sections.find(s=>command==='/section_'+s.key);if(section)return section.text[lang];
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

function telegramApi(token,fetchApi){
 return async function api(method,params={}){
  let response;
  try{response=await fetchApi('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(params),signal:AbortSignal.timeout(12000)});}
  catch{throw Object.assign(new Error('Telegram '+method+' outcome unknown'),{method,uncertain:true});}
  let result;try{result=await response.json();}catch{throw Object.assign(new Error('Telegram '+method+' response unreadable'),{method,uncertain:true});}
  if(!response.ok||!result.ok)throw Object.assign(new Error('Telegram '+method+' failed ('+(result.error_code||response.status)+'): '+String(result.description||'unknown').slice(0,240)),{method,uncertain:response.status>=500});
  return result.result;
 };
}

async function requestGroupSelection(pool,api,ownerId,log){
 const client=await pool.connect(),key='group-selection:'+community.version;let locked=false;
 try{
  locked=(await client.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',['brill-telegram-selection:'+ownerId])).rows[0].acquired;
  if(!locked)return null;
  const existing=(await client.query('SELECT status,content_hash,message_id FROM telegram_community_publications WHERE chat_id=$1 AND publication_key=$2',[ownerId,key])).rows[0];
  if(existing){log('Telegram group selection already requested: '+JSON.stringify({messageId:existing.message_id,status:existing.status}));return existing.message_id;}
  const text='BRILL TEAM PROJECT\n\nГотовы три публикации для вашей группы: приветствие, направления разработки и порядок обращения.\n\nНажмите «Выбрать группу» и укажите Brill Team Project. Бот проверит доступ и разместит подготовленные материалы.';
  await client.query("INSERT INTO telegram_community_publications(chat_id,publication_key,content_hash,status) VALUES($1,$2,$3,'pending')",[ownerId,key,hash(text)]);
  let sent;
  try{sent=await api('sendMessage',{chat_id:ownerId,text,reply_markup:{keyboard:[[{text:'Выбрать группу',request_chat:{request_id:groupSelectionRequestId,chat_is_channel:false,bot_is_member:true,request_title:true,request_username:true}}]],resize_keyboard:true,one_time_keyboard:true}});}
  catch(error){if(!error.uncertain)await client.query("DELETE FROM telegram_community_publications WHERE chat_id=$1 AND publication_key=$2 AND status='pending'",[ownerId,key]);throw error;}
  await client.query("UPDATE telegram_community_publications SET message_id=$3,status='published',updated_at=now() WHERE chat_id=$1 AND publication_key=$2",[ownerId,key,sent.message_id]);
  log('Telegram group selection sent: '+JSON.stringify({messageId:sent.message_id,requestId:groupSelectionRequestId}));return sent.message_id;
 }finally{try{if(locked)await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',['brill-telegram-selection:'+ownerId]);}finally{client.release();}}
}

export async function setupTelegramBotProfile(pool,{token,fetchApi=globalThis.fetch,log=console.log}={}){
 if(!token)throw new Error('Telegram bot token missing');
 const api=telegramApi(token,fetchApi),me=await api('getMe');
 if(me.username?.toLowerCase()!==community.botUsername)throw new Error('Telegram bot does not match the authorized username');
 const client=await pool.connect(),chatId='bot:'+me.id;let locked=false;
 try{
  await client.query(communityTable);
  locked=(await client.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',['brill-telegram-profile:'+me.id])).rows[0].acquired;
  if(!locked)throw new Error('Telegram bot profile setup already running');
  const digest=hash(JSON.stringify(community.languages));
  const existing=(await client.query('SELECT status,content_hash,message_id FROM telegram_community_publications WHERE chat_id=$1 AND publication_key=$2',[chatId,'profile'])).rows[0];
  if(existing?.content_hash!==digest||existing?.status!=='published'){
   for(const language_code of ['',...languages]){
    const copy=community.languages[language_code||'ru'];
    const commands=Object.entries(copy.commands).map(([command,description])=>({command,description}));
    await api('setMyCommands',{commands,scope:{type:'default'},language_code});
    await api('setMyCommands',{commands,scope:{type:'all_private_chats'},language_code});
    await api('setMyDescription',{description:copy.description,language_code});
    await api('setMyShortDescription',{short_description:copy.shortDescription,language_code});
   }
   await api('setChatMenuButton',{menu_button:{type:'commands'}});
   await client.query("INSERT INTO telegram_community_publications(chat_id,publication_key,content_hash,status) VALUES($1,$2,$3,'published') ON CONFLICT(chat_id,publication_key) DO UPDATE SET content_hash=EXCLUDED.content_hash,status='published',updated_at=now()",[chatId,'profile',digest]);
  }
  const commands=await api('getMyCommands',{scope:{type:'default'}});
  const description=await api('getMyDescription'),short=await api('getMyShortDescription');
  if(commands.map(c=>c.command).sort().join(',')!=='help,request,sections,services,start,status,support'||description.description!==community.languages.ru.description||short.short_description!==community.languages.ru.shortDescription)throw new Error('Telegram bot profile verification failed');
  log('Telegram bot profile ready: '+JSON.stringify({bot:me.username,languages,commands:commands.map(c=>c.command),version:community.version}));
  return me;
 }finally{try{if(locked)await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',['brill-telegram-profile:'+me.id]);}finally{client.release();}}
}

export async function setupTelegramCommunity(pool,{token,chatId,ownerUserId,fetchApi=globalThis.fetch,log=console.log}={}){
 if(!token||!chatId)throw new Error('Telegram community configuration missing');
 const api=telegramApi(token,fetchApi);
 const me=await setupTelegramBotProfile(pool,{token,fetchApi,log});
 const known=await pool.query("SELECT chat_id FROM telegram_community_publications WHERE publication_key='target' AND status='published' ORDER BY updated_at DESC LIMIT 2");
 if(known.rows.length>1)throw new Error('Telegram community has more than one saved group');
 if(known.rows.length){
  if(String(chatId).startsWith('-')&&String(chatId)!==known.rows[0].chat_id)throw new Error('Telegram group differs from the previously authorized group');
  chatId=known.rows[0].chat_id;
 }
 // Resolve the group before group writes or publication reservations.
 const chat=await api('getChat',{chat_id:chatId});
 log('Telegram community target: '+JSON.stringify({bot:me.username,title:chat.title,type:chat.type,isForum:!!chat.is_forum}));
 if(chat.type==='private'){
  const selectionMessageId=ownerUserId?await requestGroupSelection(pool,api,ownerUserId,log):null;
  log('Telegram community waiting for group: '+JSON.stringify({configuredChatType:'private',ownerBindingConfigured:!!ownerUserId,groupPostsSent:false}));
  return {waitingForGroup:true,bot:me.username,ownerBindingConfigured:!!ownerUserId,selectionMessageId};
 }
 if(me.username?.toLowerCase()!==community.botUsername||!['group','supergroup'].includes(chat.type)||String(chat.id)!==String(chatId)||chat.title?.normalize('NFKC').trim().toLowerCase()!==community.groupTitle.toLowerCase())throw new Error('Telegram community recipient does not match the authorized group and bot');
 const membership=await api('getChatMember',{chat_id:chatId,user_id:me.id});
 const isAdmin=['administrator','creator'].includes(membership.status);
 const canChange=isAdmin&&(membership.status==='creator'||membership.can_change_info);
 const canPin=isAdmin&&(membership.status==='creator'||membership.can_pin_messages);
 const canManageTopics=isAdmin&&(membership.status==='creator'||membership.can_manage_topics);
 log('Telegram community permissions: '+JSON.stringify({isAdmin,canChange:!!canChange,canPin:!!canPin,canManageTopics:!!canManageTopics}));
 if(!isAdmin||!canChange||!canPin)throw new Error('Telegram community requires bot administrator, change-info and pin permissions');
 if(ownerUserId){const owner=await api('getChatMember',{chat_id:chatId,user_id:Number(ownerUserId)});if(!['administrator','creator'].includes(owner.status))throw new Error('Configured owner is not an administrator of the Telegram group');}
 const client=await pool.connect();let locked=false;
 try{
  await client.query(communityTable);
  locked=(await client.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',['brill-telegram-community:'+chatId])).rows[0].acquired;
  if(!locked)throw new Error('Telegram community publication already running');
  await client.query("INSERT INTO telegram_community_publications(chat_id,publication_key,content_hash,status) VALUES($1,$2,$3,'published') ON CONFLICT(chat_id,publication_key) DO UPDATE SET content_hash=EXCLUDED.content_hash,status='published',updated_at=now()",[chatId,'target',hash('authorized-group:'+chatId)]);
  const configurationHash=hash(JSON.stringify(community));
  const configuration=await client.query('SELECT status,content_hash,message_id FROM telegram_community_publications WHERE chat_id=$1 AND publication_key=$2',[chatId,'configuration']);
  if(configuration.rows[0]?.content_hash!==configurationHash||configuration.rows[0]?.status!=='published'){
   for(const language_code of ['',...languages]){
    const copy=community.languages[language_code||'ru'];
    const commands=Object.entries(copy.commands).map(([command,description])=>({command,description}));
    await api('setMyCommands',{commands:commands.filter(c=>c.command!=='status'),scope:{type:'chat',chat_id:chatId},language_code});
   }
   const existingChat=await api('getChat',{chat_id:chatId});
   if(existingChat.description!==community.groupDescription){try{await api('setChatDescription',{chat_id:chatId,description:community.groupDescription});}catch(error){log('Telegram description update skipped: '+error.message);}}

   await client.query("INSERT INTO telegram_community_publications(chat_id,publication_key,content_hash,status) VALUES($1,$2,$3,'published') ON CONFLICT(chat_id,publication_key) DO UPDATE SET content_hash=EXCLUDED.content_hash,status='published',updated_at=now()",[chatId,'configuration',configurationHash]);
  }
  if(chat.is_forum&&!canManageTopics)log('Telegram topic creation deferred: bot missing can_manage_topics permission');
  if(chat.is_forum&&canManageTopics){
   for(const section of community.sections){
    const key='topic-'+section.key;
    const existing=(await client.query('SELECT message_id,status FROM telegram_community_publications WHERE chat_id=$1 AND publication_key=$2',[chatId,key])).rows[0];
    if(existing?.status==='published'&&existing.message_id)continue;
    if(existing?.status==='pending')throw new Error('Telegram topic creation uncertain: '+key);
    await client.query("INSERT INTO telegram_community_publications(chat_id,publication_key,content_hash,status) VALUES($1,$2,$3,'pending') ON CONFLICT(chat_id,publication_key) DO NOTHING",[chatId,key,hash(section.label.ru)]);
    let topic;try{topic=await api('createForumTopic',{chat_id:chatId,name:section.label.ru.slice(0,128)});}catch(error){if(!error.uncertain)await client.query("DELETE FROM telegram_community_publications WHERE chat_id=$1 AND publication_key=$2 AND status='pending'",[chatId,key]);throw error;}
    await client.query("UPDATE telegram_community_publications SET message_id=$3,status='published',updated_at=now() WHERE chat_id=$1 AND publication_key=$2",[chatId,key,topic.message_thread_id]);
    await api('sendMessage',{chat_id:chatId,message_thread_id:topic.message_thread_id,text:publicationText({translations:section.text}),disable_notification:true});
    log('Telegram forum topic ready: '+JSON.stringify({key,threadId:topic.message_thread_id}));
   }
  }else log('Telegram forum topics pending: enable Topics in Telegram group settings');
  const published=[];
  const posts=[...community.posts,...community.sections.map(s=>({key:'section-'+s.key,translations:Object.fromEntries(languages.map(lang=>[lang,s.text[lang]]))}))];
  for(const post of posts){
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
  if(updated.description!==community.groupDescription)log('Telegram community description differs; section setup continues');
  const groupCommands=await api('getMyCommands',{scope:{type:'chat',chat_id:chatId}});
  if(groupCommands.map(c=>c.command).sort().join(',')!=='help,request,sections,services,start,support')throw new Error('Telegram community commands verification failed');
  const pinned=published.find(p=>p.key==='welcome');
  if(updated.pinned_message?.message_id!==pinned.messageId)throw new Error('Telegram community pinned message verification failed');
  const result={version:community.version,chatId:String(chatId),title:updated.title,username:updated.username||null,posts:published,pinnedMessageId:pinned.messageId};
  log('Telegram community ready: '+JSON.stringify(result));return result;
 }finally{
  try{if(locked)await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',['brill-telegram-community:'+chatId]);}finally{client.release();}
 }
}
