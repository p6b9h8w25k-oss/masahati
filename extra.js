// ============ التنبيهات والتحليلات والتصدير ============

const NOTIFY_KEY = 'masahati-notify';
let statsDays = 7;
let statsReady = false;

// ---------- أدوات مشتركة ----------

function esc(t) {
  return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function periodDates(n) {
  const end = todayStr();
  const start = addDays(end, -(n - 1));
  const out = [];
  for (let i = 0; i < n; i++) out.push(addDays(start, i));
  return out;
}

function dayLabel(dateStr, n) {
  if (n === 7) return SHORT_DAY_NAMES[parseDate(dateStr).getDay()];
  return String(Number(dateStr.split('-')[2]));
}

// ---------- التنبيهات ----------

function getNotifySettings() {
  try { return JSON.parse(localStorage.getItem(NOTIFY_KEY)) || {}; } catch (e) { return {}; }
}

function saveNotifySettings(s) {
  try { localStorage.setItem(NOTIFY_KEY, JSON.stringify(s)); } catch (e) {}
}

function overdueCount() {
  const today = todayStr();
  return tasks.filter(t => t.due_date && t.due_date < today && effStatus(t) !== 'done').length;
}

function reminderText() {
  const today = todayStr();
  const todayLeft = tasks.filter(t => t.due_date === today && effStatus(t) !== 'done').length;
  const habitsLeft = habits.filter(h => habitActiveToday(h) &&
    !habitLogs.some(l => l.habit_id === h.id && l.log_date === today)).length;
  const late = overdueCount();
  const parts = [];
  if (todayLeft) parts.push('باقي ' + todayLeft + ' مهام لليوم');
  if (late) parts.push(late + ' مهام متأخرة');
  if (habitsLeft) parts.push(habitsLeft + ' عادات ما أنجزتها');
  return parts.length ? parts.join(' | ') : 'أحسنت، ما فيه شي متبقي اليوم';
}

function sendNote(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  try {
    new Notification(title, { body, lang: 'ar' });
    return true;
  } catch (e) {
    return false;
  }
}

// يفحص كل نص دقيقة: إذا الوقت وصل ولسه ما انرسل اليوم، يرسل التذكير
function checkReminder() {
  const s = getNotifySettings();
  if (!s.on || !s.time) return;
  const now = new Date();
  const [h, m] = s.time.split(':').map(Number);
  const today = todayStr();
  const passed = now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
  if (passed && s.lastFired !== today) {
    saveNotifySettings({ ...s, lastFired: today });
    sendNote('مساحتي: تذكير اليوم', reminderText());
  }
}

function renderNotifyBox() {
  const box = $('notifyBox');
  if (!box) return;
  const s = getNotifySettings();
  const supported = 'Notification' in window;
  box.innerHTML = '';

  const h = document.createElement('h3');
  h.textContent = 'التنبيهات';
  box.appendChild(h);

  const overdue = overdueCount();
  if (overdue) {
    const b = document.createElement('div');
    b.className = 'banner';
    b.textContent = 'عندك ' + overdue + ' مهام متأخرة. افتح صفحة المهام وشوفها.';
    box.appendChild(b);
  }

  const row = document.createElement('div');
  row.className = 'more-form';

  const label = document.createElement('label');
  label.textContent = 'وقت التذكير اليومي: ';
  const time = document.createElement('input');
  time.type = 'time';
  time.value = s.time || '21:00';
  time.onchange = () => saveNotifySettings({ ...getNotifySettings(), time: time.value, lastFired: '' });
  label.appendChild(time);

  const btn = document.createElement('button');
  btn.textContent = s.on ? 'إيقاف التذكير' : 'تشغيل التذكير';
  btn.onclick = async () => {
    if (s.on) {
      saveNotifySettings({ ...getNotifySettings(), on: false });
      return renderNotifyBox();
    }
    if (!supported) {
      return alert('هذا المتصفح ما يدعم الإشعارات. على الآيفون: أضف الموقع للشاشة الرئيسية أولاً، وافتحه من هناك.');
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return alert('ما سمحت بالإشعارات. تقدر تفعلها من إعدادات المتصفح.');
    saveNotifySettings({ on: true, time: time.value || '21:00', lastFired: '' });
    sendNote('مساحتي', 'التذكير اشتغل. بنذكرك كل يوم الساعة ' + (time.value || '21:00'));
    renderNotifyBox();
  };

  const test = document.createElement('button');
  test.textContent = 'جرّب الإشعار';
  test.onclick = () => {
    if (!supported || Notification.permission !== 'granted') return alert('فعّل التذكير أولاً');
    sendNote('مساحتي: تجربة', reminderText());
  };

  const status = document.createElement('p');
  status.className = 'meta';
  status.textContent = !supported
    ? 'الإشعارات غير مدعومة في هذا المتصفح.'
    : s.on
      ? 'التذكير مفعّل. يشتغل لما يكون الموقع مفتوح، أو لما تفتحه بعد الوقت المحدد.'
      : 'التذكير متوقف.';

  row.appendChild(label);
  row.appendChild(btn);
  row.appendChild(test);
  box.appendChild(row);
  box.appendChild(status);
}

// ---------- التحليلات ----------

function computeStats(days) {
  const first = days[0];
  const last = days[days.length - 1];
  const periodTasks = tasks.filter(t => t.due_date && t.due_date >= first && t.due_date <= last);
  const doneTasks = periodTasks.filter(t => effStatus(t) === 'done');
  const logsIn = habitLogs.filter(l => l.log_date >= first && l.log_date <= last);
  const rate = periodTasks.length ? Math.round(doneTasks.length / periodTasks.length * 100) : 0;
  const points = doneTasks.length * 10 + logsIn.length * 5;

  const perDay = days.map(d => ({
    d,
    tasks: tasks.filter(t => t.due_date === d && effStatus(t) === 'done').length,
    habits: logsIn.filter(l => l.log_date === d).length,
  }));

  let best = null;
  for (const p of perDay) {
    const v = p.tasks + p.habits;
    if (v > 0 && (!best || v > best.tasks + best.habits)) best = p;
  }

  let topHab = null;
  for (const h of habits) {
    const c = logsIn.filter(l => l.habit_id === h.id).length;
    if (c > 0 && (!topHab || c > topHab.count)) topHab = { title: h.title, count: c };
  }

  const late = tasks.filter(t => t.due_date && t.due_date < todayStr() && effStatus(t) !== 'done');

  return { first, last, periodTasks, doneTasks, rate, points, habitTotal: logsIn.length, perDay, best, topHab, late, logsIn };
}

function renderStats() {
  const box = $('statsBox');
  if (!box) return;
  const days = periodDates(statsDays);
  const s = computeStats(days);
  box.innerHTML = '';

  const h = document.createElement('h3');
  h.textContent = 'التحليلات';
  box.appendChild(h);

  const seg = document.createElement('div');
  seg.className = 'seg';
  [[7, 'آخر 7 أيام'], [30, 'آخر 30 يوم']].forEach(([n, label]) => {
    const b = document.createElement('button');
    b.className = 'stat-btn' + (statsDays === n ? ' active' : '');
    b.textContent = label;
    b.onclick = () => { statsDays = n; renderStats(); };
    seg.appendChild(b);
  });
  box.appendChild(seg);

  const grid = document.createElement('div');
  grid.className = 'stat-grid';
  grid.innerHTML =
    '<div class="stat-tile"><b>' + s.doneTasks.length + ' / ' + s.periodTasks.length + '</b>مهام منجزة</div>' +
    '<div class="stat-tile"><b>' + s.rate + '%</b>نسبة الإنجاز</div>' +
    '<div class="stat-tile"><b>' + s.habitTotal + '</b>تسجيلات عادات</div>' +
    '<div class="stat-tile"><b>' + s.points + '</b>نقاط الفترة</div>';
  box.appendChild(grid);

  // الرسم البياني
  const maxVal = Math.max(1, ...s.perDay.map(p => Math.max(p.tasks, p.habits)));
  const chart = document.createElement('div');
  chart.className = 'chart' + (statsDays === 30 ? ' dense' : '');
  s.perDay.forEach(p => {
    const col = document.createElement('div');
    col.className = 'chart-col';

    const stack = document.createElement('div');
    stack.className = 'chart-stack';
    stack.title = p.d + ': ' + p.tasks + ' مهام، ' + p.habits + ' عادات';

    const b1 = document.createElement('div');
    b1.className = 'chart-bar';
    b1.style.height = Math.round(p.tasks / maxVal * 110) + 'px';

    const b2 = document.createElement('div');
    b2.className = 'chart-bar habit';
    b2.style.height = Math.round(p.habits / maxVal * 110) + 'px';

    stack.appendChild(b1);
    stack.appendChild(b2);

    const lbl = document.createElement('div');
    lbl.className = 'chart-lbl';
    lbl.textContent = dayLabel(p.d, statsDays);

    col.appendChild(stack);
    col.appendChild(lbl);
    chart.appendChild(col);
  });
  box.appendChild(chart);

  const legend = document.createElement('p');
  legend.className = 'meta';
  legend.textContent = 'الأخضر: مهام منجزة | الأزرق: عادات';
  box.appendChild(legend);

  const insights = document.createElement('div');
  insights.className = 'meta';
  insights.innerHTML =
    (s.best ? 'أفضل يوم: ' + esc(s.best.d) + ' (' + (s.best.tasks + s.best.habits) + ' إنجاز)' : 'ما فيه إنجازات في هذي الفترة') +
    '<br>' + (s.topHab ? 'أكثر عادة التزمت فيها: ' + esc(s.topHab.title) + ' (' + s.topHab.count + ' مرة)' : 'ما فيه عادات مسجلة') +
    '<br>المهام المتأخرة الحين: ' + s.late.length;
  box.appendChild(insights);

  const exp = document.createElement('button');
  exp.textContent = 'تصدير الملخص (PDF)';
  exp.style.marginTop = '10px';
  exp.onclick = exportSummary;
  box.appendChild(exp);
}

// ---------- تصدير الملخص ----------

function exportSummary() {
  const days = periodDates(statsDays);
  const s = computeStats(days);
  const w = window.open('', '_blank');
  if (!w) return alert('المتصفح منع النافذة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم حاول مرة ثانية.');

  const title = 'ملخص مساحتي: ' + s.first + ' إلى ' + s.last;
  const doneList = s.doneTasks.map(t => '<li>' + esc(t.title) + '</li>').join('') || '<li>ما فيه</li>';
  const lateList = s.late.map(t => '<li>' + esc(t.title) + ' (' + esc(t.due_date) + ')</li>').join('') || '<li>ما فيه</li>';
  const habitList = habits.map(h => {
    const c = s.logsIn.filter(l => l.habit_id === h.id).length;
    return '<li>' + esc(h.title) + ': ' + c + ' مرة</li>';
  }).join('') || '<li>ما فيه</li>';
  const best = s.best ? esc(s.best.d) + ' (' + (s.best.tasks + s.best.habits) + ' إنجاز)' : 'ما فيه';

  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  body { font-family: Tahoma, Arial, sans-serif; color: #222; padding: 24px; line-height: 1.7; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 18px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .tile { border: 1px solid #ccc; border-radius: 8px; padding: 8px; text-align: center; }
  .tile b { display: block; font-size: 20px; }
  ul { padding-right: 20px; margin: 4px 0; }
  .meta { color: #666; font-size: 13px; }
  @media print { button { display: none; } }
</style></head><body>
<h1>${esc(title)}</h1>
<p class="meta">أُنشئ في ${esc(new Date().toLocaleString('ar'))}</p>
<div class="grid">
  <div class="tile"><b>${s.doneTasks.length} / ${s.periodTasks.length}</b>مهام منجزة</div>
  <div class="tile"><b>${s.rate}%</b>نسبة الإنجاز</div>
  <div class="tile"><b>${s.habitTotal}</b>تسجيلات عادات</div>
  <div class="tile"><b>${s.points}</b>نقاط الفترة</div>
</div>
<h2>أفضل يوم</h2><p>${best}</p>
<h2>المهام المنجزة</h2><ul>${doneList}</ul>
<h2>المهام المتأخرة</h2><ul>${lateList}</ul>
<h2>العادات</h2><ul>${habitList}</ul>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// ---------- الربط مع التحميل ----------

const _baseLoadAll = loadAll;
loadAll = async function () {
  await _baseLoadAll();
  statsReady = true;
  renderStats();
  renderNotifyBox();
  checkReminder();
};

setInterval(() => { if (statsReady) checkReminder(); }, 30000);

// ---------- الستايل ----------

(function addStyles() {
  const css = `
    .stat-btn { border: none; background: transparent; padding: 6px 12px; color: var(--muted); font-size: 14px; border-radius: 999px; cursor: pointer; }
    .stat-btn.active { background: var(--bg); color: var(--secondary); font-weight: 700; }
    .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 10px 0; }
    .stat-tile { background: var(--surface); border-radius: 12px; padding: 12px; text-align: center; font-size: 13px; color: var(--muted); }
    .stat-tile b { display: block; font-family: var(--serif); font-size: 24px; color: var(--text); }
    .chart { display: flex; gap: 4px; margin: 12px 0 2px; align-items: flex-end; }
    .chart-col { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .chart-stack { height: 110px; width: 100%; display: flex; align-items: flex-end; justify-content: center; gap: 3px; }
    .chart-bar { width: 10px; background: var(--success); border-radius: 6px 6px 3px 3px; transition: height 0.6s ease; }
    .chart-bar.habit { background: var(--secondary); }
    .chart.dense .chart-bar { width: 5px; }
    .chart-lbl { font-size: 11px; color: var(--muted); }
    .banner { background: var(--surface); border-right: 4px solid var(--accent); border-radius: 12px; padding: 12px 14px; margin: 10px 0; }
  `;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();