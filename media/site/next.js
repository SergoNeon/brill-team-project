/* BRILL MEDIA secondary pages: accessible navigation, local campaign planner, motion reel. */
(()=>{
"use strict";
const copy=window.BRILL_EXTRA_COPY||{};
const langKey="brill-media-site-lang-v1";
let lang="ru";
try{const v=localStorage.getItem(langKey);if(copy[v])lang=v;}catch{}
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s)),t=k=>(copy[lang]||copy.ru||{})[k]||k;
const projects={"brill-team":"BRILL TEAM PROJECT",nexus:"NEXUS BRILL CITY",transit:"TRANSIT INSPECT PRO",brillpay:"BRILL PAY"};
const channels=["Instagram","TikTok","YouTube","Telegram","Facebook","LinkedIn"];
let onLangChange=()=>{};
function translate(next){
 if(!copy[next])return;lang=next;document.documentElement.lang=lang;document.documentElement.dir=lang==="he"?"rtl":"ltr";
 $$("[data-x]").forEach(el=>{el.textContent=t(el.dataset.x)});
 $$("[data-language]").forEach(el=>{const selected=el.dataset.language===lang;el.classList.toggle("active",selected);el.setAttribute("aria-pressed",String(selected))});
 const p=document.body.dataset.page;document.title=t({portfolio:"pagePortfolioTitle",reel:"pageReelTitle",tools:"pageToolsTitle",services:"pageServicesTitle"}[p]||"pagePortfolioTitle");
 try{localStorage.setItem(langKey,lang)}catch{}
 onLangChange();
}
const nav=$("#primary-nav"),toggle=$("#menu-toggle");
function closeMenu(){nav.classList.remove("open");toggle.setAttribute("aria-expanded","false");}
if(nav&&toggle){toggle.addEventListener("click",()=>{const open=!nav.classList.contains("open");nav.classList.toggle("open",open);toggle.setAttribute("aria-expanded",String(open))});nav.querySelectorAll("a").forEach(a=>a.addEventListener("click",closeMenu));document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeMenu();toggle.focus()}});document.addEventListener("click",e=>{if(!nav.contains(e.target)&&!toggle.contains(e.target))closeMenu()});}
$$("[data-language]").forEach(el=>el.addEventListener("click",()=>{translate(el.dataset.language);closeMenu()}));
const page=document.body.dataset.page;
if(page==="reel"){
 const scenesImages=[
 "https://images.unsplash.com/photo-1650765814773-d99b321a0124?auto=format&fit=crop&w=1600&q=84",
 "https://images.unsplash.com/photo-1609675077114-e9060daf2ff9?auto=format&fit=crop&w=1600&q=84",
 "https://images.unsplash.com/photo-1686823868715-cd44da513b9b?auto=format&fit=crop&w=1600&q=84",
 "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=84",
 "https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=1600&q=84"];
 const duration=5600;let index=0,playing=false,elapsed=0,lastTime=0,raf=0;
 const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 function frame(){
 const scenes=t("reelScenes");const item=scenes[index]||scenes[0];
 $("#reel-image").src=scenesImages[index];$("#reel-eyebrow").textContent=item.eyebrow;
 $("#reel-title").textContent=item.title;$("#reel-line").textContent=item.line;$("#reel-footer").textContent=item.footer;
 $("#reel-count").textContent=String(index+1).padStart(2,"0")+" / "+String(scenes.length).padStart(2,"0");
 $("#reel-play").textContent=t(playing?"reelPause":elapsed?"reelResume":"reelStart");
 $("#reel-progress").style.width=(elapsed/duration*100)+"%";
 $("#reel-stage").classList.remove("reel-enter");void $("#reel-stage").offsetWidth;$("#reel-stage").classList.add("reel-enter");
 }
 function next(step){index=(index+step+scenesImages.length)%scenesImages.length;elapsed=0;frame();}
 function tick(now){if(!playing)return;if(!lastTime)lastTime=now;elapsed+=Math.min(now-lastTime,100);lastTime=now;if(elapsed>=duration){next(1)}$("#reel-progress").style.width=Math.min(100,elapsed/duration*100)+"%";raf=requestAnimationFrame(tick);}
 function togglePlay(){playing=!playing;lastTime=0;if(playing){raf=requestAnimationFrame(tick)}else{cancelAnimationFrame(raf)}frame();}
 $("#reel-prev").addEventListener("click",()=>next(-1));$("#reel-next").addEventListener("click",()=>next(1));
 $("#reel-play").addEventListener("click",togglePlay);$("#reel-full").addEventListener("click",()=>{const e=$("#reel-stage");if(document.fullscreenElement)document.exitFullscreen?.();else e.requestFullscreen?.();});
 $("#reel-stage").addEventListener("keydown",e=>{if(e.key==="ArrowRight"){e.preventDefault();next(1)}if(e.key==="ArrowLeft"){e.preventDefault();next(-1)}if(e.key===" "){e.preventDefault();togglePlay()}});
 document.addEventListener("visibilitychange",()=>{if(document.hidden&&playing)togglePlay()});
 onLangChange=frame;frame();
}
if(page==="tools"){
 const storageKey="brill-media-site-drafts-v1";let drafts=[];let current=null,delId=null;
 try{const parsed=JSON.parse(localStorage.getItem(storageKey)||"[]");if(Array.isArray(parsed))drafts=parsed.filter(x=>x&&typeof x==="object"&&typeof x.id==="string"&&typeof x.text==="string").slice(0,250)}catch{}
 const toast=message=>{$("#tool-status").textContent=message};
 const input=(form,name)=>form.elements.namedItem(name).value.trim();
 function save(){try{localStorage.setItem(storageKey,JSON.stringify(drafts));return true}catch{toast(t("toolStorageError"));return false}}
 function escapeText(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
 function render(){
 const box=$("#draft-list");box.replaceChildren();
 if(!drafts.length){const p=document.createElement("p");p.className="tool-minor";p.textContent=t("toolNone");box.append(p);return}
 drafts.slice().reverse().forEach(row=>{
 const e=document.createElement("article");e.className="draft-item";
 const title=document.createElement("strong");title.textContent=row.project+" · "+row.platform;
 const meta=document.createElement("p");meta.textContent=row.audience+" · "+(row.date||"—");
 const actions=document.createElement("div");actions.className="draft-actions";
 const copy=document.createElement("button");copy.type="button";copy.className="link-btn";copy.textContent=t("toolCopy");copy.addEventListener("click",()=>copyToClipboard(row.text));
 const remove=document.createElement("button");remove.type="button";remove.className="link-btn danger";remove.textContent=t("toolDelete");remove.addEventListener("click",()=>{delId=row.id;const approved=window.confirm(t("toolDeleteConfirm"));if(approved){drafts=drafts.filter(x=>x.id!==delId);save();render();toast(t("toolDeletedNotice"))}});
 actions.append(copy,remove);e.append(title,meta,actions);box.append(e);
 });
 }
 function makeBrief(record){
 return [t("toolBriefHeader"),"",t("toolProject")+": "+record.project,t("toolPlatform")+": "+record.platform,
 t("toolGoal")+": "+t(record.goal),t("toolAudience")+": "+record.audience,
 t("toolHook")+": "+record.hook,t("toolAction")+": "+(record.cta||"—"),t("toolDate")+": "+(record.date||"—"),"",t("toolBriefFooter")].join("\n");
 }
 const brief=$("#brief-form");
 brief.addEventListener("submit",e=>{
 e.preventDefault();const audience=input(brief,"audience"),hook=input(brief,"hook");
 if(!audience||!hook){const error=$("#brief-error");error.hidden=false;error.textContent=t(!audience?"toolAudienceRequired":"toolTitleRequired");brief.elements.namedItem(!audience?"audience":"hook").focus();return}
 $("#brief-error").hidden=true;
 current={project:projects[input(brief,"project")]||"BRILL TEAM PROJECT",platform:input(brief,"platform"),goal:input(brief,"goal"),audience,hook,cta:input(brief,"cta"),date:input(brief,"date")};
 $("#brief-output").textContent=makeBrief(current);$("#brief-result").hidden=false;$("#brief-output").focus();
 });
 brief.addEventListener("reset",()=>{$("#brief-result").hidden=true;$("#brief-error").hidden=true;current=null});
 $("#save-brief").addEventListener("click",()=>{if(!current)return;const id=globalThis.crypto?.randomUUID?.()||Date.now().toString(36);drafts.push({id,...current,text:makeBrief(current)});if(drafts.length>250)drafts=drafts.slice(-250);if(save())toast(t("toolSavedNotice"));render()});
 async function copyToClipboard(text){try{await navigator.clipboard.writeText(text);toast(t("toolCopied"))}catch{toast(t("toolCopyFailed"))}}
 $("#copy-brief").addEventListener("click",()=>{if(current)copyToClipboard(makeBrief(current))});
 function download(name,text,type){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
 $("#download-brief").addEventListener("click",()=>{if(current)download("brill-media-brief.txt",makeBrief(current),"text/plain;charset=utf-8")});
 $("#export-briefs").addEventListener("click",()=>{const quote=x=>'"'+String(x??"").replace(/"/g,'""')+'"';const rows=[["project","platform","goal","audience","hook","cta","date"],...drafts.map(r=>[r.project,r.platform,r.goal,r.audience,r.hook,r.cta,r.date])];download("brill-media-campaigns.csv","\uFEFF"+rows.map(r=>r.map(quote).join(",")).join("\r\n"),"text/csv;charset=utf-8")});
 $("#utm-form").addEventListener("submit",e=>{
 e.preventDefault();const f=e.currentTarget,err=$("#utm-error");let url;
 try{url=new URL(input(f,"url"));if(!["http:","https:"].includes(url.protocol)||!url.hostname||url.username||url.password)throw Error()}catch{err.hidden=false;err.textContent=t("toolInvalidUrl");f.elements.namedItem("url").focus();return}
 const campaign=input(f,"campaign");if(!campaign){err.hidden=false;err.textContent=t("toolInvalidCampaign");f.elements.namedItem("campaign").focus();return}
 err.hidden=true;url.searchParams.set("utm_source",input(f,"source"));url.searchParams.set("utm_medium",input(f,"medium"));url.searchParams.set("utm_campaign",campaign);
 $("#utm-output").value=url.toString();$("#utm-result").hidden=false;
 });
 $("#copy-utm").addEventListener("click",()=>copyToClipboard($("#utm-output").value));
 const preset=new URLSearchParams(location.search).get("project");if(projects[preset])$("#brief-project").value=preset;
 onLangChange=()=>{render();if(current)$("#brief-output").textContent=makeBrief(current)};render();
}
translate(lang);
})();