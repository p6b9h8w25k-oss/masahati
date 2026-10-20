// ============ مؤقت التركيز والبحث الشامل ============

const FOCUS_MIN = 25;
const BREAK_MIN = 5;
let pomo = { mode: 'focus', left: FOCUS_MIN * 60, running: false, timer: null, subject: '' };

const ITEM_LABELS = {
  subject: 'مادة', subject_item: 'محتوى مادة', focus: 'تركيز', wish: 'أمنية',
  milestone: 'خطوة هدف', tool: 'أداة', achievement: 'إنجاز', note: 'ملاحظة',
  idea: 'فكرة', person: 'شخص', expense: 'مالية', link: 'رابط', skill: 'مهارة',
};

// ---------- مؤقت التركيز ----------

function pomoTotal() {
  return pomo.mode === 'focus' ? FOCUS_MIN * 60 : BREAK_MIN * 60;
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function updateFocusText() {
  const el = document.getElementById('focusTime');
  if (el) el.textContent = fmtTime(pomo.left);
}

function pomoStart() {
  if (pomo.running) return;
  pomo.running = true;
  pomo.timer = setInterval(() => {
    pomo.left -= 1;
    if (pomo.left <= 0) {
      pomoFinish();
      return;
    }
    updateFocusText();
  }, 1000);
  renderFocus();
}

function pomoPause() {
  pomo.running = false;
  clearInterval(pomo.timer);
  renderFocus();
}

function pomoReset() {
  pomoPause();
  pomo.left = pomoTotal();
  renderFocus();
}

function pomoSwitch() {
  pomoPause();
  pomo.mode = pomo.mode === 'focus' ? 'break' : 'focus';
  pomo.left = pomoTotal();
  renderFocus();
}

async function pomoFinish() {
  pomoPause();
  if (pomo.mode === 'focus') {
    const { error } = await db.from('items').insert({
      kind: 'focus',
      title: 'جلسة تركيز ' + FOCUS_MIN + ' دقيقة',
      extra: { minutes: FOCUS_MIN, date: todayStr(), subject_id: pomo.subject || null },
    });
    if (error) alert(error.message);
    if (!sendNote('مساحتي: خلصت الجلسة', 'أحسنت، ' + FOCUS_MIN + ' دقيقة تركيز. خذ استراحة قصيرة.')) {
      alert('أحسنت، خلصت جلسة تركيز ' + FOCUS_MIN + ' دقيقة. خذ استراحة.');
    }
    pomo.mode = 'break';
  } else {
    if (!sendNote('مساحتي: انتهت الاستراحة', 'يلا نرجع للتركيز.')) {
      alert('انتهت الاستراحة. يلا نرجع للتركيز.');
    }
    pomo.mode = 'focus';
  }
  pomo.left = pomoTotal();
  loadAll();
}

function focusMinutes(from, to) {
  return items
    .filter(i => i.kind === 'focus' && i.extra && i.extra.date >= from && i.extra.date <= to)
    .reduce((s, i) => s + (Number(i.extra.minutes) || 0), 0);
}

function renderFocus() {
  const box = $('focusBox');
  if (!box) return;
  box.innerHTML = '';

  const h = document.createElement('h3');
  h.textContent = 'مؤقت التركيز';
  box.appendChild(h);

  const row = document.createElement('div');
  row.className = 'more-form';

  const sel = document.createElement('select');
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'بدون مادة';
  sel.appendChild(none);
  items.filter(i => i.kind === 'subject').forEach(s => {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.title;
    if (s.id === pomo.subject) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = () => { pomo.subject = sel.value; };
  row.appendChild(sel);
  box.appendChild(row);

  const clock = document.createElement('div');
  clock.id = 'focusTime';
  clock.className = 'focus-clock';
  clock.textContent = fmtTime(pomo.left);
  box.appendChild(clock);

  const label = document.createElement('p');
  label.className = 'meta';
  label.textContent = pomo.mode === 'focus' ? 'وقت التركيز' : 'وقت الاستراحة';
  box.appendChild(label);

  const btns = document.createElement('div');
  btns.className = 'more-form';
  const startBtn = document.createElement('button');
  startBtn.textContent = pomo.running ? 'إيقاف مؤقت' : 'ابدأ';
  startBtn.onclick = () => (pomo.running ? pomoPause() : pomoStart());
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'إعادة';
  resetBtn.onclick = pomoReset;
  const switchBtn = document.createElement('button');
  switchBtn.textContent = pomo.mode === 'focus' ? 'استراحة' : 'تركيز';
  switchBtn.onclick = pomoSwitch;
  btns.appendChild(startBtn);
  btns.appendChild(resetBtn);
  btns.appendChild(switchBtn);
  box.appendChild(btns);

  const t = todayStr();
  const [ws, we] = weekOf(t);
  const stats = document.createElement('div');
  stats.className = 'stat-grid';
  stats.innerHTML = statTile(focusMinutes(t, t) + ' د', 'تركيز اليوم') +
    statTile(focusMinutes(ws, we) + ' د', 'تركيز هذا الأسبوع');
  box.appendChild(stats);
}

// ---------- البحث الشامل ----------

function searchAll(q) {
  const out = [];
  const has = (...fields) => fields.some(f => String(f || '').toLowerCase().includes(q));

  for (const t of tasks) {
    if (has(t.title, t.notes)) out.push({ type: 'مهمة', title: t.title, detail: PRIORITY_NAMES[t.priority] + (t.due_date ? ' | ' + t.due_date : '') });
  }
  for (const g of goals) {
    if (has(g.title)) out.push({ type: 'هدف', title: g.title, detail: TERM_NAMES[g.term] || '' });
  }
  for (const h of habits) {
    if (has(h.title)) out.push({ type: 'عادة', title: h.title, detail: daysLabel(h) });
  }
  for (const i of items) {
    if (i.kind === 'vault') continue;
    if (has(i.title, i.body)) {
      out.push({ type: ITEM_LABELS[i.kind] || i.kind, title: i.title, detail: i.body || '' });
    }
  }
  return out.slice(0, 50);
}

function renderSearch() {
  const box = $('searchBox');
  if (!box) return;

  // نبني الحقل مرة وحدة عشان ما يفقد التركيز وقت الكتابة
  if (!box.dataset.built) {
    box.dataset.built = '1';
    const h = document.createElement('h3');
    h.textContent = 'بحث';
    box.appendChild(h);
    const input = document.createElement('input');
    input.id = 'searchInput';
    input.placeholder = 'ابحث في كل شي...';
    input.style.width = '95%';
    input.oninput = () => drawSearchResults(input.value);
    box.appendChild(input);
    const results = document.createElement('div');
    results.id = 'searchResults';
    box.appendChild(results);
  }
  drawSearchResults(($('searchInput') || {}).value || '');
}

function drawSearchResults(value) {
  const results = $('searchResults');
  if (!results) return;
  results.innerHTML = '';
  const q = value.trim().toLowerCase();
  if (!q) {
    const p = document.createElement('div');
    p.className = 'meta';
    p.textContent = 'اكتب كلمة، وبتلقى النتائج من المهام والأهداف والعادات وكل الأقسام.';
    results.appendChild(p);
    return;
  }
  const found = searchAll(q);
  if (found.length === 0) {
    const p = document.createElement('div');
    p.className = 'meta';
    p.textContent = 'ما لقيت نتائج.';
    results.appendChild(p);
    return;
  }
  for (const r of found) {
    const div = document.createElement('div');
    div.className = 'task';
    const info = document.createElement('div');
    info.className = 'info';
    const type = document.createElement('div');
    type.className = 'meta';
    type.textContent = r.type;
    const t = document.createElement('strong');
    t.textContent = r.title;
    const d = document.createElement('div');
    d.className = 'meta';
    d.textContent = r.detail;
    info.appendChild(type);
    info.appendChild(t);
    info.appendChild(d);
    div.appendChild(info);
    results.appendChild(div);
  }
}

// ---------- الربط مع التحميل ----------

const _loadAllBeforeExtra4 = loadAll;
loadAll = async function () {
  await _loadAllBeforeExtra4();
  renderFocus();
  renderSearch();
};

// ---------- الستايل ----------

(function addStyles4() {
  const css = `
    .focus-clock { font-family: var(--serif); font-size: 64px; text-align: center; margin: 10px 0 0; letter-spacing: 0.04em; }
  `;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();