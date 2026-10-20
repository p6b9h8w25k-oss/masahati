const db = supabase.createClient(
  'https://ymdqheyssnpsnkxpywrc.supabase.co',
  'sb_publishable_xyawp1KnXU0apB0dlkQARg_jgjxI2Y7'
);

const PRIORITY_NAMES = { urgent: 'عاجلة', high: 'عالية', normal: 'متوسطة', low: 'منخفضة', none: 'غير مهمة' };
const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3, none: 4 };
const STATUS_NAMES = {
  upcoming: 'لم يأت وقتها',
  done: 'منجزة',
  partial: 'منجزة جزئياً',
  postponed: 'مؤجلة',
  missed: 'لم تُنجز',
};
const TERM_NAMES = { daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري', yearly: 'سنوي' };
const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const SHORT_DAY_NAMES = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const QUOTES = [
  'خطوة صغيرة اليوم أحسن من خطة كبيرة ما تبدأ.',
  'كل مهمة تنجزها تقربك من نسختك الأفضل.',
  'ركز على اللي تقدر تسويه الحين.',
  'التقدم البطيء يبقى تقدم.',
  'ابدأ بأهم شي، والباقي يجي بعده.',
];

// أقسام "المزيد": كل قسم له حقول خاصة
const KINDS = {
  note: { label: 'ملاحظات', titleLabel: 'عنوان الملاحظة', bodyLabel: 'اكتب ملاحظتك', fields: [] },
  achievement: { label: 'إنجازات', titleLabel: 'الإنجاز', bodyLabel: 'وصف أو تفاصيل', fields: [
    { key: 'date', label: 'التاريخ', type: 'date' },
  ] },
  idea: { label: 'أفكار ومشاريع', titleLabel: 'اسم الفكرة', bodyLabel: 'تفاصيل الفكرة', fields: [
    { key: 'category', label: 'التصنيف', type: 'text', placeholder: 'مثلاً: مشروع، دراسة' },
  ] },
  person: { label: 'أشخاص', titleLabel: 'الاسم', bodyLabel: 'نبذة أو معلومات', fields: [
    { key: 'relation', label: 'العلاقة', type: 'text', placeholder: 'صديق، أخ...' },
    { key: 'birthday', label: 'تاريخ الميلاد', type: 'date' },
    { key: 'phone', label: 'الرقم', type: 'text' },
  ] },
  expense: { label: 'مالية', titleLabel: 'الوصف', bodyLabel: 'ملاحظة (اختياري)', fields: [
    { key: 'amount', label: 'المبلغ', type: 'number' },
    { key: 'type', label: 'النوع', type: 'select', options: [['expense', 'مصروف'], ['income', 'دخل']] },
    { key: 'date', label: 'التاريخ', type: 'date' },
  ] },
  link: { label: 'روابط مهمة', titleLabel: 'اسم الرابط', bodyLabel: 'وصف (اختياري)', fields: [
    { key: 'url', label: 'الرابط', type: 'url', placeholder: 'https://...' },
  ] },
  skill: { label: 'مهارات', titleLabel: 'اسم المهارة', bodyLabel: 'وصف أو خطوات التعلم', fields: [] },
};

const $ = id => document.getElementById(id);
let tasks = [];
let goals = [];
let habits = [];
let habitLogs = [];
let items = [];
let moreKind = 'note';
let currentName = '';
let editingId = null;
let editingHabitId = null;
let calView = 'month';
let calAnchor = todayStr();

function formatDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function todayStr() {
  return formatDate(new Date());
}

function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  return formatDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

function addMonths(dateStr, n) {
  const d = parseDate(dateStr);
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last));
  return formatDate(t);
}

function effStatus(t) {
  return t.status === 'pending' ? 'upcoming' : t.status;
}

function showScreen(loggedIn) {
  $('login').classList.toggle('hidden', loggedIn);
  $('app').classList.toggle('hidden', !loggedIn);
}

function showPage(name) {
  $('page-home').classList.toggle('hidden', name !== 'home');
  $('page-tasks').classList.toggle('hidden', name !== 'tasks');
  $('page-calendar').classList.toggle('hidden', name !== 'calendar');
  $('page-more').classList.toggle('hidden', name !== 'more');
  $('page-goals').classList.toggle('hidden', name !== 'goals');
  $('page-habits').classList.toggle('hidden', name !== 'habits');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === name));
  if (name === 'calendar') renderCalendar();
  if (name === 'more') renderMore();
}

document.querySelectorAll('.nav-btn').forEach(b => b.onclick = () => showPage(b.dataset.page));

async function init() {
  const { data } = await db.auth.getSession();
  showScreen(!!data.session);
  if (data.session) {
    showPage('home');
    loadAll();
  }
}

$('signupBtn').onclick = async () => {
  const { error } = await db.auth.signUp({
    email: $('email').value,
    password: $('password').value,
  });
  alert(error ? error.message : 'تم التسجيل، افتح إيميلك واضغط رابط التأكيد');
};

$('loginBtn').onclick = async () => {
  const { error } = await db.auth.signInWithPassword({
    email: $('email').value,
    password: $('password').value,
  });
  if (error) return alert(error.message);
  showScreen(true);
  showPage('home');
  loadAll();
};

$('logoutBtn').onclick = async () => {
  await db.auth.signOut();
  tasks = [];
  goals = [];
  habits = [];
  habitLogs = [];
  items = [];
  showScreen(false);
};

async function loadAll() {
  const { data: { user } } = await db.auth.getUser();
  currentName = user && user.email ? user.email.split('@')[0] : '';

  const g = await db.from('goals').select('*').order('created_at', { ascending: false });
  if (g.error) return alert(g.error.message);
  goals = g.data;

  const t = await db.from('tasks').select('*').order('created_at', { ascending: false });
  if (t.error) return alert(t.error.message);
  tasks = t.data;

  const h = await db.from('habits').select('*').order('created_at', { ascending: false });
  if (h.error) return alert(h.error.message);
  habits = h.data;

  const l = await db.from('habit_logs').select('*');
  if (l.error) return alert(l.error.message);
  habitLogs = l.data;

  const it = await db.from('items').select('*').order('created_at', { ascending: false });
  if (it.error) return alert(it.error.message);
  items = it.data;

  populateGoalSelect();
  render();
  renderArchive();
  renderHome();
  renderGoals();
  renderHabits();
  renderCalendar();
  renderMore();
}

// ---------- المهام ----------

$('addBtn').onclick = async () => {
  const title = $('taskTitle').value.trim();
  if (!title) return alert('اكتب عنوان المهمة');

  const { error } = await db.from('tasks').insert({
    title,
    priority: $('taskPriority').value,
    due_date: $('taskDate').value || null,
    goal_id: $('taskGoal').value || null,
    status: 'upcoming',
  });
  if (error) return alert(error.message);

  $('taskTitle').value = '';
  $('taskDate').value = '';
  $('taskGoal').value = '';
  loadAll();
};

async function updateStatus(id, status) {
  const { error } = await db.from('tasks').update({ status }).eq('id', id);
  if (error) alert(error.message);
  loadAll();
}

async function deleteTask(id) {
  if (!confirm('تبي تحذف هذي المهمة؟')) return;
  const { error } = await db.from('tasks').delete().eq('id', id);
  if (error) alert(error.message);
  loadAll();
}

async function saveEdit(id, fields) {
  const { error } = await db.from('tasks').update(fields).eq('id', id);
  if (error) return alert(error.message);
  editingId = null;
  loadAll();
}

function startEdit(id) {
  editingId = id;
  render();
}

function cancelEdit() {
  editingId = null;
  render();
}

function setTaskView(v) {
  $('tabActive').classList.toggle('active', v === 'active');
  $('tabArchive').classList.toggle('active', v === 'archive');
  $('list').classList.toggle('hidden', v !== 'active');
  $('archiveList').classList.toggle('hidden', v !== 'archive');
  $('sortBy').parentElement.classList.toggle('hidden', v !== 'active');
}

$('tabActive').onclick = () => setTaskView('active');
$('tabArchive').onclick = () => setTaskView('archive');

$('sortBy').onchange = render;

function goalName(id) {
  const g = goals.find(x => x.id === id);
  return g ? g.title : '';
}

function populateGoalSelect() {
  const sel = $('taskGoal');
  const current = sel.value;
  sel.innerHTML = '<option value="">بدون هدف</option>';
  for (const g of goals) {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.title;
    sel.appendChild(opt);
  }
  sel.value = current;
}

function makeStatusSelect(t) {
  const status = effStatus(t);
  const select = document.createElement('select');
  for (const key of Object.keys(STATUS_NAMES)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = STATUS_NAMES[key];
    if (key === status) opt.selected = true;
    select.appendChild(opt);
  }
  select.onchange = () => updateStatus(t.id, select.value);
  return select;
}

function buildEditForm(t) {
  const form = document.createElement('div');
  form.className = 'edit-form';

  const title = document.createElement('input');
  title.value = t.title;
  title.placeholder = 'العنوان';

  const notes = document.createElement('textarea');
  notes.value = t.notes || '';
  notes.placeholder = 'ملاحظات أو نبذة';

  const priority = document.createElement('select');
  for (const key of Object.keys(PRIORITY_NAMES)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = PRIORITY_NAMES[key];
    if (key === t.priority) opt.selected = true;
    priority.appendChild(opt);
  }

  const date = document.createElement('input');
  date.type = 'date';
  date.value = t.due_date || '';

  const goal = document.createElement('select');
  const noGoal = document.createElement('option');
  noGoal.value = '';
  noGoal.textContent = 'بدون هدف';
  goal.appendChild(noGoal);
  for (const g of goals) {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.title;
    if (g.id === t.goal_id) opt.selected = true;
    goal.appendChild(opt);
  }

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'حفظ';
  saveBtn.onclick = () => {
    const newTitle = title.value.trim();
    if (!newTitle) return alert('العنوان ما يكون فاضي');
    saveEdit(t.id, {
      title: newTitle,
      notes: notes.value.trim() || null,
      priority: priority.value,
      due_date: date.value || null,
      goal_id: goal.value || null,
    });
  };

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'إلغاء';
  cancelBtn.onclick = cancelEdit;

  form.appendChild(title);
  form.appendChild(priority);
  form.appendChild(date);
  form.appendChild(goal);
  form.appendChild(notes);
  form.appendChild(document.createElement('br'));
  form.appendChild(saveBtn);
  form.appendChild(cancelBtn);
  return form;
}

// المهام النشطة فقط (المنجزة تروح للأرشيف)
function render() {
  const active = tasks.filter(t => effStatus(t) !== 'done');
  const sorted = [...active];
  if ($('sortBy').value === 'priority') {
    sorted.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  } else {
    sorted.sort((a, b) => {
      const dateA = a.due_date || '9999-12-31';
      const dateB = b.due_date || '9999-12-31';
      return dateA < dateB ? -1 : dateA > dateB ? 1 : 0;
    });
  }

  const list = $('list');
  list.innerHTML = '';

  for (const t of sorted) {
    const status = effStatus(t);

    const div = document.createElement('div');
    div.className = 'task st-' + status;

    if (editingId === t.id) {
      div.appendChild(buildEditForm(t));
      list.appendChild(div);
      continue;
    }

    const info = document.createElement('div');
    info.className = 'info';
    const title = document.createElement('strong');
    title.textContent = t.title;
    const meta = document.createElement('div');
    meta.className = 'meta';
    let metaText = 'الأولوية: ' + (PRIORITY_NAMES[t.priority] || t.priority);
    if (t.due_date) metaText += ' | الموعد: ' + t.due_date;
    if (t.goal_id && goalName(t.goal_id)) metaText += ' | الهدف: ' + goalName(t.goal_id);
    meta.textContent = metaText;
    info.appendChild(title);
    info.appendChild(meta);
    if (t.notes) {
      const notesDiv = document.createElement('div');
      notesDiv.className = 'notes';
      notesDiv.textContent = t.notes;
      info.appendChild(notesDiv);
    }

    const editBtn = document.createElement('button');
    editBtn.textContent = 'تعديل';
    editBtn.onclick = () => startEdit(t.id);

    const delBtn = document.createElement('button');
    delBtn.textContent = 'حذف';
    delBtn.onclick = () => deleteTask(t.id);

    div.appendChild(info);
    div.appendChild(makeStatusSelect(t));
    div.appendChild(editBtn);
    div.appendChild(delBtn);
    list.appendChild(div);
  }

  if (sorted.length === 0) {
    list.textContent = tasks.length ? 'كل مهامك منجزة. شوفها في الأرشيف.' : 'ما عندك مهام بعد.';
  }
}

// الأرشيف: المهام المنجزة
function renderArchive() {
  const box = $('archiveList');
  box.innerHTML = '';

  const done = tasks
    .filter(t => effStatus(t) === 'done')
    .sort((a, b) => (b.due_date || '').localeCompare(a.due_date || ''));

  for (const t of done) {
    const div = document.createElement('div');
    div.className = 'task st-done';

    const info = document.createElement('div');
    info.className = 'info';
    const title = document.createElement('strong');
    title.textContent = t.title;
    const meta = document.createElement('div');
    meta.className = 'meta';
    let metaText = 'الموعد: ' + (t.due_date || 'بدون موعد');
    if (t.goal_id && goalName(t.goal_id)) metaText += ' | الهدف: ' + goalName(t.goal_id);
    meta.textContent = metaText;
    info.appendChild(title);
    info.appendChild(meta);

    const restoreBtn = document.createElement('button');
    restoreBtn.textContent = 'استرجاع';
    restoreBtn.onclick = () => updateStatus(t.id, 'upcoming');

    const delBtn = document.createElement('button');
    delBtn.textContent = 'حذف';
    delBtn.onclick = () => deleteTask(t.id);

    div.appendChild(info);
    div.appendChild(restoreBtn);
    div.appendChild(delBtn);
    box.appendChild(div);
  }

  if (done.length === 0) {
    box.textContent = 'الأرشيف فاضي. المهام المنجزة تنتقل هنا تلقائياً.';
  }
}

// ---------- التقويم ----------

function weekOf(dateStr) {
  const sunday = addDays(dateStr, -parseDate(dateStr).getDay());
  return [sunday, addDays(sunday, 6)];
}

function tasksOn(day) {
  return tasks.filter(t => t.due_date === day);
}

function dotClass(t, today) {
  if (effStatus(t) === 'done') return 'done';
  if (t.due_date < today) return 'late';
  return 'pend';
}

function renderCalendar() {
  const today = todayStr();
  const body = $('calBody');
  if (!body) return;
  body.innerHTML = '';

  document.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.view === calView));

  if (calView === 'month') {
    $('calTitle').textContent = parseDate(calAnchor).toLocaleDateString('ar', { month: 'long', year: 'numeric' });
    renderMonth(body, today);
  } else if (calView === 'week') {
    const [ws, we] = weekOf(calAnchor);
    $('calTitle').textContent =
      parseDate(ws).toLocaleDateString('ar', { day: 'numeric', month: 'short' }) + ' - ' +
      parseDate(we).toLocaleDateString('ar', { day: 'numeric', month: 'short' });
    renderWeek(body, today);
  } else {
    $('calTitle').textContent = parseDate(calAnchor).toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long' });
    renderDay(body, today);
  }
}

function renderMonth(body, today) {
  const a = parseDate(calAnchor);
  const first = new Date(a.getFullYear(), a.getMonth(), 1);
  const offset = first.getDay();
  const daysInMonth = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate();

  const grid = document.createElement('div');
  grid.className = 'cal-grid';

  SHORT_DAY_NAMES.forEach(n => {
    const h = document.createElement('div');
    h.className = 'cal-head';
    h.textContent = n;
    grid.appendChild(h);
  });

  for (let i = 0; i < offset; i++) {
    const e = document.createElement('div');
    e.className = 'cal-cell other';
    grid.appendChild(e);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(new Date(a.getFullYear(), a.getMonth(), d));
    const list = tasksOn(dateStr);

    const cell = document.createElement('div');
    cell.className = 'cal-cell' + (dateStr === today ? ' today' : '');
    const dn = document.createElement('div');
    dn.className = 'dn';
    dn.textContent = d;
    cell.appendChild(dn);

    if (list.length) {
      const dots = document.createElement('div');
      dots.className = 'cal-dots';
      list.slice(0, 6).forEach(t => {
        const dot = document.createElement('span');
        dot.className = 'dot ' + dotClass(t, today);
        dots.appendChild(dot);
      });
      cell.appendChild(dots);
    }

    cell.onclick = () => {
      calAnchor = dateStr;
      calView = 'day';
      renderCalendar();
    };
    grid.appendChild(cell);
  }

  body.appendChild(grid);
}

function renderWeek(body, today) {
  const [ws] = weekOf(calAnchor);
  for (let i = 0; i < 7; i++) {
    const day = addDays(ws, i);
    const block = document.createElement('div');
    block.className = 'day-block';

    const h = document.createElement('h4');
    h.textContent = DAY_NAMES[i] + ' ' + Number(day.split('-')[2]) + (day === today ? ' (اليوم)' : '');
    block.appendChild(h);

    const list = tasksOn(day);
    if (list.length === 0) {
      const p = document.createElement('div');
      p.className = 'meta';
      p.textContent = 'ما فيه مهام';
      block.appendChild(p);
    } else {
      list.forEach(t => block.appendChild(calItem(t)));
    }
    body.appendChild(block);
  }
}

function renderDay(body, today) {
  const list = tasksOn(calAnchor).sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  const block = document.createElement('div');
  block.className = 'day-block';

  if (list.length === 0) {
    const p = document.createElement('div');
    p.className = 'meta';
    p.textContent = calAnchor === today ? 'ما عندك مهام لليوم. أضفها من صفحة المهام.' : 'ما فيه مهام في هذا اليوم.';
    block.appendChild(p);
  } else {
    list.forEach(t => block.appendChild(calItem(t)));
  }
  body.appendChild(block);
}

// سطر مهمة داخل التقويم مع تغيير الحالة
function calItem(t) {
  const line = document.createElement('div');
  line.className = 'item-line';

  const info = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = t.title;
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = PRIORITY_NAMES[t.priority] || t.priority;
  info.appendChild(title);
  info.appendChild(meta);

  line.appendChild(info);
  line.appendChild(makeStatusSelect(t));
  return line;
}

function shiftCal(dir) {
  if (calView === 'month') calAnchor = addMonths(calAnchor, dir);
  else if (calView === 'week') calAnchor = addDays(calAnchor, 7 * dir);
  else calAnchor = addDays(calAnchor, dir);
  renderCalendar();
}

$('calPrev').onclick = () => shiftCal(1);
$('calNext').onclick = () => shiftCal(-1);

document.querySelectorAll('.seg-btn').forEach(b => {
  b.onclick = () => {
    calView = b.dataset.view;
    renderCalendar();
  };
});

// ---------- المزيد: ملاحظات، إنجازات، أفكار، أشخاص، مالية، روابط، مهارات ----------

function buildMoreForm() {
  const box = $('moreForm');
  box.innerHTML = '';
  const cfg = KINDS[moreKind];
  $('moreTitle').textContent = cfg.label;

  const title = document.createElement('input');
  title.placeholder = cfg.titleLabel;
  const body = document.createElement('textarea');
  body.placeholder = cfg.bodyLabel;
  box.appendChild(title);
  box.appendChild(body);

  const extras = {};
  for (const f of cfg.fields) {
    const lab = document.createElement('label');
    lab.textContent = f.label + ': ';
    let el;
    if (f.type === 'select') {
      el = document.createElement('select');
      f.options.forEach(([v, l]) => {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = l;
        el.appendChild(o);
      });
    } else {
      el = document.createElement('input');
      el.type = f.type;
      if (f.placeholder) el.placeholder = f.placeholder;
    }
    lab.appendChild(el);
    box.appendChild(lab);
    extras[f.key] = el;
  }

  const addBtn = document.createElement('button');
  addBtn.id = 'addMoreBtn';
  addBtn.textContent = 'إضافة';
  addBtn.onclick = async () => {
    const t = title.value.trim();
    if (!t) return alert('اكتب ' + cfg.titleLabel);

    const extra = {};
    for (const f of cfg.fields) {
      const v = String(extras[f.key].value).trim();
      if (v === '') continue;
      extra[f.key] = f.type === 'number' ? Number(v) : v;
    }

    const { error } = await db.from('items').insert({
      kind: moreKind,
      title: t,
      body: body.value.trim() || null,
      extra,
    });
    if (error) return alert(error.message);

    title.value = '';
    body.value = '';
    for (const f of cfg.fields) extras[f.key].value = '';
    loadAll();
  };
  box.appendChild(addBtn);
}

function moreMeta(it) {
  const e = it.extra || {};
  if (moreKind === 'achievement') return e.date ? 'التاريخ: ' + e.date : '';
  if (moreKind === 'idea') return e.category ? 'التصنيف: ' + e.category : '';
  if (moreKind === 'person') {
    return [e.relation, e.birthday ? 'الميلاد: ' + e.birthday : '', e.phone].filter(Boolean).join(' | ');
  }
  if (moreKind === 'expense') {
    return (e.type === 'income' ? 'دخل' : 'مصروف') + ' | ' + (e.amount !== undefined ? e.amount : '') + (e.date ? ' | ' + e.date : '');
  }
  if (moreKind === 'link') return e.url || '';
  return '';
}

function renderMore() {
  document.querySelectorAll('.kind-btn').forEach(b => b.classList.toggle('active', b.dataset.kind === moreKind));
  const list = $('moreList');
  list.innerHTML = '';
  const cfg = KINDS[moreKind];
  const mine = items.filter(i => i.kind === moreKind);

  const sum = $('moreSummary');
  sum.textContent = '';
  if (moreKind === 'expense') {
    const isIncome = i => i.extra && i.extra.type === 'income';
    const inc = mine.filter(isIncome).reduce((s, i) => s + (Number(i.extra.amount) || 0), 0);
    const exp = mine.filter(i => !isIncome(i)).reduce((s, i) => s + (Number(i.extra && i.extra.amount) || 0), 0);
    sum.textContent = 'الدخل: ' + inc + ' | المصروف: ' + exp + ' | الرصيد: ' + (inc - exp);
  }

  for (const it of mine) {
    const div = document.createElement('div');
    div.className = 'task';

    const info = document.createElement('div');
    info.className = 'info';
    const t = document.createElement('strong');
    t.textContent = it.title;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = moreMeta(it);
    info.appendChild(t);
    info.appendChild(meta);
    if (it.body) {
      const n = document.createElement('div');
      n.className = 'notes';
      n.textContent = it.body;
      info.appendChild(n);
    }

    const delBtn = document.createElement('button');
    delBtn.textContent = 'حذف';
    delBtn.onclick = () => deleteItem(it.id);

    div.appendChild(info);
    div.appendChild(delBtn);
    list.appendChild(div);
  }

  if (mine.length === 0) {
    list.textContent = 'ما عندك ' + cfg.label + ' بعد.';
  }
}

async function deleteItem(id) {
  if (!confirm('تبي تحذف هذا العنصر؟')) return;
  const { error } = await db.from('items').delete().eq('id', id);
  if (error) alert(error.message);
  loadAll();
}

document.querySelectorAll('.kind-btn').forEach(b => {
  b.onclick = () => {
    moreKind = b.dataset.kind;
    buildMoreForm();
    renderMore();
  };
});

// ---------- الأهداف ----------

$('addGoalBtn').onclick = async () => {
  const title = $('goalTitle').value.trim();
  if (!title) return alert('اكتب عنوان الهدف');

  const { error } = await db.from('goals').insert({
    title,
    term: $('goalTerm').value,
  });
  if (error) return alert(error.message);

  $('goalTitle').value = '';
  loadAll();
};

async function deleteGoal(id) {
  if (!confirm('تبي تحذف هذا الهدف؟ المهام المرتبطة فيه ما تنحذف.')) return;
  const { error } = await db.from('goals').delete().eq('id', id);
  if (error) alert(error.message);
  loadAll();
}

function renderGoals() {
  const box = $('goalsList');
  box.innerHTML = '';

  for (const g of goals) {
    const linked = tasks.filter(t => t.goal_id === g.id);
    const done = linked.filter(t => effStatus(t) === 'done').length;
    const pctValue = linked.length ? Math.round(done / linked.length * 100) : 0;

    const card = document.createElement('div');
    card.className = 'goal';

    const title = document.createElement('strong');
    title.textContent = g.title + ' (' + (TERM_NAMES[g.term] || g.term) + ')';

    const bar = document.createElement('div');
    bar.className = 'bar';
    const fill = document.createElement('div');
    fill.className = 'barFill';
    fill.style.width = pctValue + '%';
    bar.appendChild(fill);

    const text = document.createElement('div');
    text.className = 'meta';
    text.textContent = linked.length
      ? 'أنجزت ' + done + ' من ' + linked.length + ' مهام (' + pctValue + '%)'
      : 'ما ربطت له مهام بعد';

    const delBtn = document.createElement('button');
    delBtn.textContent = 'حذف الهدف';
    delBtn.onclick = () => deleteGoal(g.id);

    card.appendChild(title);
    card.appendChild(bar);
    card.appendChild(text);
    card.appendChild(delBtn);
    box.appendChild(card);
  }

  if (goals.length === 0) {
    box.textContent = 'ما عندك أهداف بعد.';
  }
}

// ---------- العادات ----------

// أداة اختيار الأيام (للإضافة والتعديل)
function makeDaysPicker(selected = []) {
  const wrap = document.createElement('div');
  wrap.className = 'days';
  const boxes = [];
  DAY_NAMES.forEach((name, i) => {
    const lab = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = selected.includes(i);
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(' ' + name));
    wrap.appendChild(lab);
    boxes.push({ cb, i });
  });
  return {
    el: wrap,
    values: () => boxes.filter(b => b.cb.checked).map(b => b.i),
  };
}

let habitDaysPicker = makeDaysPicker();
$('habitDaysAdd').appendChild(habitDaysPicker.el);
$('habitFreq').onchange = () => {
  $('habitDaysAdd').classList.toggle('hidden', $('habitFreq').value !== 'weekly');
};

$('addHabitBtn').onclick = async () => {
  const title = $('habitTitle').value.trim();
  if (!title) return alert('اكتب اسم العادة');

  const freq = $('habitFreq').value;
  const { error } = await db.from('habits').insert({
    title,
    frequency: freq,
    habit_time: $('habitTime').value || null,
    weekdays: freq === 'weekly' ? habitDaysPicker.values() : null,
  });
  if (error) return alert(error.message);

  $('habitTitle').value = '';
  $('habitTime').value = '';
  $('habitFreq').value = 'daily';
  $('habitDaysAdd').classList.add('hidden');
  $('habitDaysAdd').innerHTML = '';
  habitDaysPicker = makeDaysPicker();
  $('habitDaysAdd').appendChild(habitDaysPicker.el);
  loadAll();
};

async function deleteHabit(id) {
  if (!confirm('تبي تحذف هذي العادة وكل سجلها؟')) return;
  const { error } = await db.from('habits').delete().eq('id', id);
  if (error) alert(error.message);
  loadAll();
}

async function saveHabitEdit(id, fields) {
  const { error } = await db.from('habits').update(fields).eq('id', id);
  if (error) return alert(error.message);
  editingHabitId = null;
  loadAll();
}

function cancelHabitEdit() {
  editingHabitId = null;
  renderHabits();
}

function buildHabitEdit(h) {
  const form = document.createElement('div');
  form.className = 'edit-form';

  const title = document.createElement('input');
  title.value = h.title;

  const freq = document.createElement('select');
  [['daily', 'يومية'], ['weekly', 'أسبوعية']].forEach(([v, label]) => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = label;
    if (v === h.frequency) opt.selected = true;
    freq.appendChild(opt);
  });

  const time = document.createElement('input');
  time.type = 'time';
  time.value = h.habit_time || '';

  const days = makeDaysPicker(h.weekdays || []);
  days.el.classList.toggle('hidden', h.frequency !== 'weekly');
  freq.onchange = () => days.el.classList.toggle('hidden', freq.value !== 'weekly');

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'حفظ';
  saveBtn.onclick = () => {
    const newTitle = title.value.trim();
    if (!newTitle) return alert('اسم العادة ما يكون فاضي');
    const f = freq.value;
    saveHabitEdit(h.id, {
      title: newTitle,
      frequency: f,
      habit_time: time.value || null,
      weekdays: f === 'weekly' ? days.values() : null,
    });
  };

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'إلغاء';
  cancelBtn.onclick = cancelHabitEdit;

  form.appendChild(title);
  form.appendChild(freq);
  form.appendChild(time);
  form.appendChild(days.el);
  form.appendChild(document.createElement('br'));
  form.appendChild(saveBtn);
  form.appendChild(cancelBtn);
  return form;
}

async function toggleHabitToday(habitId) {
  const today = todayStr();
  const existing = habitLogs.find(l => l.habit_id === habitId && l.log_date === today);
  let error;
  if (existing) {
    ({ error } = await db.from('habit_logs').delete().eq('id', existing.id));
  } else {
    ({ error } = await db.from('habit_logs').insert({ habit_id: habitId, log_date: today }));
  }
  if (error) alert(error.message);
  loadAll();
}

// هل العادة مطلوبة اليوم؟
function habitActiveToday(h) {
  if (h.frequency !== 'weekly') return true;
  if (!h.weekdays || h.weekdays.length === 0) return true;
  return h.weekdays.includes(new Date().getDay());
}

// الأسبوع الحالي من الأحد للسبت
function weekRange() {
  return weekOf(todayStr());
}

// الشهر الحالي من أول يوم لآخر يوم
function monthRange() {
  const d = new Date();
  return [
    formatDate(new Date(d.getFullYear(), d.getMonth(), 1)),
    formatDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  ];
}

// عدد الأيام المتتالية للعادة اليومية
function calcStreak(habitId) {
  const dates = new Set(habitLogs.filter(l => l.habit_id === habitId).map(l => l.log_date));
  const today = todayStr();
  let cursor = dates.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (dates.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function daysLabel(h) {
  if (h.frequency !== 'weekly') return 'يومية';
  if (!h.weekdays || h.weekdays.length === 0) return 'أسبوعية (أي يوم)';
  return 'أسبوعية: ' + h.weekdays.map(i => DAY_NAMES[i]).join('، ');
}

function renderHabits() {
  const box = $('habitsList');
  box.innerHTML = '';
  const today = todayStr();

  for (const h of habits) {
    if (editingHabitId === h.id) {
      box.appendChild(buildHabitEdit(h));
      continue;
    }

    const active = habitActiveToday(h);
    const checked = habitLogs.some(l => l.habit_id === h.id && l.log_date === today);

    const div = document.createElement('div');
    div.className = 'habit' + (checked ? ' checked' : '') + (active ? '' : ' inactive');

    const info = document.createElement('div');
    info.className = 'info';
    const title = document.createElement('strong');
    title.textContent = h.title;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = daysLabel(h) + (h.habit_time ? ' | الساعة ' + h.habit_time : '');
    info.appendChild(title);
    info.appendChild(meta);

    const streakDiv = document.createElement('div');
    streakDiv.className = 'streak';
    if (h.frequency === 'weekly') {
      const [s, e] = weekRange();
      const count = habitLogs.filter(l => l.habit_id === h.id && l.log_date >= s && l.log_date <= e).length;
      const target = h.weekdays && h.weekdays.length ? h.weekdays.length : null;
      streakDiv.textContent = target
        ? 'أنجزتها ' + count + ' من ' + target + ' أيام هذا الأسبوع'
        : 'أنجزتها ' + count + ' مرة هذا الأسبوع';
    } else {
      const s = calcStreak(h.id);
      streakDiv.textContent = s > 0 ? 'سلسلة: ' + s + ' يوم متتالي' : 'ابدأ السلسلة اليوم';
    }
    info.appendChild(streakDiv);

    const toggleBtn = document.createElement('button');
    if (active) {
      toggleBtn.textContent = checked ? 'إلغاء اليوم' : 'أنجزت اليوم';
      toggleBtn.onclick = () => toggleHabitToday(h.id);
    } else {
      toggleBtn.textContent = 'ليس اليوم';
      toggleBtn.disabled = true;
    }

    const editBtn = document.createElement('button');
    editBtn.textContent = 'تعديل';
    editBtn.onclick = () => {
      editingHabitId = h.id;
      renderHabits();
    };

    const delBtn = document.createElement('button');
    delBtn.textContent = 'حذف';
    delBtn.onclick = () => deleteHabit(h.id);

    div.appendChild(info);
    div.appendChild(toggleBtn);
    div.appendChild(editBtn);
    div.appendChild(delBtn);
    box.appendChild(div);
  }

  if (habits.length === 0) {
    box.textContent = 'ما عندك عادات بعد.';
  }
}

// ---------- الصفحة الرئيسية ----------

// نسبة الإنجاز من قائمة مهام
function pctOf(list) {
  if (!list.length) return 0;
  return Math.round(list.filter(t => effStatus(t) === 'done').length / list.length * 100);
}

// حلقة تقدم دائرية
function ringHTML(p, label, sub) {
  const C = 2 * Math.PI * 50;
  const offset = C * (1 - p / 100);
  return '<div class="ring">' +
    '<svg viewBox="0 0 120 120">' +
      '<circle class="ring-track" cx="60" cy="60" r="50" fill="none" stroke-width="10"></circle>' +
      '<circle class="ring-fill" cx="60" cy="60" r="50" fill="none" stroke-width="10" stroke-linecap="round"' +
        ' stroke-dasharray="' + C + '" stroke-dashoffset="' + offset + '" transform="rotate(-90 60 60)"></circle>' +
      '<text class="ring-text" x="60" y="68" text-anchor="middle">' + p + '%</text>' +
    '</svg>' +
    '<div>' + label + '</div>' +
    '<div class="meta">' + sub + '</div>' +
  '</div>';
}

function countSub(list) {
  if (!list.length) return 'ما فيه مهام';
  const done = list.filter(t => effStatus(t) === 'done').length;
  return done + ' من ' + list.length + ' مهام';
}

function renderHome() {
  const today = todayStr();
  const [ws, we] = weekRange();
  const [ms, me] = monthRange();

  const todayTasks = tasks.filter(t => t.due_date === today);
  const weekTasks = tasks.filter(t => t.due_date && t.due_date >= ws && t.due_date <= we);
  const monthTasks = tasks.filter(t => t.due_date && t.due_date >= ms && t.due_date <= me);

  // الترحيب والعبارة
  const hour = new Date().getHours();
  const word = hour < 12 ? 'صباح الخير' : 'مساء الخير';
  $('greeting').textContent = currentName ? word + ' ' + currentName : word;
  $('quote').textContent = QUOTES[new Date().getDate() % QUOTES.length];

  // مؤشرات الأداء
  const late = tasks.filter(t => t.due_date && t.due_date < today && effStatus(t) !== 'done').length;
  const longest = habits
    .filter(h => h.frequency !== 'weekly')
    .reduce((mx, h) => Math.max(mx, calcStreak(h.id)), 0);
  const activeHabits = habits.filter(habitActiveToday);
  const doneHabits = activeHabits.filter(h => habitLogs.some(l => l.habit_id === h.id && l.log_date === today)).length;

  $('kLate').textContent = late;
  $('kWeek').textContent = pctOf(weekTasks) + '%';
  $('kStreak').textContent = longest;
  $('kHabits').textContent = doneHabits + '/' + activeHabits.length;

  // الحلقات الثلاث
  $('rings').innerHTML =
    ringHTML(pctOf(todayTasks), 'اليوم', countSub(todayTasks)) +
    ringHTML(pctOf(weekTasks), 'هذا الأسبوع', countSub(weekTasks)) +
    ringHTML(pctOf(monthTasks), 'هذا الشهر', countSub(monthTasks));

  // شريط تقدم اليوم
  $('todayFill').style.width = pctOf(todayTasks) + '%';
  $('barText').textContent = todayTasks.length
    ? 'أنجزت ' + todayTasks.filter(t => effStatus(t) === 'done').length + ' من ' + todayTasks.length + ' مهام اليوم'
    : 'ما عندك مهام مجدولة لليوم';

  // شريط الأسبوع
  const week = $('week');
  week.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const day = addDays(ws, i);
    const list = tasksOn(day);
    const done = list.filter(t => effStatus(t) === 'done').length;
    const cell = document.createElement('div');
    cell.className = 'day' + (day === today ? ' today' : '');
    cell.innerHTML =
      '<div>' + SHORT_DAY_NAMES[i] + '</div>' +
      '<div class="dnum">' + Number(day.split('-')[2]) + '</div>' +
      '<div>' + (list.length ? done + '/' + list.length : '-') + '</div>';
    week.appendChild(cell);
  }

  // الخريطة الحرارية للشهر
  const headBox = $('heatHead');
  headBox.innerHTML = '';
  SHORT_DAY_NAMES.forEach(n => {
    const s = document.createElement('div');
    s.textContent = n;
    headBox.appendChild(s);
  });

  const heat = $('heat');
  heat.innerHTML = '';
  const first = new Date();
  first.setDate(1);
  const offset = first.getDay();
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  for (let i = 0; i < offset; i++) {
    const e = document.createElement('div');
    e.className = 'empty';
    heat.appendChild(e);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(new Date(first.getFullYear(), first.getMonth(), d));
    const n = tasks.filter(t => t.due_date === dateStr && effStatus(t) === 'done').length
      + habitLogs.filter(l => l.log_date === dateStr).length;
    const cell = document.createElement('div');
    cell.textContent = d;
    cell.className = 'lv' + Math.min(n, 3) + (dateStr === today ? ' today' : '');
    cell.title = n + ' إنجاز';
    heat.appendChild(cell);
  }

  // مهام اليوم المهمة
  const important = todayTasks
    .filter(t => effStatus(t) !== 'done')
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .slice(0, 5);

  const todayList = $('todayList');
  todayList.innerHTML = '';
  for (const t of important) {
    const div = document.createElement('div');
    div.className = 'task st-' + effStatus(t);
    const info = document.createElement('div');
    info.className = 'info';
    const title = document.createElement('strong');
    title.textContent = t.title;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = PRIORITY_NAMES[t.priority] || t.priority;
    info.appendChild(title);
    info.appendChild(meta);
    div.appendChild(info);
    todayList.appendChild(div);
  }
  if (important.length === 0) {
    todayList.textContent = todayTasks.length ? 'كل مهام اليوم منجزة. أحسنت!' : 'ما عندك شي مجدول لليوم.';
  }
}

buildMoreForm();
init();