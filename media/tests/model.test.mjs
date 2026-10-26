import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  DEMO_RECORDS, PROJECTS, CHANNELS, escapeHtml, localized, validDate,
  validateRecord, normalizeRecords, countByStatus, futureSchedule, displayDate
} from "../model.mjs";

const valid = () => ({
  title:"New campaign",project:"brill-team",channel:"Instagram",
  language:"ru",status:"draft",date:"",notes:"Brief"
});

test("seed records refer to known projects and channels",()=>{
  assert.equal(DEMO_RECORDS.length,5);
  for (const r of DEMO_RECORDS) {
    assert.ok(PROJECTS.some(p=>p.id===r.project));
    assert.ok(CHANNELS.includes(r.channel));
    assert.ok(["draft","review","scheduled"].includes(r.status));
    assert.ok(localized(r.title,"he"));
  }
});
test("project counts reflect records, not fabricated analytics",()=>{
  assert.deepEqual(countByStatus(DEMO_RECORDS),{
    projects:5,draft:2,review:2,scheduled:1,total:5
  });
});
test("content is escaped before insertion into HTML",()=>{
  assert.equal(escapeHtml('<script>alert("x")</script>'),
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  assert.equal(escapeHtml("O'Reilly & team"),"O&#39;Reilly &amp; team");
});
test("localized seed content has Russian, English and Hebrew",()=>{
  for (const r of DEMO_RECORDS) {
    for (const lang of ["ru","en","he"]) {
      assert.equal(typeof localized(r.title,lang),"string");
      assert.ok(localized(r.title,lang).length>0);
    }
  }
});
test("date validation rejects invalid date and accepts real dates",()=>{
  assert.equal(validDate(""),true);
  assert.equal(validDate("2026-10-26"),true);
  assert.equal(validDate("2026-02-30"),false);
  assert.equal(validDate("2026-11-31"),false);
  assert.equal(validDate("10/26/2026"),false);
  assert.ok(displayDate("2026-10-26","he").length>2);
});
test("scheduled campaigns require valid date",()=>{
  const r=valid();
  r.status="scheduled";
  assert.equal(validateRecord(r),"requiredDate");
  r.date="2026-11-04";
  assert.equal(validateRecord(r),null);
  r.date="2026-02-30";
  assert.equal(validateRecord(r),"date");
});
test("SHELEG TV scheduling held until rights clearance",()=>{
  const r=valid();
  r.project="sheleg";
  r.status="scheduled";
  r.date="2026-11-04";
  assert.equal(validateRecord(r),"rightsHold");
  r.status="review";
  assert.equal(validateRecord(r),null);
});
test("validation rejects missing or overly long title",()=>{
  const r=valid();
  r.title=" ";
  assert.equal(validateRecord(r),"title");
  r.title="x".repeat(141);
  assert.equal(validateRecord(r),"title");
  r.title="Valid";
  assert.equal(validateRecord(r),null);
});
test("corrupt storage data is dropped and valid items retained",()=>{
  const kept={id:"local-1",...valid()};
  const normalized=normalizeRecords([kept,{id:"bad",project:"unknown"}]);
  assert.equal(normalized.length,1);
  assert.equal(normalized[0].id,"local-1");
  assert.equal(normalizeRecords([]).length,0);
});
test("calendar sorts dated records without changing originals",()=>{
  const original=DEMO_RECORDS.map(r=>r.id);
  const ordered=futureSchedule(DEMO_RECORDS);
  assert.deepEqual(ordered.map(r=>r.id),["demo-one","demo-three"]);
  assert.deepEqual(DEMO_RECORDS.map(r=>r.id),original);
});
test("static app is accessible by relative paths on GitHub Pages",()=>{
  const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
  assert.match(html,/lang="ru"/);
  assert.match(html,/href="\.\/styles\.css"/);
  assert.match(html,/src="\.\/app\.mjs"/);
  assert.match(html,/id="editorForm" novalidate/);
  assert.match(html,/role="alertdialog"/);
  assert.match(html,/data-lang="he"/);
  assert.match(html,/data-view="calendar"/);
});
