import {
  STORAGE_KEY, PROJECTS, CHANNELS, STATUSES, DEMO_RECORDS,
  escapeHtml, localized, projectById, validateRecord, normalizeRecords,
  countByStatus, futureSchedule, displayDate
} from "./model.mjs";

const translations = {
  ru: {
    skip:"Перейти к содержимому",workspace:"РАБОЧЕЕ ПРОСТРАНСТВО",
    navOverview:"Обзор",navContent:"Контент",navCalendar:"Календарь",navProjects:"Проекты",navAbout:"О студии",
    demoOnly:"Демонстрационный режим",
    storageDisclosure:"Изменения сохраняются только в этом браузере. Публикации в соцсети не отправляются.",
    memoryOnly:"Хранилище недоступно: изменения останутся только до обновления страницы.",
    backToBrill:"← Brill Team Project",newContent:"Новый материал",
    eyebrow:"СОБСТВЕННАЯ МЕДИАСТУДИЯ · BRILL",
    heroTitle:"Не просто создавать.<br><em>Быть замеченными.</em>",
    heroText:"Все наши идеи, продукты и истории — в одной редакции. Планируем, создаём и готовим продвижение без огромных рекламных бюджетов.",
    createBrief:"Создать материал",exploreProjects:"Наши проекты",
    heroFootnote:"Внутренний инструмент · Без рекламных расходов · Без подключённых соцсетей",
    liveWorkspace:"РЕДАКЦИОННЫЙ ПУЛЬТ",overviewTitle:"Вся работа. В одном месте.",
    demoData:"ДЕМО / ЛОКАЛЬНО",productionQueue:"ПРОИЗВОДСТВО",recentHeading:"Редакционная очередь",
    showAll:"Все материалы →",channelsOverline:"ПЛОЩАДКИ",channelsHeading:"Где рассказываем",
    channelDisclaimer:"Количество запланированных идей, не реальные просмотры или публикации.",
    mission:"Наша задача — не просто больше контента. Наша задача — чтобы каждый материал работал на конкретный продукт.",
    libraryOverline:"МАТЕРИАЛЫ И КАМПАНИИ",contentTitle:"Контент-план",
    contentDescription:"Рабочие черновики, проверки и запланированные материалы. Ничего не публикуется автоматически.",
    searchLabel:"Поиск материалов",searchPlaceholder:"Название или проект...",filterLabel:"Статус",
    allStatuses:"Все статусы",draft:"Черновик",review:"На проверке",scheduled:"Запланировано",
    addMaterial:"Добавить материал",
    scheduleOverline:"ПЛАН ПУБЛИКАЦИЙ",calendarTitle:"Календарь редакции",
    calendarDescription:"Материалы с плановой датой. Это план — отправки в соцсети пока не подключены.",
    ecosystemOverline:"НАША ЭКОСИСТЕМА",projectsTitle:"Каждому проекту — свой голос.",
    projectsDescription:"Выбираем подходящий формат и аудиторию, не смешивая игровые, потребительские и B2B-продукты.",
    rightsHeading:"Перед публикацией",
    rightsText:"Материалы с чужими логотипами, кадрами, музыкой и вещательным контентом требуют проверки прав. В особенности SHELEG TV.",
    studioOverline:"СТРАТЕГИЯ BRILL MEDIA",aboutTitle:"Сначала продвигаем своё. Затем — бизнес клиентов.",
    aboutDescription:"Независимая студия внутри Brill Team Project: контент-стратегия, видеопродакшн, социальные площадки и аналитика в едином процессе.",
    capOneTitle:"Контент и видео",capOneText:"Трейлеры продуктов, короткие вертикальные видео, презентации и визуальные истории.",
    capTwoTitle:"Органический рост",capTwoText:"Планирование каналов, сообществ, партнёрств и понятных целей без слепой закупки рекламы.",
    capThreeTitle:"Единый редакционный процесс",
    capThreeText:"Путь от идеи до согласования и размещения. Сейчас работает локальное планирование; публикации и API — следующий этап.",
    nowHeading:"Что доступно в этой версии",
    nowText:"Просмотр проектов, создание и изменение материалов, фильтрация, календарь и переключение языков. Все записи хранятся локально в браузере; совместная работа и реальная статистика ещё не подключены.",
    footerDemo:"PROTOTYPE · LOCAL DATA · NO AUTO PUBLISH",
    editorOverline:"РЕДАКЦИОННАЯ КАРТОЧКА",editorNew:"Новый материал",editorEdit:"Редактировать материал",
    editorHelp:"Запись останется в этом браузере до подключения серверного кабинета.",
    fieldTitle:"Название материала *",fieldProject:"Проект *",fieldChannel:"Канал *",fieldLanguage:"Язык *",
    fieldStatus:"Статус *",fieldDate:"Плановая дата",fieldNotes:"Описание / идея",
    cancel:"Отмена",save:"Сохранить материал",deleteHeading:"Удалить материал?",
    delete:"Удалить",close:"Закрыть",edit:"Редактировать",remove:"Удалить",
    projectsMetric:"Проектов в плане",draftMetric:"Черновиков",scheduledMetric:"В календаре",
    countLabel:"Материалов",contentCount:"Найдено материалов",dateNotSet:"Без даты",
    editSoon:"На проверке",noItems:"Материалов пока нет",
    noItemsText:"Создайте редакционную карточку для одного из наших проектов.",
    noResults:"Ничего не найдено",noResultsText:"Измените строку поиска или фильтр статуса.",
    emptyCalendar:"Календарь пока пуст",emptyCalendarText:"Добавьте дату в карточку материала, чтобы он появился здесь.",
    allProjects:"Проектов в редакции",materialsShort:"материалов",
    saveSuccess:"Материал сохранён локально.",deleteSuccess:"Материал удалён локально.",
    deleteDescription:"Удалить этот материал из локального контент-плана? Отменить действие будет нельзя.",
    storageWarning:"Не удалось сохранить в браузере. Изменения доступны только в этой вкладке.",
    error_invalid:"Проверьте введённые данные.",
    error_title:"Укажите название материала (до 140 символов).",
    error_project:"Выберите проект.",error_channel:"Выберите канал.",
    error_language:"Выберите язык.",error_status:"Выберите статус.",
    error_date:"Проверьте дату.",error_requiredDate:"Для статуса «Запланировано» нужна дата.",
    error_rightsHold:"SHELEG TV нельзя ставить в календарь публикаций, пока не подтверждены права на материалы.",
    error_notes:"Описание не должно превышать 2000 символов.",
    updatedLocally:"Обновлено только в вашем браузере.",noCampaigns:"Нет материалов"
  },
  en: {
    skip:"Skip to content",workspace:"WORKSPACE",navOverview:"Overview",navContent:"Content",
    navCalendar:"Calendar",navProjects:"Projects",navAbout:"The studio",
    demoOnly:"Demo mode",storageDisclosure:"Changes stay in this browser only. Nothing is posted to social media.",
    memoryOnly:"Storage is unavailable. Changes will be lost when the page reloads.",
    backToBrill:"← Brill Team Project",newContent:"New content",
    eyebrow:"IN-HOUSE MEDIA STUDIO · BRILL",
    heroTitle:"Don't just build.<br><em>Get noticed.</em>",
    heroText:"Every idea, product and story in one editorial workspace. Plan, create and prepare campaigns without massive advertising budgets.",
    createBrief:"Create a brief",exploreProjects:"Our projects",
    heroFootnote:"Internal workspace · No ad spend · No social accounts connected",
    liveWorkspace:"EDITORIAL CONTROL",overviewTitle:"Everything in one place.",demoData:"DEMO / LOCAL",
    productionQueue:"PRODUCTION",recentHeading:"Editorial queue",showAll:"All content →",
    channelsOverline:"CHANNELS",channelsHeading:"Where we tell stories",
    channelDisclaimer:"Counts of ideas in the plan, not actual views or published posts.",
    mission:"The goal isn't simply more content. Every piece should support a real product goal.",
    libraryOverline:"CONTENT & CAMPAIGNS",contentTitle:"Content planner",
    contentDescription:"Drafts, reviews and scheduled ideas. No automatic social publishing.",
    searchLabel:"Search content",searchPlaceholder:"Title or project...",filterLabel:"Status",
    allStatuses:"All statuses",draft:"Draft",review:"In review",scheduled:"Scheduled",
    addMaterial:"Add content",
    scheduleOverline:"PUBLISHING PLAN",calendarTitle:"Editorial calendar",
    calendarDescription:"Items with a planned date. This is a plan; no social networks are connected.",
    ecosystemOverline:"OUR ECOSYSTEM",projectsTitle:"Every product has a voice.",
    projectsDescription:"Different formats and audiences for gaming, consumer and B2B products.",
    rightsHeading:"Before publishing",rightsText:"Third-party logos, footage, music and broadcast material require rights clearance, especially for SHELEG TV.",
    studioOverline:"BRILL MEDIA STRATEGY",aboutTitle:"Promote our products first. Serve clients next.",
    aboutDescription:"An independent studio within Brill Team Project: creative, video, social channels and analytics under one workflow.",
    capOneTitle:"Content & video",capOneText:"Product trailers, short-form videos, presentations and visual storytelling.",
    capTwoTitle:"Organic growth",capTwoText:"Channels, communities, partnerships and clear goals before paid advertising.",
    capThreeTitle:"Editorial operations",capThreeText:"From idea to approval and publication. Local planning works now; publishing integrations come later.",
    nowHeading:"Available in this version",nowText:"View projects; create, edit and filter content; browse the calendar; switch languages. Records stay in this browser. Team access and real analytics are not connected.",
    footerDemo:"PROTOTYPE · LOCAL DATA · NO AUTO PUBLISH",
    editorOverline:"EDITORIAL RECORD",editorNew:"New content",editorEdit:"Edit content",
    editorHelp:"This record stays in your browser until a server workspace is connected.",
    fieldTitle:"Content title *",fieldProject:"Project *",fieldChannel:"Channel *",
    fieldLanguage:"Language *",fieldStatus:"Status *",fieldDate:"Planned date",
    fieldNotes:"Description / idea",cancel:"Cancel",save:"Save content",
    deleteHeading:"Delete this item?",delete:"Delete",close:"Close",edit:"Edit",remove:"Delete",
    projectsMetric:"Projects in plan",draftMetric:"Drafts",scheduledMetric:"On calendar",
    countLabel:"Items",contentCount:"Items found",dateNotSet:"No date",
    editSoon:"In review",noItems:"No content yet",
    noItemsText:"Create an editorial record for one of our projects.",
    noResults:"No results",noResultsText:"Change the search term or status filter.",
    emptyCalendar:"Calendar is empty",emptyCalendarText:"Add a planned date to a content record to see it here.",
    allProjects:"Projects in studio",materialsShort:"items",
    saveSuccess:"Saved locally.",deleteSuccess:"Deleted locally.",
    deleteDescription:"Remove this item from the local content plan? This cannot be undone.",
    storageWarning:"Browser storage failed. Changes will last only for this tab.",
    error_invalid:"Check the entered information.",error_title:"Enter a title (up to 140 characters).",
    error_project:"Choose a project.",error_channel:"Choose a channel.",
    error_language:"Choose a language.",error_status:"Choose a status.",
    error_date:"Check the date.",error_requiredDate:"Scheduled items need a date.",
    error_rightsHold:"SHELEG TV cannot be scheduled until the required content rights are cleared.",
    error_notes:"Description cannot exceed 2,000 characters.",
    updatedLocally:"Updated in your browser only.",noCampaigns:"No items"
  },
  he: {
    skip:"דלג לתוכן",workspace:"סביבת עבודה",navOverview:"סקירה",navContent:"תוכן",
    navCalendar:"לוח שנה",navProjects:"פרויקטים",navAbout:"על הסטודיו",
    demoOnly:"מצב הדגמה",storageDisclosure:"השינויים נשמרים בדפדפן זה בלבד. שום דבר לא מתפרסם ברשתות החברתיות.",
    memoryOnly:"האחסון אינו זמין. השינויים יאבדו ברענון הדף.",
    backToBrill:"→ Brill Team Project",newContent:"תוכן חדש",
    eyebrow:"סטודיו מדיה עצמאי · BRILL",
    heroTitle:"לא רק ליצור.<br><em>גם שיראו אותנו.</em>",
    heroText:"כל הרעיונות, המוצרים והסיפורים שלנו במקום אחד. מתכננים תוכן וקמפיינים בלי תקציבי פרסום ענקיים.",
    createBrief:"יצירת תוכן",exploreProjects:"הפרויקטים שלנו",
    heroFootnote:"כלי פנימי · ללא הוצאות פרסום · ללא חיבור לרשתות חברתיות",
    liveWorkspace:"חדר בקרת תוכן",overviewTitle:"כל העבודה. במקום אחד.",demoData:"הדגמה / מקומי",
    productionQueue:"הפקה",recentHeading:"תור העריכה",showAll:"כל התכנים ←",
    channelsOverline:"ערוצים",channelsHeading:"איפה מספרים את הסיפור",
    channelDisclaimer:"מספר הרעיונות בתכנון בלבד, לא צפיות או פרסומים בפועל.",
    mission:"המטרה היא לא רק יותר תוכן. כל פרסום צריך לקדם יעד ממשי של מוצר.",
    libraryOverline:"תוכן וקמפיינים",contentTitle:"תכנון תוכן",
    contentDescription:"טיוטות, תכנים לבדיקה ותכניות לפרסום. אין פרסום אוטומטי.",
    searchLabel:"חיפוש תוכן",searchPlaceholder:"שם תוכן או פרויקט...",filterLabel:"סטטוס",
    allStatuses:"כל הסטטוסים",draft:"טיוטה",review:"בבדיקה",scheduled:"מתוכנן",
    addMaterial:"הוספת תוכן",
    scheduleOverline:"תכנית פרסומים",calendarTitle:"לוח העריכה",
    calendarDescription:"תכנים עם תאריך יעד. מדובר בתכנית בלבד — הרשתות החברתיות אינן מחוברות.",
    ecosystemOverline:"המערכת שלנו",projectsTitle:"לכל פרויקט קול משלו.",
    projectsDescription:"למשחקים, למוצרי צריכה ולפתרונות B2B יש קהלים ופורמטים שונים.",
    rightsHeading:"לפני פרסום",rightsText:"לוגואים, קטעי וידאו, מוזיקה ותוכן שידור של אחרים מחייבים בדיקת זכויות, במיוחד ב-SHELEG TV.",
    studioOverline:"אסטרטגיית BRILL MEDIA",aboutTitle:"קודם מקדמים את שלנו. אחר כך לקוחות.",
    aboutDescription:"סטודיו בתוך Brill Team Project: אסטרטגיית תוכן, וידאו, רשתות חברתיות ומדידה בתהליך אחד.",
    capOneTitle:"תוכן ווידאו",capOneText:"טריילרים למוצרים, סרטונים קצרים, מצגות וסיפורים חזותיים.",
    capTwoTitle:"צמיחה אורגנית",capTwoText:"ערוצים, קהילות, שותפויות ויעדים ברורים לפני רכישת פרסום.",
    capThreeTitle:"ניהול תוכן",capThreeText:"מרעיון לאישור ולפרסום. כעת ניתן לתכנן מקומית; חיבורי פרסום יגיעו בהמשך.",
    nowHeading:"מה קיים בגרסה הזו",nowText:"צפייה בפרויקטים, יצירה ועריכה של תכנים, סינון, לוח שנה והחלפת שפות. הרשומות נשמרות בדפדפן בלבד; עבודה קבוצתית ונתוני אמת עדיין לא מחוברים.",
    footerDemo:"אב-טיפוס · מידע מקומי · ללא פרסום אוטומטי",
    editorOverline:"כרטיס תוכן",editorNew:"תוכן חדש",editorEdit:"עריכת תוכן",
    editorHelp:"הרשומה נשמרת בדפדפן עד לחיבור מערכת שרת.",
    fieldTitle:"כותרת התוכן *",fieldProject:"פרויקט *",fieldChannel:"ערוץ *",
    fieldLanguage:"שפה *",fieldStatus:"סטטוס *",fieldDate:"תאריך יעד",
    fieldNotes:"תיאור / רעיון",cancel:"ביטול",save:"שמירת תוכן",
    deleteHeading:"למחוק את התוכן?",delete:"מחיקה",close:"סגירה",edit:"עריכה",remove:"מחיקה",
    projectsMetric:"פרויקטים בתכנון",draftMetric:"טיוטות",scheduledMetric:"בלוח השנה",
    countLabel:"תכנים",contentCount:"תכנים נמצאו",dateNotSet:"ללא תאריך",
    editSoon:"בבדיקה",noItems:"אין עדיין תכנים",
    noItemsText:"אפשר ליצור כרטיס תוכן עבור אחד הפרויקטים.",
    noResults:"אין תוצאות",noResultsText:"אפשר לשנות את החיפוש או סינון הסטטוס.",
    emptyCalendar:"לוח השנה ריק",emptyCalendarText:"יש להוסיף תאריך לכרטיס תוכן כדי שיופיע כאן.",
    allProjects:"פרויקטים בסטודיו",materialsShort:"תכנים",
    saveSuccess:"נשמר בדפדפן.",deleteSuccess:"נמחק מהדפדפן.",
    deleteDescription:"למחוק את הפריט מתכנית התוכן המקומית? לא ניתן לבטל פעולה זו.",
    storageWarning:"שמירה בדפדפן נכשלה. השינויים יישמרו רק בלשונית זו.",
    error_invalid:"יש לבדוק את הפרטים.",error_title:"יש להזין כותרת (עד 140 תווים).",
    error_project:"יש לבחור פרויקט.",error_channel:"יש לבחור ערוץ.",
    error_language:"יש לבחור שפה.",error_status:"יש לבחור סטטוס.",
    error_date:"יש לבדוק את התאריך.",error_requiredDate:"לתוכן מתוכנן נדרש תאריך.",
    error_rightsHold:"לא ניתן לתזמן תוכן SHELEG TV לפני אימות זכויות השימוש.",
    error_notes:"התיאור מוגבל ל-2,000 תווים.",
    updatedLocally:"עודכן בדפדפן בלבד.",noCampaigns:"אין תכנים"
  }
};

const selector = (q) => document.querySelector(q);
const selectorAll = (q) => Array.from(document.querySelectorAll(q));
const storedLanguage = (() => {try{return localStorage.getItem("brill-media-language-v1");}catch{return null;}})();
let storageAvailable = true;
function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw == null ? DEMO_RECORDS.map(r=>({...r})) : normalizeRecords(JSON.parse(raw));
  } catch {
    storageAvailable = false;
    return DEMO_RECORDS.map(r=>({...r}));
  }
}
const fromUrl = new URLSearchParams(location.search).get("view");
const views = ["overview","content","calendar","projects","about"];
const state = {
  lang:["ru","he","en"].includes(storedLanguage) ? storedLanguage : "ru",
  view:views.includes(fromUrl) ? fromUrl : "overview",
  records:loadRecords(),search:"",filter:"all",editorOpen:false,deleteId:null,
  focusReturn:null
};
let toastTimer;

function t(key) { return translations[state.lang][key] || translations.ru[key] || key; }
function esc(v) { return escapeHtml(v); }
function proj(id) { return projectById(id)?.name || id; }
function dateLabel(date) { return date ? displayDate(date,state.lang) : t("dateNotSet"); }
function recordTitle(r) { return localized(r.title,state.lang); }
function recordNotes(r) { return localized(r.notes,state.lang); }
function statusBadge(status) { return '<span class="status status-'+esc(status)+'">'+esc(t(status))+'</span>'; }
function saveRecords() {
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state.records)); return true; }
  catch {storageAvailable=false;updateStorageNote();return false;}
}
function updateStorageNote() {
  const n=selector(".sidebar-bottom p");
  if (n && !storageAvailable) n.textContent=t("memoryOnly");
}
function notify(message) {
  const node=selector("#toast");
  clearTimeout(toastTimer);
  node.textContent=message;
  node.hidden=false;
  toastTimer=setTimeout(()=>{node.hidden=true;},4200);
}
function translateStatic() {
  document.documentElement.lang=state.lang;
  document.documentElement.dir=state.lang==="he"?"rtl":"ltr";
  selectorAll("[data-i18n]").forEach(el=>{el.textContent=t(el.dataset.i18n);});
  selectorAll("[data-i18n-html]").forEach(el=>{el.innerHTML=t(el.dataset.i18nHtml);});
  selectorAll("[data-i18n-placeholder]").forEach(el=>{el.placeholder=t(el.dataset.i18nPlaceholder);});
  selectorAll("[data-lang]").forEach(b=>{
    b.classList.toggle("active",b.dataset.lang===state.lang);
    b.setAttribute("aria-pressed",String(b.dataset.lang===state.lang));
  });
  selectorAll(".close-icon").forEach(b=>b.setAttribute("aria-label",t("close")));
  selector("#mainNav").setAttribute("aria-label",t("workspace"));
  selector("#statusFilter").setAttribute("aria-label",t("filterLabel"));
  updateStorageNote();
  if (state.editorOpen) selector("#editorHeading").textContent=selector("#recordId").value?t("editorEdit"):t("editorNew");
  if (state.deleteId) updateDeleteDescription();
}
function formatCount(n) {return new Intl.NumberFormat({ru:"ru-RU",he:"he-IL",en:"en-US"}[state.lang]).format(n);}
function recordSecondary(r) {
  return esc(proj(r.project))+" · "+esc(r.channel)+" · "+esc(r.language.toUpperCase());
}
function renderOverview() {
  const stats=countByStatus(state.records);
  const metrics=[
    [stats.projects,"projectsMetric",PROJECTS.length+" "+t("allProjects")],
    [stats.draft,"draftMetric",t("demoData")],
    [stats.scheduled,"scheduledMetric",t("demoData")]
  ];
  selector("#statGrid").innerHTML=metrics.map(m=>
    '<article class="stat"><div class="stat-value">'+formatCount(m[0])+'</div><div class="stat-caption">'+esc(t(m[1]))+'</div><div class="stat-meta">'+esc(m[2])+'</div></article>'
  ).join("");
  const recent=state.records.slice().reverse().slice(0,5);
  selector("#recentList").innerHTML=recent.length?recent.map(r=>
    '<article class="queue-item"><div><h4>'+esc(recordTitle(r))+'</h4><p>'+recordSecondary(r)+'</p></div><div class="queue-meta">'+statusBadge(r.status)+'</div></article>'
  ).join(""):emptyMarkup(false);
  const channels=CHANNELS.map(name=>({name,count:state.records.filter(r=>r.channel===name).length}))
    .filter(c=>c.count>0).sort((a,b)=>b.count-a.count);
  const max=Math.max(1,...channels.map(c=>c.count));
  selector("#channelList").innerHTML=channels.length?channels.map(c=>
    '<div class="channel-item"><div class="channel-details"><div class="channel-name">'+esc(c.name)+'</div><div class="channel-meter"><span style="width:'+Math.round(c.count/max*100)+'%"></span></div></div><span class="channel-count">'+formatCount(c.count)+'</span></div>'
  ).join(""):emptyMarkup(false);
}
function emptyMarkup(noResults=false,calendar=false) {
  const title=calendar?"emptyCalendar":noResults?"noResults":"noItems";
  const info=calendar?"emptyCalendarText":noResults?"noResultsText":"noItemsText";
  return '<div class="empty"><strong>'+esc(t(title))+'</strong><p>'+esc(t(info))+'</p></div>';
}
function filteredRecords() {
  const query=state.search.trim().toLocaleLowerCase();
  return state.records.filter(r=>(state.filter==="all"||r.status===state.filter)
    && (!query||[recordTitle(r),recordNotes(r),proj(r.project),r.channel].join(" ").toLocaleLowerCase().includes(query)));
}
function renderContent() {
  const records=filteredRecords();
  selector("#contentCount").textContent=t("contentCount")+": "+formatCount(records.length);
  selector("#contentList").innerHTML=records.length?records.map(r=>
    '<article class="record-row"><div class="record-main"><h3>'+esc(recordTitle(r))+'</h3><p>'+esc(recordNotes(r))+'</p><div class="record-meta"><span>'+recordSecondary(r)+'</span></div></div>'+
    '<div class="record-state">'+statusBadge(r.status)+'<span class="record-date">'+esc(dateLabel(r.date))+'</span></div>'+
    '<div class="record-actions"><button type="button" class="icon-button" data-action="edit" data-id="'+esc(r.id)+'" aria-label="'+esc(t("edit"))+'">✎</button>'+
    '<button type="button" class="icon-button danger" data-action="delete" data-id="'+esc(r.id)+'" aria-label="'+esc(t("remove"))+'">×</button></div></article>'
  ).join(""):emptyMarkup(Boolean(state.search||state.filter!=="all"));
}
function renderCalendar() {
  const records=futureSchedule(state.records);
  selector("#calendarList").innerHTML=records.length?records.map(r=>
    '<article class="timeline-item"><div class="timeline-date">'+esc(dateLabel(r.date))+'</div>'+
    '<div class="timeline-body"><h3>'+esc(recordTitle(r))+'</h3><p>'+recordSecondary(r)+'</p>'+statusBadge(r.status)+'</div></article>'
  ).join(""):emptyMarkup(false,true);
}
function renderProjects() {
  selector("#projectGrid").innerHTML=PROJECTS.map(p=>{
    const count=state.records.filter(r=>r.project===p.id).length;
    return '<article class="project-card"><div><span class="project-kicker">'+esc(p.kind)+'</span><h3>'+esc(p.name)+'</h3><p>'+esc(localized(p.detail,state.lang))+'</p></div>'+
      '<div class="project-footer"><span>'+esc(t("countLabel"))+'</span><b>'+formatCount(count)+'</b></div></article>';
  }).join("");
}
function renderAll() {renderOverview();renderContent();renderCalendar();renderProjects();}
function showView(name,focusMain=false) {
  if (!views.includes(name)) name="overview";
  state.view=name;
  views.forEach(view=>{
    selector("#view-"+view).hidden=view!==name;
  });
  selector("#hero").hidden=name!=="overview";
  selectorAll("[data-view]").forEach(btn=>{
    if (!btn.classList.contains("nav-item")) return;
    const active=btn.dataset.view===name;
    btn.classList.toggle("active",active);
    if (active) btn.setAttribute("aria-current","page");
    else btn.removeAttribute("aria-current");
  });
  const url=new URL(location.href);
  if (name==="overview") url.searchParams.delete("view"); else url.searchParams.set("view",name);
  history.replaceState(null,"",url.pathname+url.search+url.hash);
  if (focusMain) {
    window.scrollTo({top:0,behavior:"instant"});
    selector("#main").focus({preventScroll:true});
  }
}
function rememberFocus() {state.focusReturn=document.activeElement;}
function returnFocus() {
  const origin=state.focusReturn;
  state.focusReturn=null;
  if (origin && origin.isConnected && !origin.closest("[hidden]")) origin.focus();
  else selector('.topbar [data-action="new"]').focus();
}
function activeModal() {
  if (!selector("#editorBackdrop").hidden) return selector("#editorBackdrop");
  if (!selector("#deleteBackdrop").hidden) return selector("#deleteBackdrop");
  return null;
}
function closeModal(which) {
  selector(which==="editor"?"#editorBackdrop":"#deleteBackdrop").hidden=true;
  if (which==="editor") state.editorOpen=false;
  else state.deleteId=null;
  selector("#appShell").inert=false;
  returnFocus();
}
function openEditor(id="") {
  const r=state.records.find(x=>x.id===id);
  rememberFocus();
  selector("#editorForm").reset();
  selector("#formError").hidden=true;
  selector("#recordId").value=r?.id||"";
  selector("#recordTitle").value=r?recordTitle(r):"";
  selector("#recordProject").value=r?.project||"brill-team";
  selector("#recordChannel").value=r?.channel||"Instagram";
  selector("#recordLanguage").value=r?.language||state.lang;
  selector("#recordStatus").value=r?.status||"draft";
  selector("#recordDate").value=r?.date||"";
  selector("#recordNotes").value=r?recordNotes(r):"";
  state.editorOpen=true;
  selector("#editorHeading").textContent=r?t("editorEdit"):t("editorNew");
  selector("#editorBackdrop").hidden=false;
  selector("#appShell").inert=true;
  requestAnimationFrame(()=>selector("#recordTitle").focus());
}
function updateDeleteDescription() {
  const record=state.records.find(r=>r.id===state.deleteId);
  selector("#deleteDescription").textContent=record?
    "«"+recordTitle(record)+"» — "+t("deleteDescription"):t("deleteDescription");
}
function openDelete(id) {
  if (!state.records.some(r=>r.id===id)) return;
  rememberFocus();
  state.deleteId=id;
  updateDeleteDescription();
  selector("#deleteBackdrop").hidden=false;
  selector("#appShell").inert=true;
  requestAnimationFrame(()=>selector('#deleteBackdrop [data-action="close-delete"]').focus());
}
function submitRecord(event) {
  event.preventDefault();
  const id=selector("#recordId").value;
  const payload={
    title:selector("#recordTitle").value.trim(),
    project:selector("#recordProject").value,
    channel:selector("#recordChannel").value,
    language:selector("#recordLanguage").value,
    status:selector("#recordStatus").value,
    date:selector("#recordDate").value,
    notes:selector("#recordNotes").value.trim()
  };
  const issue=validateRecord(payload);
  if (issue) {
    const error=selector("#formError");
    error.textContent=t("error_"+issue)||t("error_invalid");
    error.hidden=false;
    const field={title:"recordTitle",project:"recordProject",channel:"recordChannel",
      language:"recordLanguage",status:"recordStatus",date:"recordDate",requiredDate:"recordDate",
      rightsHold:"recordStatus",notes:"recordNotes"}[issue];
    if (field) selector("#"+field).focus();
    return;
  }
  const previous=state.records.find(r=>r.id===id);
  const newId=previous?.id || (globalThis.crypto?.randomUUID?.()||"local-"+Date.now()+"-"+Math.floor(Math.random()*1e6));
  const record={id:newId,...payload,demo:false};
  if (previous) state.records=state.records.map(r=>r.id===id?record:r);
  else state.records=[...state.records,record];
  const persisted=saveRecords();
  closeModal("editor");
  renderAll();showView("content",true);
  notify(persisted?t("saveSuccess"):t("storageWarning"));
}
function confirmDelete() {
  if (!state.deleteId) return;
  state.records=state.records.filter(r=>r.id!==state.deleteId);
  const persisted=saveRecords();
  closeModal("delete");renderAll();
  notify(persisted?t("deleteSuccess"):t("storageWarning"));
}
function focusTrap(event) {
  const modal=activeModal();
  if (!modal) return;
  if (event.key==="Escape") {
    event.preventDefault();closeModal(modal.id==="editorBackdrop"?"editor":"delete");return;
  }
  if (event.key!=="Tab") return;
  const all=Array.from(modal.querySelectorAll('button:not([disabled]),input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled])'))
    .filter(el=>el.getClientRects().length>0);
  if (!all.length) return;
  const first=all[0],last=all[all.length-1];
  if (event.shiftKey&&document.activeElement===first) {event.preventDefault();last.focus();}
  else if (!event.shiftKey&&document.activeElement===last) {event.preventDefault();first.focus();}
}
function setup() {
  selector("#recordProject").innerHTML=PROJECTS.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join("");
  document.addEventListener("click",event=>{
    const language=event.target.closest("[data-lang]");
    if (language) {
      state.lang=language.dataset.lang;
      try {localStorage.setItem("brill-media-language-v1",state.lang);}catch{storageAvailable=false;}
      translateStatic();renderAll();return;
    }
    const nav=event.target.closest("[data-view]");
    if (nav) {showView(nav.dataset.view,true);return;}
    const control=event.target.closest("[data-action]");
    if (!control) {
      if (event.target===selector("#editorBackdrop")) closeModal("editor");
      if (event.target===selector("#deleteBackdrop")) closeModal("delete");
      return;
    }
    const action=control.dataset.action;
    if (action==="new") openEditor();
    else if (action==="edit") openEditor(control.dataset.id);
    else if (action==="delete") openDelete(control.dataset.id);
    else if (action==="close-editor") closeModal("editor");
    else if (action==="close-delete") closeModal("delete");
  });
  selector("#searchInput").addEventListener("input",event=>{state.search=event.target.value;renderContent();});
  selector("#statusFilter").addEventListener("change",event=>{state.filter=event.target.value;renderContent();});
  selector("#editorForm").addEventListener("submit",submitRecord);
  selector("#confirmDelete").addEventListener("click",confirmDelete);
  document.addEventListener("keydown",focusTrap);
  window.addEventListener("popstate",()=>{
    const v=new URLSearchParams(location.search).get("view");
    showView(views.includes(v)?v:"overview");
  });
  translateStatic();renderAll();showView(state.view);
}
setup();
