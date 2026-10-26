/**
 * BRILL MEDIA domain model.
 * Pure functions only: all data is local demo state, never social-media activity.
 */
export const STORAGE_KEY = "brill-media-records-v1";

export const PROJECTS = [
  { id:"brill-team", name:"BRILL TEAM PROJECT", kind:"STUDIO", tone:"creative",
    detail:{ru:"Разработка сайтов, CRM и цифровых продуктов.",he:"פיתוח אתרים, מערכות CRM ומוצרים דיגיטליים.",en:"Websites, CRM systems and digital products."}},
  { id:"nexus", name:"NEXUS BRILL CITY", kind:"GAMING", tone:"gaming",
    detail:{ru:"Игровой мир и сообщество. Продвижение через истории игроков.",he:"עולם משחקים וקהילה. קידום באמצעות סיפורי שחקנים.",en:"Gaming world and community. Stories built around players."}},
  { id:"transit", name:"TRANSIT INSPECT PRO", kind:"B2B / MOBILITY", tone:"business",
    detail:{ru:"Профессиональные инструменты для транспортных компаний.",he:"כלים מקצועיים לחברות תחבורה.",en:"Professional tools for transport companies."}},
  { id:"brillpay", name:"BRILL PAY", kind:"FINTECH / CONCEPT", tone:"fintech",
    detail:{ru:"Финтех-прототип. Никаких заявлений о действующем банке или платёжном сервисе.",he:"אב-טיפוס פינטק, לא שירות בנקאות או תשלומים פעיל.",en:"Fintech prototype, not an operating bank or payment service."}},
  { id:"sheleg", name:"SHELEG TV", kind:"STREAMING / RIGHTS REVIEW", tone:"media",
    detail:{ru:"Проект телевидения. Публикации с материалами вещателей — только после проверки прав.",he:"מיזם טלוויזיה. פרסום תוכן של גופי שידור כפוף לבדיקת זכויות.",en:"TV concept. Broadcaster assets must clear rights review before use."}},
  { id:"bavzo", name:"BAVZO MAIL", kind:"COMMUNICATION", tone:"digital",
    detail:{ru:"Концепция собственной почтовой платформы.",he:"קונספט לפלטפורמת דואר אלקטרוני עצמאית.",en:"Concept for an independent email platform."}}
];

export const CHANNELS = ["YouTube","TikTok","Instagram","Facebook","Telegram","LinkedIn"];
export const STATUSES = ["draft","review","scheduled"];

export const DEMO_RECORDS = [
  { id:"demo-one", project:"brill-team", channel:"LinkedIn", language:"en", status:"review", date:"2026-10-30", demo:true,
    title:{ru:"BRILL TEAM — одна студия, множество продуктов",he:"BRILL TEAM — סטודיו אחד, מוצרים רבים",en:"BRILL TEAM — one studio, many products"},
    notes:{ru:"Короткая история о разработке собственных цифровых продуктов.",he:"סיפור קצר על פיתוח מוצרים דיגיטליים.",en:"An introduction to independent digital product development."}},
  { id:"demo-two", project:"nexus", channel:"YouTube", language:"ru", status:"draft", date:"", demo:true,
    title:{ru:"NEXUS BRILL CITY — концепция игрового трейлера",he:"NEXUS BRILL CITY — רעיון לטריילר",en:"NEXUS BRILL CITY — game trailer concept"},
    notes:{ru:"Показать атмосферу мира без обещаний о непроверенных функциях.",he:"להציג את האווירה בלי להבטיח יכולות שטרם נבדקו.",en:"Show the game atmosphere without promising unverified features."}},
  { id:"demo-three", project:"transit", channel:"LinkedIn", language:"he", status:"scheduled", date:"2026-11-03", demo:true,
    title:{ru:"TRANSIT INSPECT — презентация для операторов",he:"TRANSIT INSPECT — היכרות למפעילי תחבורה",en:"TRANSIT INSPECT — introduction for operators"},
    notes:{ru:"B2B-концепция. Запланировано только в редакции, без отправки на LinkedIn.",he:"תכנון בלבד, ללא פרסום ב-LinkedIn.",en:"Editorial plan only; no LinkedIn publishing connected."}},
  { id:"demo-four", project:"brillpay", channel:"Instagram", language:"en", status:"draft", date:"", demo:true,
    title:{ru:"BRILL PAY — визуальный обзор прототипа",he:"BRILL PAY — הצצה לאב-טיפוס",en:"BRILL PAY — prototype visual preview"},
    notes:{ru:"Ясно обозначать как концепт и тестовую демонстрацию.",he:"לציין בבירור שמדובר בקונספט והדגמה.",en:"Clearly present the product as a prototype and demo."}},
  { id:"demo-five", project:"sheleg", channel:"Telegram", language:"ru", status:"review", date:"", demo:true,
    title:{ru:"SHELEG TV — анонс идеи сервиса",he:"SHELEG TV — הצגת רעיון השירות",en:"SHELEG TV — announcing the concept"},
    notes:{ru:"Нельзя использовать кадры и логотипы вещателей без подтверждения прав.",he:"אין להשתמש בצילומים ולוגואים של גופי שידור ללא אישור.",en:"No broadcaster footage or logos without verified rights."}}
];

export function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
}
export function localized(value, lang="ru") {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  return value[lang] || value.ru || value.en || "";
}
export function projectById(id) { return PROJECTS.find(p=>p.id===id); }
export function validDate(date) {
  if (date === "") return true;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date+"T12:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0,10)===date;
}
export function validateRecord(record) {
  if (!record || typeof record !== "object") return "invalid";
  if (typeof record.title !== "string" || !record.title.trim() || record.title.trim().length>140) return "title";
  if (!projectById(record.project)) return "project";
  if (!CHANNELS.includes(record.channel)) return "channel";
  if (!["ru","he","en"].includes(record.language)) return "language";
  if (!STATUSES.includes(record.status)) return "status";
  if (!validDate(record.date || "")) return "date";
  if (record.status==="scheduled" && !record.date) return "requiredDate";
  if (record.project==="sheleg" && record.status==="scheduled") return "rightsHold";
  if (typeof record.notes!=="string" || record.notes.length>2000) return "notes";
  return null;
}
export function normalizeRecords(value) {
  if (!Array.isArray(value)) return DEMO_RECORDS.map(r=>({...r}));
  return value.slice(0,500).filter(r=>
    r && typeof r.id==="string" && r.id.length<100 && !!projectById(r.project)
    && CHANNELS.includes(r.channel) && ["ru","he","en"].includes(r.language)
    && STATUSES.includes(r.status) && validDate(r.date || "")
    && (typeof r.title==="string" ? r.title.trim().length>0 && r.title.length<=140
      : r.demo===true && typeof localized(r.title,"ru")==="string")
    && (typeof r.notes==="string" ? r.notes.length<=2000
      : r.demo===true && typeof localized(r.notes,"ru")==="string")
  );
}
export function countByStatus(records) {
  return {
    projects:new Set(records.map(r=>r.project)).size,
    draft:records.filter(r=>r.status==="draft").length,
    review:records.filter(r=>r.status==="review").length,
    scheduled:records.filter(r=>r.status==="scheduled").length,
    total:records.length
  };
}
export function futureSchedule(records) {
  return records.filter(r=>r.date && validDate(r.date))
    .sort((a,b)=>a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
}
export function displayDate(date,lang) {
  if (!date || !validDate(date)) return "—";
  const locale = {ru:"ru-RU",he:"he-IL",en:"en-US"}[lang]||"ru-RU";
  return new Intl.DateTimeFormat(locale,{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})
    .format(new Date(date+"T12:00:00Z"));
}
