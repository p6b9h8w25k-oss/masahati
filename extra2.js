// ============ النسخ الاحتياطي، أعياد الميلاد، الماليات، الأمنيات ============

const BACKUP_TABLES = ['goals', 'tasks', 'habits', 'habit_logs', 'items'];
let finMonth = todayStr().slice(0, 7);

function statTile(v, label) {
  return '<div class="stat-tile"><b>' + esc(v) + '</b>' + esc(label) + '</div>';
}

// ---------- النسخ الاحتياطي ----------

async function exportBackup() {
  const out = { app: 'masahati', version: 1, exported_at: new Date().toISOString() };
  for (const t of BACKUP_TABLES) {
    const { data, error } = await db.from(t).select('*');
    if (error) return alert(error.message);
    out[t] = data;
  }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'masahati-backup-' + todayStr() + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function importBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (e) {
    return alert('الملف مو صالح');
  }
  if (data.app !== 'masahati') return alert('هذا الملف مو نسخة احتياطية من مساحتي');
  if (!confirm('الاستعادة بتضيف البيانات، وتحدث اللي موجود بنفس الرقم. تكمل؟')) return;

  for (const t of BACKUP_TABLES) {
    const rows = (data[t] || []).map(r => {
      const { user_id, ...rest } = r;
      return rest;
    });
    if (!rows.length) continue;
    const conflict = t === 'habit_logs' ? 'habit_id,log_date' : 'id';
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await db.from(t).upsert(rows.slice(i, i + 200), { onConflict: conflict });
      if (error) return alert('خطأ في ' + t + ': ' + error.message);
    }
  }
  alert('تمت الاستعادة بنجاح');
  loadAll();
}

function renderBackup() {
  const box = $('backupBox');
  if (!box) return;
  box.innerHTML = '';

  const h = document.createElement('h3');
  h.textContent = 'النسخ الاحتياطي';
  box.appendChild(h);

  const p = document.createElement('p');
  p.className = 'meta';
  p.textContent = 'نزّل نسخة من بياناتك كملف واحفظه في مكان آمن. الخزنة تبقى مشفرة داخل النسخة.';
  box.appendChild(p);

  const row = document.createElement('div');
  row.className = 'more-form';

  const expBtn = document.createElement('button');
  expBtn.textContent = 'تنزيل نسخة احتياطية';
  expBtn.onclick = exportBackup;

  const label = document.createElement('label');
  label.textContent = 'استعادة من ملف: ';
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'application/json,.json';
  file.onchange = () => {
    if (file.files[0]) importBackup(file.files[0]);
    file.value = '';
  };
  label.appendChild(file);

  row.appendChild(expBtn);
  row.appendChild(label);
  box.appendChild(row);
}

// ---------- أعياد الميلاد في التقويم ----------

function birthdaysIn(first, last) {
  const people = items.filter(i => i.kind === 'person' && i.extra && i.extra.birthday);
  const out = [];
  let d = first;
  while (d <= last) {
    const md = d.slice(5);
    for (const p of people) {
      if (p.extra.birthday.slice(5) === md) out.push({ date: d, name: p.title });
    }
    d = addDays(d, 1);
  }
  return out;
}

function renderEvents() {
  const body = $('calBody');
  if (!body) return;

  let first;
  let last;
  if (calView === 'month') {
    const a = parseDate(calAnchor);
    first = formatDate(new Date(a.getFullYear(), a.getMonth(), 1));
    last = formatDate(new Date(a.getFullYear(), a.getMonth() + 1, 0));
  } else if (calView === 'week') {
    [first, last] = weekOf(calAnchor);
  } else {
    first = calAnchor;
    last = calAnchor;
  }

  const list = birthdaysIn(first, last);
  const box = document.createElement('div');
  box.className = 'day-block';

  const h = document.createElement('h4');
  h.textContent = 'المناسبات';
  box.appendChild(h);

  if (list.length === 0) {
    const p = document.createElement('div');
    p.className = 'meta';
    p.textContent = 'ما فيه أعياد ميلاد في هذي الفترة.';
    box.appendChild(p);
  } else {
    for (const e of list) {
      const line = document.createElement('div');
      line.className = 'item-line';
      line.textContent = '🎂 ' + e.name;
      const d = document.createElement('span');
      d.className = 'meta';
      d.textContent = e.date;
      line.appendChild(d);
      box.appendChild(line);
    }
  }
  body.appendChild(box);
}

const _baseRenderCalendar = renderCalendar;
renderCalendar = function () {
  _baseRenderCalendar();
  renderEvents();
};

// ---------- الماليات الشهرية ----------

function renderFinance() {
  const box = $('financeBox');
  if (!box) return;
  box.innerHTML = '';

  const h = document.createElement('h3');
  h.textContent = 'الماليات الشهرية';
  box.appendChild(h);

  const row = document.createElement('div');
  row.className = 'more-form';
  const month = document.createElement('input');
  month.type = 'month';
  month.value = finMonth;
  month.onchange = () => {
    finMonth = month.value || todayStr().slice(0, 7);
    renderFinance();
  };
  row.appendChild(month);
  box.appendChild(row);

  const entries = items
    .filter(i => i.kind === 'expense' && i.extra && i.extra.date && i.extra.date.startsWith(finMonth))
    .sort((a, b) => (b.extra.date || '').localeCompare(a.extra.date || ''));

  let inc = 0;
  let exp = 0;
  for (const e of entries) {
    const v = Number(e.extra.amount) || 0;
    if (e.extra.type === 'income') inc += v;
    else exp += v;
  }

  const grid = document.createElement('div');
  grid.className = 'stat-grid';
  grid.innerHTML = statTile(inc, 'الدخل') + statTile(exp, 'المصروف') + statTile(inc - exp, 'الباقي');
  box.appendChild(grid);

  if (entries.length === 0) {
    const p = document.createElement('div');
    p.className = 'meta';
    p.textContent = 'ما فيه حركات مالية في هذا الشهر. أضفها من قسم عام ← مالية، وتأكد إنك حطيت التاريخ.';
    box.appendChild(p);
    return;
  }

  for (const e of entries) {
    const div = document.createElement('div');
    div.className = 'task';
    const info = document.createElement('div');
    info.className = 'info';
    const t = document.createElement('strong');
    t.textContent = e.title;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = (e.extra.type === 'income' ? 'دخل' : 'مصروف') + ' | ' + (e.extra.amount ?? '') + ' | ' + e.extra.date;
    info.appendChild(t);
    info.appendChild(meta);
    const del = document.createElement('button');
    del.textContent = 'حذف';
    del.onclick = () => deleteItem(e.id);
    div.appendChild(info);
    div.appendChild(del);
    box.appendChild(div);
  }
}

// ---------- قائمة الأمنيات ----------

function renderWishes() {
  const box = $('wishBox');
  if (!box) return;
  box.innerHTML = '';

  const h = document.createElement('h3');
  h.textContent = 'قائمة الأمنيات';
  box.appendChild(h);

  const form = document.createElement('div');
  form.className = 'more-form';
  const name = document.createElement('input');
  name.placeholder = 'الشي اللي تبيه';
  const price = document.createElement('input');
  price.type = 'number';
  price.placeholder = 'السعر';
  const addBtn = document.createElement('button');
  addBtn.textContent = 'إضافة';
  addBtn.onclick = async () => {
    const t = name.value.trim();
    if (!t) return alert('اكتب اسم الشي');
    const { error } = await db.from('items').insert({
      kind: 'wish',
      title: t,
      extra: { price: Number(price.value) || 0, bought: false },
    });
    if (error) return alert(error.message);
    name.value = '';
    price.value = '';
    loadAll();
  };
  form.appendChild(name);
  form.appendChild(price);
  form.appendChild(addBtn);
  box.appendChild(form);

  const wishes = items.filter(i => i.kind === 'wish');
  const left = wishes.filter(w => !(w.extra && w.extra.bought));
  const total = left.reduce((s, w) => s + (Number(w.extra.price) || 0), 0);

  if (wishes.length) {
    const sum = document.createElement('p');
    sum.className = 'meta';
    sum.textContent = 'المجموع المتبقي: ' + total;
    box.appendChild(sum);
  }

  for (const w of wishes) {
    const bought = !!(w.extra && w.extra.bought);
    const div = document.createElement('div');
    div.className = 'task' + (bought ? ' st-done' : '');
    const info = document.createElement('div');
    info.className = 'info';
    const t = document.createElement('strong');
    t.textContent = w.title;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = 'السعر: ' + (w.extra.price || 0) + (bought ? ' | تم شراؤها' : '');
    info.appendChild(t);
    info.appendChild(meta);

    const toggle = document.createElement('button');
    toggle.textContent = bought ? 'رجّعها' : 'تم الشراء';
    toggle.onclick = async () => {
      const { error } = await db.from('items').update({ extra: { ...w.extra, bought: !bought } }).eq('id', w.id);
      if (error) return alert(error.message);
      loadAll();
    };

    const del = document.createElement('button');
    del.textContent = 'حذف';
    del.onclick = () => deleteItem(w.id);

    div.appendChild(info);
    div.appendChild(toggle);
    div.appendChild(del);
    box.appendChild(div);
  }

  if (wishes.length === 0) {
    const p = document.createElement('div');
    p.className = 'meta';
    p.textContent = 'ما فيه أمنيات بعد.';
    box.appendChild(p);
  }
}

// ---------- الربط مع التحميل ----------

const _loadAllBeforeExtra2 = loadAll;
loadAll = async function () {
  await _loadAllBeforeExtra2();
  renderFinance();
  renderWishes();
};

renderBackup();