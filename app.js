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

// أقسام "عام"
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

// أقسام الصحة
const HEALTH = {
  sleep: { label: 'نوم', fields: [
    { key: 'bed', label: 'وقت النوم', type: 'time' },
    { key: 'wake', label: 'وقت الاستيقاظ', type: 'time' },
  ] },
  water: { label: 'ماء', fields: [
    { key: 'glasses', label: 'عدد الأكواب', type: 'number' },
  ] },
  weight: { label: 'وزن', fields: [
    { key: 'kg', label: 'الوزن (كغ)', type: 'number' },
  ] },
  steps: { label: 'خطوات', fields: [
    { key: 'count', label: 'عدد الخطوات', type: 'number' },
  ] },
  journal: { label: 'يوميات', fields: [], body: true },
};

// أنواع محتوى المادة الدراسية
const STUDY_TYPES = [
  ['homework', 'واجب'],
  ['summary', 'ملخص'],
  ['solution', 'حل'],
  ['mistake', 'خطأ يحتاج مراجعة'],
  ['exam', 'اختبار'],
  ['requirement', 'مطلوب للمادة'],
  ['link', 'رابط'],
];

const $ = id => document.getElementById(id);
let tasks = [];
let goals = [];
let habits = [];
let habitLogs = [];
let items = [];
let area = 'general';
let moreKind = 'note';
let healthKind = 'sleep';
let selectedSubject = null;
let currentName = '';
let editingId = null;
let editingHabitId = null;
let calView = 'month';
let calAnchor = todayStr();

// ---------- أدوات التاريخ ----------

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

// ---------- التنقل ----------

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
}

document.querySelectorAll('.nav-btn').forEach(b => b.onclick = () => showPage(b.dataset.page));

function setArea(a) {
  area = a;
  document.querySelectorAll('.area-btn').forEach(b => b.classList.toggle('active', b.dataset.area === a));
  $('areaGeneral').classList.toggle('hidden', a !== 'general');
  $('areaHealth').classList.toggle('hidden', a !== 'health');
  $('areaStudy').classList.toggle('hidden', a !== 'study');
  $('areaVault').classList.toggle('hidden', a !== 'vault');
}

document.querySelectorAll('.area-btn').forEach(b => b.onclick = () => setArea(b.dataset.area));

async function init() {
  const { data } = await db.auth.getSession();
  showScreen(!!data.session);
  if (data.session) {
    showPage('home');
    loadAll();
  }
}

// ---------- الدخول والخروج ----------

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

// ---------- تحميل البيانات ----------

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
  renderHealth();
  renderStudy();
  renderVault();
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

// ---------- عام: ملاحظات، إنجازات، أفكار، أشخاص، مالية، روابط، مهارات ----------

// بناء نموذج الحقول (مشترك بين الأقسام)
function buildFields(box, fields, titleLabel, bodyLabel) {
  const inputs = {};
  let title = null;
  let body = null;

  if (titleLabel) {
    title = document.createElement('input');
    title.placeholder = titleLabel;
    box.appendChild(title);
  }
  if (bodyLabel) {
    body = document.createElement('textarea');
    body.placeholder = bodyLabel;
    box.appendChild(body);
  }

  for (const f of fields) {
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
    inputs[f.key] = el;
  }

  return { title, body, inputs };
}

function collectExtra(fields, inputs) {
  const extra = {};
  for (const f of fields) {
    const v = String(inputs[f.key].value).trim();
    if (v === '') continue;
    extra[f.key] = f.type === 'number' ? Number(v) : v;
  }
  return extra;
}

function clearFields(fields, inputs) {
  for (const f of fields) inputs[f.key].value = '';
}

function buildMoreForm() {
  const box = $('moreForm');
  box.innerHTML = '';
  const cfg = KINDS[moreKind];
  $('moreTitle').textContent = cfg.label;

  const { title, body, inputs } = buildFields(box, cfg.fields, cfg.titleLabel, cfg.bodyLabel);

  const addBtn = document.createElement('button');
  addBtn.id = 'addMoreBtn';
  addBtn.textContent = 'إضافة';
  addBtn.onclick = async () => {
    const t = title.value.trim();
    if (!t) return alert('اكتب ' + cfg.titleLabel);

    const { error } = await db.from('items').insert({
      kind: moreKind,
      title: t,
      body: body.value.trim() || null,
      extra: collectExtra(cfg.fields, inputs),
    });
    if (error) return alert(error.message);

    title.value = '';
    body.value = '';
    clearFields(cfg.fields, inputs);
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
  document.querySelectorAll('.gen-btn').forEach(b => b.classList.toggle('active', b.dataset.kind === moreKind));
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

document.querySelectorAll('.gen-btn').forEach(b => {
  b.onclick = () => {
    moreKind = b.dataset.kind;
    buildMoreForm();
    renderMore();
  };
});

// ---------- الصحة ----------

function healthOn() {
  try { return localStorage.getItem('masahati-health') !== 'off'; } catch (e) { return true; }
}

function setHealthOn(on) {
  try { localStorage.setItem('masahati-health', on ? 'on' : 'off'); } catch (e) {}
  renderHealth();
}

$('healthToggle').onclick = () => setHealthOn(!healthOn());

document.querySelectorAll('.h-btn').forEach(b => {
  b.onclick = () => {
    healthKind = b.dataset.hk;
    buildHealthForm();
    renderHealth();
  };
});

function buildHealthForm() {
  const box = $('healthForm');
  box.innerHTML = '';
  const cfg = HEALTH[healthKind];
  const fields = [...cfg.fields, { key: 'date', label: 'التاريخ', type: 'date' }];
  const { body, inputs } = buildFields(box, fields, null, cfg.body ? 'اكتب عن يومك...' : null);
  inputs.date.value = todayStr();

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'حفظ';
  saveBtn.onclick = async () => {
    const extra = collectExtra(fields, inputs);
    const date = extra.date || todayStr();
    const text = body ? body.value.trim() : '';
    if (cfg.body && !text) return alert('اكتب شي في اليوميات');

    const { error } = await db.from('items').insert({
      kind: 'h_' + healthKind,
      title: cfg.label + ' ' + date,
      body: text || null,
      extra: { ...extra, date },
    });
    if (error) return alert(error.message);

    clearFields(fields, inputs);
    inputs.date.value = todayStr();
    if (body) body.value = '';
    loadAll();
  };
  box.appendChild(saveBtn);
}

function healthMeta(it) {
  const e = it.extra || {};
  if (healthKind === 'sleep') return 'من ' + (e.bed || '-') + ' إلى ' + (e.wake || '-');
  if (healthKind === 'water') return (e.glasses !== undefined ? e.glasses : '-') + ' أكواب';
  if (healthKind === 'weight') return (e.kg !== undefined ? e.kg : '-') + ' كغ';
  if (healthKind === 'steps') return (e.count !== undefined ? e.count : '-') + ' خطوة';
  return e.date || '';
}

function renderHealth() {
  const on = healthOn();
  $('healthToggle').textContent = on ? 'إخفاء القسم' : 'تشغيل القسم';
  $('healthBody').classList.toggle('hidden', !on);
  if (!on) return;

  document.querySelectorAll('.h-btn').forEach(b => b.classList.toggle('active', b.dataset.hk === healthKind));

  const list = $('healthList');
  list.innerHTML = '';
  const mine = items
    .filter(i => i.kind === 'h_' + healthKind)
    .sort((a, b) => ((b.extra && b.extra.date) || '').localeCompare((a.extra && a.extra.date) || ''))
    .slice(0, 30);

  for (const it of mine) {
    const div = document.createElement('div');
    div.className = 'task';
    const info = document.createElement('div');
    info.className = 'info';
    const t = document.createElement('strong');
    t.textContent = it.title;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = healthMeta(it);
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

  if (mine.length === 0) list.textContent = 'ما عندك تسجيلات بعد.';
}

// ---------- الدراسة ----------

function renderStudy() {
  const subjects = items.filter(i => i.kind === 'subject');
  if (!subjects.some(s => s.id === selectedSubject)) {
    selectedSubject = subjects.length ? subjects[0].id : null;
  }

  const bar = $('subjectBar');
  bar.innerHTML = '';
  for (const s of subjects) {
    const btn = document.createElement('button');
    btn.className = 'sub-btn' + (s.id === selectedSubject ? ' active' : '');
    btn.textContent = s.title;
    btn.onclick = () => {
      selectedSubject = s.id;
      renderStudy();
    };
    bar.appendChild(btn);
  }

  const body = $('studyBody');
  body.innerHTML = '';
  if (!selectedSubject) {
    body.textContent = 'أضف مادة أولاً.';
    return;
  }

  const subj = subjects.find(s => s.id === selectedSubject);

  const head = document.createElement('div');
  head.className = 'top-row';
  const h = document.createElement('h3');
  h.textContent = subj.title;
  h.style.flex = '1';
  const delSubj = document.createElement('button');
  delSubj.textContent = 'حذف المادة';
  delSubj.onclick = () => deleteSubject(subj.id);
  head.appendChild(h);
  head.appendChild(delSubj);
  body.appendChild(head);

  // نموذج إضافة محتوى للمادة
  const form = document.createElement('div');
  form.className = 'more-form';
  const typeSel = document.createElement('select');
  STUDY_TYPES.forEach(([v, l]) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = l;
    typeSel.appendChild(o);
  });
  const title = document.createElement('input');
  title.placeholder = 'العنوان';
  const text = document.createElement('textarea');
  text.placeholder = 'التفاصيل (اختياري)';
  const addBtn = document.createElement('button');
  addBtn.textContent = 'إضافة';
  addBtn.id = 'addSubjectItemBtn';
  addBtn.onclick = async () => {
    const t = title.value.trim();
    if (!t) return alert('اكتب العنوان');
    const { error } = await db.from('items').insert({
      kind: 'subject_item',
      title: t,
      body: text.value.trim() || null,
      extra: { subject_id: subj.id, type: typeSel.value },
    });
    if (error) return alert(error.message);
    loadAll();
  };
  form.appendChild(typeSel);
  form.appendChild(title);
  form.appendChild(text);
  form.appendChild(addBtn);
  body.appendChild(form);

  // محتوى المادة مقسم حسب النوع
  const list = items.filter(i => i.kind === 'subject_item' && i.extra && i.extra.subject_id === subj.id);
  for (const [type, label] of STUDY_TYPES) {
    const group = list.filter(i => i.extra.type === type);
    if (group.length === 0) continue;
    const gh = document.createElement('h4');
    gh.textContent = label;
    body.appendChild(gh);

    for (const it of group) {
      const div = document.createElement('div');
      div.className = 'task';
      const info = document.createElement('div');
      info.className = 'info';
      const t = document.createElement('strong');
      t.textContent = it.title;
      info.appendChild(t);
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
      body.appendChild(div);
    }
  }

  if (list.length === 0) {
    const p = document.createElement('div');
    p.className = 'meta';
    p.textContent = 'ما أضفت شي لهذي المادة بعد.';
    body.appendChild(p);
  }
}

$('addSubjectBtn').onclick = async () => {
  const name = $('subjectName').value.trim();
  if (!name) return alert('اكتب اسم المادة');
  const { error } = await db.from('items').insert({ kind: 'subject', title: name, extra: {} });
  if (error) return alert(error.message);
  $('subjectName').value = '';
  loadAll();
};

async function deleteSubject(id) {
  if (!confirm('تبي تحذف هذي المادة وكل محتواها؟')) return;
  const { error: e1 } = await db.from('items').delete().eq('extra->>subject_id', id);
  if (e1) return alert(e1.message);
  const { error: e2 } = await db.from('items').delete().eq('id', id);
  if (e2) return alert(e2.message);
  selectedSubject = null;
  loadAll();
}

// ---------- الخزنة (مشفرة بالرمز) ----------

function toB64(buf) {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function deriveKey(pin, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptText(pin, text) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return { salt: toB64(salt), iv: toB64(iv), data: toB64(data) };
}

async function decryptText(pin, obj) {
  const key = await deriveKey(pin, fromB64(obj.salt));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(obj.iv) }, key, fromB64(obj.data));
  return new TextDecoder().decode(plain);
}

$('vaultAddBtn').onclick = async () => {
  const title = $('vaultTitle').value.trim();
  if (!title) return alert('اكتب اسم الحساب أو الموقع');

  const pin = prompt('اختر رمز الخزنة (4 أحرف على الأقل). لازم تحفظه، ما فيه طريقة ترجع البيانات بدونه.');
  if (!pin || pin.length < 4) return alert('الرمز لازم يكون 4 أحرف على الأقل');
  const pin2 = prompt('أعد كتابة الرمز');
  if (pin !== pin2) return alert('الرمزين ما يتطابقون');

  const secret = JSON.stringify({
    user: $('vaultUser').value.trim(),
    pass: $('vaultPass').value,
    notes: $('vaultNotes').value.trim(),
  });
  const cipher = await encryptText(pin, secret);

  const { error } = await db.from('items').insert({
    kind: 'vault',
    title,
    body: JSON.stringify(cipher),
    extra: {},
  });
  if (error) return alert(error.message);

  $('vaultTitle').value = '';
  $('vaultUser').value = '';
  $('vaultPass').value = '';
  $('vaultNotes').value = '';
  loadAll();
};

async function revealVault(it, info, btn) {
  const pin = prompt('أدخل رمز الخزنة');
  if (!pin) return;
  try {
    const plain = JSON.parse(await decryptText(pin, JSON.parse(it.body)));
    const d = document.createElement('div');
    d.className = 'notes';
    d.textContent =
      'المستخدم: ' + (plain.user || '-') + '\n' +
      'كلمة المرور: ' + (plain.pass || '-') +
      (plain.notes ? '\nملاحظات: ' + plain.notes : '');
    info.appendChild(d);
    btn.disabled = true;
  } catch (e) {
    alert('الرمز غلط');
  }
}

function renderVault() {
  const list = $('vaultList');
  list.innerHTML = '';
  const mine = items.filter(i => i.kind === 'vault');

  for (const it of mine) {
    const div = document.createElement('div');
    div.className = 'task';
    const info = document.createElement('div');
    info.className = 'info';
    const t = document.createElement('strong');
    t.textContent = it.title;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = 'محمي برمز';
    info.appendChild(t);
    info.appendChild(meta);

    const showBtn = document.createElement('button');
    showBtn.textContent = 'إظهار';
    showBtn.onclick = () => revealVault(it, info, showBtn);

    const delBtn = document.createElement('button');
    delBtn.textContent = 'حذف';
    delBtn.onclick = () => deleteItem(it.id);

    div.appendChild(info);
    div.appendChild(showBtn);
    div.appendChild(delBtn);
    list.appendChild(div);
  }

  if (mine.length === 0) list.textContent = 'الخزنة فاضية.';
}

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

  // النقاط: كل مهمة منجزة 10 نقاط، وكل عادة مسجلة 5 نقاط، والمستوى كل 100 نقطة
  const doneTasksCount = tasks.filter(t => effStatus(t) === 'done').length;
  const points = doneTasksCount * 10 + habitLogs.length * 5;
  const level = Math.floor(points / 100) + 1;
  $('levelText').textContent = 'المستوى ' + level + ' | ' + points + ' نقطة (باقي ' + (100 - points % 100) + ' للمستوى التالي)';
  $('levelFill').style.width = (points % 100) + '%';

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
buildHealthForm();
init();