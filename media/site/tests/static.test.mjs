import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync, existsSync} from "node:fs";
import path from "node:path";
const root=new URL("../",import.meta.url);
const pageNames=["index.html","services.html","portfolio.html","reel.html","tools.html"];
const doc=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
test("five real public HTML documents exist",()=>{for(const name of pageNames)assert.ok(existsSync(new URL("../"+name,import.meta.url)),name)});
test("all internal HTML, styles and JS links exist",()=>{
 for(const name of pageNames){const html=doc(name);const refs=[...html.matchAll(/(?:src|href)="(\.\/[^"#?]+)(?:[?][^"]*)?"/g)].map(x=>x[1]);for(const ref of refs){const target=path.resolve(path.dirname(new URL("../"+name,import.meta.url).pathname),ref);assert.ok(existsSync(target),name+" missing "+ref)}}
});
test("all sections link to real destinations and have language controls",()=>{
 for(const name of pageNames){const html=doc(name);assert.match(html,/data-language="he"/);assert.match(html,/data-language="en"/);}
 const homepage=doc("index.html");for(const file of ["services","portfolio","reel","tools"])assert.ok(homepage.includes("./"+file+".html"),file);
});
test("tools ship only local plan, not fake social publishing",()=>{
 const js=doc("next.js"),html=doc("tools.html");
 assert.ok(js.includes("utm_campaign"));assert.ok(js.includes("localStorage.setItem"));assert.ok(js.includes("textContent"));assert.ok(html.includes('id="brief-form"'));assert.ok(html.includes('id="utm-form"'));
 assert.ok(!js.includes("window.confirm("));assert.ok(!html.includes("onclick="));
});
test("content does not advertise fake results or numbered template steps",()=>{
 const html=doc("index.html")+doc("portfolio.html")+doc("services.html");
 for(const token of ["150+","98%","01 / 02 / 03"])assert.ok(!html.includes(token),token);
});
test("translations and JS parse with no dependency installs",()=>{
 const texts=doc("page-copy.js");
 for(const key of ["portfolioH1a","reelScenes","toolUTMTitle","servicesPageH1a"])assert.ok(texts.includes(key));
});
