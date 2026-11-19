import http from 'node:http';
import dgram from 'node:dgram';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const host='127.0.0.1';
const port=Number(process.env.BRILL_PORT || 28915);
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'../public');
const catalog=[{id:'brill-mobile-rp',name:'BRILL MOBILE RP',address:'77.42.93.209',port:27877,mode:'ROLEPLAY',language:'Русский',region:'Европа',website:'https://nexus.brill.city:28912/',description:'Официальный игровой сервер BRILL Team Project',featured:true}];
let lastFetch=0, lastStatus={online:0,maxPlayers:500,available:false,checkedAt:null,serverName:null};
function sampInfo(ip,port){
 return new Promise((resolve,reject)=>{
  const client=dgram.createSocket('udp4');let complete=false;
  const timer=setTimeout(()=>finish(new Error('udp timeout')),2200);
  function finish(err,data){if(complete)return;complete=true;clearTimeout(timer);client.close();err?reject(err):resolve(data)}
  client.on('error',err=>finish(err));
  client.on('message',buffer=>{
   try{
    const sent=Buffer.alloc(11);sent.write('SAMP',0,'ascii');ip.split('.').map(Number).forEach((x,i)=>sent[4+i]=x);sent.writeUInt16LE(port,8);sent[10]=105;
    if(!buffer.subarray(0,11).equals(sent)||buffer.length<20) return finish(new Error('bad samp response'));
    const players=buffer.readUInt16LE(12);const maxPlayers=buffer.readUInt16LE(14);const length=buffer.readUInt32LE(16);
    if(length>512||buffer.length<20+length) return finish(new Error('invalid samp name'));
    finish(null,{online:players,maxPlayers,available:true,serverName:buffer.subarray(20,20+length).toString('latin1'),checkedAt:new Date().toISOString()});
   }catch(e){finish(e)}
  });
  const req=Buffer.alloc(11);req.write('SAMP');ip.split('.').map(Number).forEach((x,i)=>req[4+i]=x);req.writeUInt16LE(port,8);req[10]=105;
  client.send(req,port,ip,err=>{if(err)finish(err)});
 });
}
async function currentStatus(){
 if(Date.now()-lastFetch < 15000) return lastStatus;
 lastFetch=Date.now();
 try{lastStatus=await sampInfo(catalog[0].address,catalog[0].port)}
 catch{lastStatus={online:0,maxPlayers:500,available:false,serverName:null,checkedAt:new Date().toISOString()}}
 return lastStatus;
}
function sendJson(res,obj,status=200){const body=JSON.stringify(obj);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body)}
const server=http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){return sendJson(res,{error:'Method not allowed'},405)}
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/v1/health')return sendJson(res,{ok:true,app:'BRILL MULTIPLAYER',build:'0.1.0'});
  if(url.pathname==='/api/v1/servers'){
   const status=await currentStatus();return sendJson(res,{brand:'BRILL MULTIPLAYER',updatedAt:new Date().toISOString(),servers:catalog.map(x=>({...x,...status}))});
  }
  if(url.pathname==='/api/v1/servers/brill-mobile-rp')return sendJson(res,{server:{...catalog[0],...await currentStatus()}});
  const filename=url.pathname==='/'?'/index.html':url.pathname;
  if(filename.includes('..')||!['/index.html','/styles.css','/app.js'].includes(filename))return sendJson(res,{error:'Not found'},404);
  const mime=filename.endsWith('css')?'text/css; charset=utf-8':filename.endsWith('js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8';
  const content=await readFile(path.join(root,filename));res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:content);
 }catch(e){console.error('BRILL API error',e?.message);sendJson(res,{error:'Service error'},500)}
});
server.listen(port,host,()=>console.log(`BRILL MULTIPLAYER API at http://${host}:${port}`));