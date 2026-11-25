/* ===== Раздел „Тренировка“ =====
 * Задачи по теми (data/topics.json, генерира се от scripts/build_topics.py),
 * случайна задача, самооценка и повторение на интервали (spaced repetition).
 * Ползва GROUPS, SUBJ, RN, GRADES, MK, isTask, gmatch, esc, go от основния скрипт.
 * Всичко за потребителя се пази само в localStorage на браузъра му.
 */
const TR_KEY = "pn_srs";            // {path: {b: кутия, due: "ГГГГ-ММ-ДД", n: опити, last: "ok|hard|fail"}}
const TR_PREF = "pn_train";         // последно избраните филтри
const TR_DAYS = [1, 3, 7, 14, 30, 60]; // интервал в дни за всяка кутия (система на Лайтнер)

let TOPICS = null, TOPICS_LOAD = null, TR_TASKS = null;
let SRS = {};
try { SRS = JSON.parse(localStorage.getItem(TR_KEY) || "{}") || {}; } catch (e) { SRS = {}; }
let TR = { s: "him", t: "all", g: "all", r: "all", lim: 25 };
try { Object.assign(TR, JSON.parse(localStorage.getItem(TR_PREF) || "{}")); TR.lim = 25; } catch (e) {}

function trSave() {
  try {
    localStorage.setItem(TR_KEY, JSON.stringify(SRS));
    localStorage.setItem(TR_PREF, JSON.stringify({ s: TR.s, t: TR.t, g: TR.g, r: TR.r }));
  } catch (e) {}
}

/* --- дати --- */
const trDay = (d = new Date()) => {
  const z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
const trAdd = days => { const d = new Date(); d.setDate(d.getDate() + days); return trDay(d); };
const trDiff = s => Math.round((new Date(s + "T00:00:00") - new Date(trDay() + "T00:00:00")) / 864e5);

/* --- данни --- */
function loadTopics() {
  if (!TOPICS_LOAD) TOPICS_LOAD = fetch("data/topics.json")
    .then(r => r.ok ? r.json() : { topics: {}, files: {} })
    .catch(() => ({ topics: {}, files: {} }))
    .then(j => { TOPICS = j; TR_TASKS = null; return j; });
  return TOPICS_LOAD;
}

function trTasks() {
  if (TR_TASKS) return TR_TASKS;
  const files = (TOPICS && TOPICS.files) || {};
  TR_TASKS = [];
  GROUPS.forEach(g => g.items.forEach(it => {
    if (it.x || !isTask(it)) return; // външните връзки (СУ) нямат локален текст
    const sameGrade = g.items.filter(x => x.g === it.g);
    const sol = it.k === "задачи и решения" ? null
      : sameGrade.filter(x => x.k === "решения")[sameGrade.filter(x => x.k === it.k).indexOf(it)]
        || sameGrade.find(x => x.k === "решения") || null;
    TR_TASKS.push({
      it, g, s: g.p.s, p: it.p,
      topics: files[it.p.split("/").pop()] || {},
      sol,
      title: `${SUBJ[g.p.s].n}, ${RN[g.r].toLowerCase()} ${g.y} г.${it.g ? ", " + it.g + " клас" : ""}${it.l && it.l.length <= 40 ? " – " + it.l : ""}`
    });
  }));
  return TR_TASKS;
}

function trFiltered() {
  const l = trTasks().filter(t => t.s === TR.s
    && (TR.r === "all" || t.g.r === TR.r)
    && gmatch(t.it.g, TR.g)
    && (TR.t === "all" || t.topics[TR.t]));
  return l.sort((a, b) => TR.t !== "all"
    ? (b.topics[TR.t] - a.topics[TR.t]) || (b.g.y - a.g.y)
    : (b.g.y - a.g.y) || RORD[a.g.r] - RORD[b.g.r]);
}

/* --- повторение на интервали --- */
function trRate(p, how) {
  const c = SRS[p] || { b: 0, n: 0 };
  if (how === "ok") { c.b = Math.min(c.b + 1, TR_DAYS.length - 1); MK.d.add(p); }
  else if (how === "hard") c.b = Math.max(c.b - 1, 0);
  else c.b = 0;
  c.n++; c.last = how;
  c.due = trAdd(how === "fail" ? 1 : how === "hard" ? Math.max(2, Math.ceil(TR_DAYS[c.b] / 2)) : TR_DAYS[c.b]);
  SRS[p] = c;
  mkSave(); trSave();
}
const trDue = () => trTasks().filter(t => SRS[t.p] && trDiff(SRS[t.p].due) <= 0)
  .sort((a, b) => SRS[a.p].due.localeCompare(SRS[b.p].due));

function trStatus(p) {
  const c = SRS[p];
  if (!c) return MK.d.has(p) ? '<span class="trs ok">решена</span>' : '<span class="trs">нова</span>';
  const d = trDiff(c.due);
  const lbl = { ok: "реших я", hard: "трудно", fail: "не успях" }[c.last] || "";
  return `<span class="trs ${c.last}">${lbl} · ${d <= 0 ? "<b>за повторение днес</b>" : d === 1 ? "повторение утре" : "повторение след " + d + " дни"}</span>`;
}

/* --- изглед --- */
function trRow(t) {
  const L = (TOPICS && TOPICS.topics[t.s]) || {};
  const tags = Object.keys(t.topics).slice(0, 4).map(k => `<span class="trtag${k === TR.t ? " on" : ""}">${esc(L[k] || k)}</span>`).join("");
  const link = (it, txt, cls) => `<a class="f k-${cls}" href="#" data-p="${it.p}" data-u="${it.u}" data-t="${esc(t.title)} – ${txt.toLowerCase()}">📄 ${txt}</a>`;
  return `<div class="trrow" style="--c:${SUBJ[t.s].c}">
    <div class="trh"><b>${esc(t.title)}</b>${trStatus(t.p)}</div>
    ${tags ? `<div class="trtags">${tags}</div>` : ""}
    <div class="tra">${link(t.it, t.it.k === "задачи и решения" ? "Задачи и решения" : "Задачи", "задачи")}${t.sol ? link(t.sol, "Решения", "решения") : ""}
      <span class="trrate">Как се справихте?
        <button data-rate="ok" data-p="${t.p}">✓ Реших я</button><button data-rate="hard" data-p="${t.p}">≈ Трудно</button><button data-rate="fail" data-p="${t.p}">✗ Не успях</button>
      </span></div></div>`;
}

function trStats() {
  const L = (TOPICS && TOPICS.topics[TR.s]) || {};
  const all = trTasks().filter(t => t.s === TR.s && gmatch(t.it.g, TR.g));
  return Object.entries(L).map(([k, n]) => {
    const l = all.filter(t => t.topics[k]);
    if (!l.length) return "";
    const d = l.filter(t => MK.d.has(t.p)).length, pc = Math.round(100 * d / l.length);
    return `<div class="trst" data-topic="${k}" title="Покажи задачите"><span>${esc(n)}</span><span>${d}/${l.length}</span><div class="pbar"><i style="width:${pc}%"></i></div></div>`;
  }).join("");
}

function renderTrain(c) {
  c.innerHTML = `<div class="crumbs">Начало › Тренировка</div>
  <div class="pagehead"><h2>🧠 Тренировка</h2><span class="count" id="trcount"></span></div>
  <p>Изберете предмет и тема, решете задача и оценете как сте се справили. Сайтът ще ви я покаже отново след няколко дни – по-скоро, ако е била трудна, и по-късно, ако е била лесна. Така упражнявате точно това, което ви затруднява.</p>
  <div id="trdue"></div>
  <div class="filters" id="trS"><span class="lbl">Предмет</span></div>
  <div class="filters" id="trT"><span class="lbl">Тема</span></div>
  <div class="filters" id="trG"><span class="lbl">Клас</span></div>
  <div class="filters" id="trR"><span class="lbl">Кръг</span></div>
  <div class="zipbar"><button class="btn" id="trrand" style="margin:0">🎲 Случайна задача</button><span class="prog">Случайна задача от избраните, която не сте решавали или чието повторение е дошло.</span></div>
  <div id="trlist"><div class="empty">Зарежда се…</div></div>
  <h3 style="font-family:'PT Serif',serif;margin:26px 0 6px">📊 Напредък по теми</h3>
  <div class="legend">Колко от задачите по всяка тема сте решили${TR.g !== "all" ? " за " + TR.g + " клас" : ""}. Щракнете върху тема, за да я изберете.</div>
  <div class="trstats" id="trstats"></div>
  <p class="legend" style="margin-top:14px">Темите са определени автоматично по ключови думи в текста на задачите, затова понякога може да не са точни.</p>`;
  loadTopics().then(() => { if (st.s === "train") trDraw(c); });
}

function trDraw(c) {
  const L = (TOPICS && TOPICS.topics[TR.s]) || {};
  if (TR.t !== "all" && !L[TR.t]) TR.t = "all";
  const set = (k, v) => { TR[k] = v; if (k === "s") TR.t = "all"; TR.lim = 25; trSave(); renderTrain(c); };
  const sEl = c.querySelector("#trS"), tEl = c.querySelector("#trT"), gEl = c.querySelector("#trG"), rEl = c.querySelector("#trR");
  // trDraw се вика и след оценка, затова редовете с филтри се изграждат наново
  [[sEl, "Предмет"], [tEl, "Тема"], [gEl, "Клас"], [rEl, "Кръг"]].forEach(([el, n]) => { el.innerHTML = `<span class="lbl">${n}</span>`; });
  chipRow(sEl, Object.entries(SUBJ).map(([k, v]) => [k, v.n]), TR.s, v => set("s", v));
  const base = trTasks().filter(t => t.s === TR.s && gmatch(t.it.g, TR.g) && (TR.r === "all" || t.g.r === TR.r));
  chipRow(tEl, [["all", "Всички"], ...Object.entries(L).map(([k, n]) => [k, `${n} (${base.filter(t => t.topics[k]).length})`])], TR.t, v => set("t", v));
  chipRow(gEl, [["all", "Всички"], ...GRADES.map(g => [g, g])], TR.g, v => set("g", v));
  chipRow(rEl, [["all", "Всички"], ["obsh", "Общински"], ["obl", "Областен"], ["nac", "Национален"]], TR.r, v => set("r", v));

  const due = trDue();
  c.querySelector("#trdue").innerHTML = due.length
    ? `<div class="note"><b>🔁 За повторение днес: ${due.length}</b>${due.slice(0, 5).map(trRow).join("")}${due.length > 5 ? `<div class="legend">…и още ${due.length - 5}.</div>` : ""}</div>`
    : (Object.keys(SRS).length ? `<div class="note">✅ Днес нямате задачи за повторение. Следващото повторение: ${(() => { const n = Object.values(SRS).map(x => x.due).sort()[0]; const d = trDiff(n); return d === 1 ? "утре" : "след " + d + " дни"; })()}.</div>` : "");

  const l = trFiltered();
  c.querySelector("#trcount").textContent = `${l.length} файла със задачи`;
  const box = c.querySelector("#trlist");
  box.innerHTML = l.length
    ? l.slice(0, TR.lim).map(trRow).join("") + (l.length > TR.lim ? `<p style="text-align:center"><button class="btn" id="trmore">Покажи още (${l.length - TR.lim})</button></p>` : "")
    : '<div class="empty">Няма задачи за този избор. Опитайте с „Всички“ при класа или кръга.</div>';
  const more = box.querySelector("#trmore"); if (more) more.onclick = () => { TR.lim += 25; trDraw(c); };

  c.querySelector("#trrand").onclick = () => {
    const pool = l.filter(t => !SRS[t.p] && !MK.d.has(t.p)).concat(l.filter(t => SRS[t.p] && trDiff(SRS[t.p].due) <= 0));
    const pick = (pool.length ? pool : l)[Math.floor(Math.random() * (pool.length || l.length))];
    if (!pick) return;
    box.innerHTML = `<div class="legend">🎲 Случайна задача:</div>${trRow(pick)}<p><a href="#" id="trback">← Обратно към списъка</a></p>`;
    box.querySelector("#trback").onclick = e => { e.preventDefault(); trDraw(c); };
    openViewer(pick.p, pick.it.u, pick.title);
  };

  const stats = c.querySelector("#trstats");
  stats.innerHTML = trStats() || '<div class="empty">Няма данни за темите.</div>';
  stats.onclick = e => { const s = e.target.closest("[data-topic]"); if (s) { set("t", s.dataset.topic); window.scrollTo(0, 0); } };

  c.onclick = e => {
    const b = e.target.closest("button[data-rate]"); if (!b) return;
    trRate(b.dataset.p, b.dataset.rate);
    const d = SRS[b.dataset.p], n = trDiff(d.due);
    flash(`Записано. Ще видите задачата отново ${n === 1 ? "утре" : "след " + n + " дни"}.`);
    const keepRandom = c.querySelector("#trback");
    if (keepRandom) { b.closest(".trrow").outerHTML = trRow(trTasks().find(t => t.p === b.dataset.p)); } else trDraw(c);
  };
}
