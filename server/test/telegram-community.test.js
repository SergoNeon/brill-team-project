import test from 'node:test';
import assert from 'node:assert/strict';
import {community,isAuthorizedCommunityStart,publicationText,publicTelegramAnswer,setupTelegramCommunity} from '../src/telegram-community.js';

function fixture({title=community.groupTitle,username=community.botUsername,canPin=true,timeoutSend=false,type='supergroup'}={}){
 const rows=new Map(),calls=[],messages=[];let pinned,description='',locked=false;
 const client={release(){},async query(sql,args=[]){
  if(sql.startsWith('CREATE TABLE'))return {rows:[]};
  if(sql.includes('pg_try_advisory_lock')){locked=true;return {rows:[{acquired:true}]};}
  if(sql.includes('pg_advisory_unlock')){locked=false;return {rows:[{}]};}
  if(sql.startsWith('SELECT status'))return {rows:rows.has(args[1])?[{...rows.get(args[1])}]:[]};
  if(sql.startsWith('SELECT chat_id'))return {rows:rows.has('target')?[{chat_id:rows.get('target').chat_id}]:[]};
  if(sql.startsWith('INSERT INTO telegram_community_publications')){
   rows.set(args[1],{chat_id:args[0],content_hash:args[2],status:['configuration','profile','target'].includes(args[1])?'published':'pending',message_id:null});return {rows:[]};
  }
  if(sql.startsWith('UPDATE telegram_community_publications')){
   const row=rows.get(args[1]);
   if(sql.includes('message_id=$3'))Object.assign(row,{message_id:args[2],status:'published'});
   else row.content_hash=args[2];return {rows:[]};
  }
  if(sql.startsWith('DELETE FROM telegram_community_publications')){rows.delete(args[1]);return {rows:[]};}
  assert.fail('Unexpected publication query');
 }};
 const menus=new Map(),descriptions=new Map(),shorts=new Map();
 const fetchApi=async(url,options)=>{
  const method=String(url).split('/').at(-1),body=JSON.parse(options.body);calls.push({method,body});
  let result=true;
  if(method==='getMe')result={id:123,username};
  if(method==='getChat')result={id:body.chat_id,title,type,description,pinned_message:pinned?{message_id:pinned}:undefined};
  if(method==='getChatMember')result={status:'administrator',can_change_info:true,can_pin_messages:canPin};
  if(method==='setChatDescription')description=body.description;
  if(method==='setMyCommands')menus.set(JSON.stringify([body.scope,body.language_code||'']),body.commands);
  if(method==='getMyCommands')result=menus.get(JSON.stringify([body.scope,body.language_code||'']))||[];
  if(method==='setMyDescription')descriptions.set(body.language_code||'',body.description);
  if(method==='setMyShortDescription')shorts.set(body.language_code||'',body.short_description);
  if(method==='getMyDescription')result={description:descriptions.get(body.language_code||'')};
  if(method==='getMyShortDescription')result={short_description:shorts.get(body.language_code||'')};
  if(method==='sendMessage'){
   if(timeoutSend)throw new TypeError('Isolated timeout');
   result={message_id:100+messages.length};messages.push({id:result.message_id,text:body.text});
  }
  if(method==='pinChatMessage')pinned=body.message_id;
  return new Response(JSON.stringify({ok:true,result}),{status:200});
 };
 return {pool:{connect:async()=>client,query:client.query},options:{token:'isolated-test-token',chatId:'-100123',fetchApi,log(){}},rows,calls,messages,get locked(){return locked;}};
}

test('public Telegram copy fits platform limits and supports RU/HE/EN',()=>{
 assert.ok(community.groupDescription.length<=255);
 for(const post of community.posts)assert.ok(publicationText(post).length<=4096);
 for(const [lang,copy]of Object.entries(community.languages)){
  assert.ok(copy.description.length<=512);assert.ok(copy.shortDescription.length<=120);
  assert.equal(Object.keys(copy.commands).length,6);
  assert.equal(publicTelegramAnswer('/services',lang),copy.directions+'\n\n'+community.siteUrl);
  assert.equal(publicTelegramAnswer('/reply',lang),null);
 }
 assert.equal(publicTelegramAnswer('/services','he-IL'),publicTelegramAnswer('/services','he'));
});
test('publishes three posts, pins navigation and does not duplicate posts after restart',async()=>{
 const f=fixture();
 const first=await setupTelegramCommunity(f.pool,f.options);
 assert.equal(first.posts.length,3);assert.equal(first.pinnedMessageId,100);
 assert.equal(f.messages.length,3);assert.equal(f.rows.size,6);assert.equal(f.locked,false);
 const commandChanges=f.calls.filter(c=>c.method==='setMyCommands').length;
 const again=await setupTelegramCommunity(f.pool,f.options);
 assert.deepEqual(again,first);assert.equal(f.messages.length,3);
 assert.equal(f.calls.filter(c=>c.method==='setMyCommands').length,commandChanges);
 for(const call of f.calls.filter(c=>c.method==='setMyCommands'&&c.body.scope.type==='chat'))assert.ok(!call.body.commands.some(c=>c.command==='reply'||c.command==='status'));
});
test('refuses another group or bot before posting to a group',async()=>{
 for(const options of [{title:'Another project'},{username:'another_bot'}]){
  const f=fixture(options);
  await assert.rejects(setupTelegramCommunity(f.pool,f.options),/does not match/);
  assert.equal(f.messages.length,0);assert.ok(!f.rows.has('target'));
  assert.ok(!f.calls.some(c=>c.method==='setChatDescription'||c.method==='pinChatMessage'));
 }
});
test('checks administrator permissions before publishing',async()=>{
 const f=fixture({canPin:false});
 await assert.rejects(setupTelegramCommunity(f.pool,f.options),/permissions/);
 assert.equal(f.messages.length,0);assert.ok(!f.rows.has('target'));
});
test('fills the bot profile while refusing to publish group posts to a private chat',async()=>{
 const f=fixture({type:'private'});
 const result=await setupTelegramCommunity(f.pool,{...f.options,chatId:'123456789',ownerUserId:'123456789'});
 assert.equal(result.waitingForGroup,true);assert.equal(result.ownerBindingConfigured,true);
 assert.equal(f.rows.get('profile').status,'published');assert.equal(f.messages.length,0);
 assert.ok(!f.calls.some(c=>c.method==='setChatDescription'||c.method==='pinChatMessage'));
});
test('only the configured owner can bind the named group with a start command',()=>{
 const message={text:'/start@brillteamprojectbot',from:{id:123},chat:{id:-100123,type:'supergroup',title:community.groupTitle}};
 assert.equal(isAuthorizedCommunityStart(message,'123'),true);
 assert.equal(isAuthorizedCommunityStart(message,'456'),false);
 assert.equal(isAuthorizedCommunityStart(message,''),false);
 assert.equal(isAuthorizedCommunityStart({...message,chat:{...message.chat,type:'private'}},'123'),false);
 assert.equal(isAuthorizedCommunityStart({...message,chat:{...message.chat,title:'Other group'}},'123'),false);
 assert.equal(isAuthorizedCommunityStart({...message,text:'/services'},'123'),false);
});
test('does not resend when a network timeout leaves delivery uncertain',async()=>{
 const f=fixture({timeoutSend:true});
 await assert.rejects(setupTelegramCommunity(f.pool,f.options),/outcome unknown/);
 assert.equal(f.rows.get('welcome').status,'pending');assert.equal(f.locked,false);
 await assert.rejects(setupTelegramCommunity(f.pool,f.options),/uncertain previous outcome/);
 assert.equal(f.calls.filter(c=>c.method==='sendMessage').length,1);assert.equal(f.locked,false);
});
