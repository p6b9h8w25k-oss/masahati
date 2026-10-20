// ============ خط الإنجازات، خطوات الأهداف، الأدوات ============

function achievementDate(it) {
  return (it.extra && it.extra.date) || (it.created_at || '').slice(0, 10);
}

// ---------- خط الإنجازات ----------

function renderTimeline() {
  const box = $('timelineBox');
  if (!box) return;
  box.innerHTML = '';

  const h = document.createElement('h3');
  h.textContent = 'خط الإنجازات';
  box.appendChild(h);

  const list = items
    .filter(i => i.kind === 'achievement')
    .sort((a, b) => achievementDate(b).localeCompare(achievementDate(a)));

  if (list.length === 0) {
    const p = document.createElement('div');
    p.className = 'meta';
    p.textContent = 'ما فيه إنجازات بعد. أضفها من عام ← إنجازات، وحط لها تاريخ.';
    box.appendChild(p);
    return;
  }

  let lastYear = '';
  for (const it of list) {
    const date = achievementDate(it);
    const year = date.slice(0, 4) || 'بدون تاريخ';
    if (year !== lastYear) {
      const yh = document.createElement('h4');
      yh.textContent = year;
      yh.style.marginTop = '16px';
      box.appendChild(yh);
      lastYear = year;
    }

    const line = document.createElement('div');
    line.className = 'item-line';
    const info = document.createElement('div');
    const t = document.createElement('strong');
    t.textContent = it.title;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = date || 'بدون تاريخ';
    info.appendChild(t);
    info.appendChild(meta);
    if (it.body) {
      const n = document.createElement('div');
      n.className = 'notes';
      n.textContent = it.body;
      info.appendChild(n);
    }
    line.appendChild(info);
    box.appendChild(line);
  }
}

// ---------- خطوات الأهداف ----------

function renderMilestones() {
  const box = $('milestoneBox');
  if (!box) return;
  box.innerHTML = '';

  const h = document.createElement('h3');
  h.textContent = 'خطوات الأهداف';
  box.appendChild(h);

  if (goals.length === 0) {
    const p = document.createElement('div');
    p.className = 'meta';
    p.textContent = 'أضف هدف أولاً من صفحة الأهداف.';
    box.appendChild(p);
    return;
  }

  // نموذج الإضافة
  const form = document.createElement('div');
  form.className = 'more-form';
  const sel = document.createElement('select');
  for (const g of goals) {
    const o = document.createElement('option');
    o.value = g.id;
    o.textContent = g.title;
    sel.appendChild(o);
  }
  const name = document.createElement('input');
  name.placeholder = 'خطوة جديدة';
  const addBtn = document.createElement('button');
  addBtn.textContent = 'إضافة خطوة';
  addBtn.onclick = async () => {
    const t = name.value.trim();
    if (!t) return alert('اكتب الخطوة');
    const { error } = await db.from('items').insert({
      kind: 'milestone',
      title: t,
      extra: { goal_id: sel.value, done: false },
    });
    if (error) return alert(error.message);
    name.value = '';
    loadAll();
  };
  form.appendChild(sel);
  form.appendChild(name);
  form.appendChild(addBtn);
  box.appendChild(form);

  // الأهداف مع خطواتها
  const all = items.filter(i => i.kind === 'milestone' && i.extra);
  let shown = 0;
  for (const g of goals) {
    const ms = all.filter(m => m.extra.goal_id === g.id);
    if (ms.length === 0) continue;
    shown++;

    const doneCount = ms.filter(m => m.extra.done).length;
    const pct = Math.round(doneCount / ms.length * 100);

    const gh = document.createElement('h4');
    gh.textContent = g.title + ' (' + doneCount + ' / ' + ms.length + ')';
    box.appendChild(gh);

    const bar = document.createElement('div');
    bar.className = 'bar';
    const fill = document.createElement('div');
    fill.className = 'barFill';
    fill.style.width = pct + '%';
    bar.appendChild(fill);
    box.appendChild(bar);

    for (const m of ms) {
      const line = document.createElement('div');
      line.className = 'item-line';
      const t = document.createElement('span');
      t.textContent = m.title;
      if (m.extra.done) t.className = 'done-text';

      const toggle = document.createElement('button');
      toggle.textContent = m.extra.done ? 'رجّعها' : 'تمت';
      toggle.onclick = async () => {
        const { error } = await db.from('items').update({ extra: { ...m.extra, done: !m.extra.done } }).eq('id', m.id);
        if (error) return alert(error.message);
        loadAll();
      };

      const del = document.createElement('button');
      del.textContent = 'حذف';
      del.onclick = () => deleteItem(m.id);

      line.appendChild(t);
      line.appendChild(toggle);
      line.appendChild(del);
      box.appendChild(line);
    }
  }

  if (shown === 0) {
    const p = document.createElement('div');
    p.className = 'meta';
    p.textContent = 'ما أضفت خطوات لأي هدف بعد. اختر الهدف واكتب أول خطوة فوق.';
    box.appendChild(p);
  }
}

// ---------- الأدوات والروابط ----------

function renderTools() {
  const box = $('toolsBox');
  if (!box) return;
  box.innerHTML = '';

  const h = document.createElement('h3');
  h.textContent = 'أدواتي وروابطي';
  box.appendChild(h);

  const form = document.createElement('div');
  form.className = 'more-form';
  const name = document.createElement('input');
  name.placeholder = 'اسم الأداة';
  const url = document.createElement('input');
  url.placeholder = 'الرابط مثل: example.com';
  const addBtn = document.createElement('button');
  addBtn.textContent = 'إضافة';
  addBtn.onclick = async () => {
    const t = name.value.trim();
    let u = url.value.trim();
    if (!t || !u) return alert('اكتب الاسم والرابط');
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    const { error } = await db.from('items').insert({ kind: 'tool', title: t, extra: { url: u } });
    if (error) return alert(error.message);
    name.value = '';
    url.value = '';
    loadAll();
  };
  form.appendChild(name);
  form.appendChild(url);
  form.appendChild(addBtn);
  box.appendChild(form);

  const tools = items.filter(i => i.kind === 'tool' && i.extra && i.extra.url);
  for (const it of tools) {
    const div = document.createElement('div');
    div.className = 'task';
    const info = document.createElement('div');
    info.className = 'info';
    const t = document.createElement('strong');
    t.textContent = it.title;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = it.extra.url;
    info.appendChild(t);
    info.appendChild(meta);

    const open = document.createElement('a');
    open.href = it.extra.url;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.className = 'btn-link';
    open.textContent = 'فتح';

    const del = document.createElement('button');
    del.textContent = 'حذف';
    del.onclick = () => deleteItem(it.id);

    div.appendChild(info);
    div.appendChild(open);
    div.appendChild(del);
    box.appendChild(div);
  }

  if (tools.length === 0) {
    const p = document.createElement('div');
    p.className = 'meta';
    p.textContent = 'ما أضفت أدوات بعد. أضف مواقعك وتطبيقاتك المفضلة هنا.';
    box.appendChild(p);
  }
}

// ---------- الربط مع التحميل ----------

const _loadAllBeforeExtra3 = loadAll;
loadAll = async function () {
  await _loadAllBeforeExtra3();
  renderTimeline();
  renderMilestones();
  renderTools();
};

// ---------- الستايل ----------

(function addStyles3() {
  const css = `
    .done-text { text-decoration: line-through; opacity: 0.6; }
    .btn-link { display: inline-block; padding: 8px 16px; border-radius: 999px; background: var(--accent); color: #fff; text-decoration: none; font-size: 15px; }
  `;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();