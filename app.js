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
const QUOTES = [
  'خطوة صغيرة اليوم أحسن من خطة كبيرة ما تبدأ.',
  'كل مهمة تنجزها تقربك من نسختك الأفضل.',
  'ركز على اللي تقدر تسويه الحين.',
  'التقدم البطيء يبقى تقدم.',
  'ابدأ بأهم شي، والباقي يجي بعده.',
];

const $ = id => document.getElementById(id);
let tasks = [];
let goals = [];
let habits = [];
let habitLogs = [];
let currentName = '';
let editingId = null;

function formatDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function todayStr() {
  return formatDate(new Date());
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return formatDate(dt);
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
  $('page-goals').classList.toggle('hidden', name !== 'goals');
  $('page-habits').classList.toggle('hidden', name !== 'habits');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === name));
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

  populateGoalSelect();
  render();
  renderHome();
  renderGoals();
  renderHabits();
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

function render() {
  const sorted = [...tasks];
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

    const select = document.createElement('select');
    for (const key of Object.keys(STATUS_NAMES)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = STATUS_NAMES[key];
      if (key === status) opt.selected = true;
      select.appendChild(opt);
    }
    select.onchange = () => updateStatus(t.id, select.value);

    const editBtn = document.createElement('button');
    editBtn.textContent = 'تعديل';
    editBtn.onclick = () => startEdit(t.id);

    const delBtn = document.createElement('button');
    delBtn.textContent = 'حذف';
    delBtn.onclick = () => deleteTask(t.id);

    div.appendChild(info);
    div.appendChild(select);
    div.appendChild(editBtn);
    div.appendChild(delBtn);
    list.appendChild(div);
  }

  if (sorted.length === 0) {
    list.textContent = 'ما عندك مهام بعد.';
  }
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
    const pct = linked.length ? Math.round(done / linked.length * 100) : 0;

    const card = document.createElement('div');
    card.className = 'goal';

    const title = document.createElement('strong');
    title.textContent = g.title + ' (' + (TERM_NAMES[g.term] || g.term) + ')';

    const bar = document.createElement('div');
    bar.className = 'bar';
    const fill = document.createElement('div');
    fill.className = 'barFill';
    fill.style.width = pct + '%';
    bar.appendChild(fill);

    const text = document.createElement('div');
    text.className = 'meta';
    text.textContent = linked.length
      ? 'أنجزت ' + done + ' من ' + linked.length + ' مهام (' + pct + '%)'
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

$('addHabitBtn').onclick = async () => {
  const title = $('habitTitle').value.trim();
  if (!title) return alert('اكتب اسم العادة');

  const { error } = await db.from('habits').insert({
    title,
    frequency: $('habitFreq').value,
  });
  if (error) return alert(error.message);

  $('habitTitle').value = '';
  loadAll();
};

async function deleteHabit(id) {
  if (!confirm('تبي تحذف هذي العادة وكل سجلها؟')) return;
  const { error } = await db.from('habits').delete().eq('id', id);
  if (error) alert(error.message);
  loadAll();
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

// عدد الأيام المتتالية. إذا ما سجلت اليوم، العداد يبدأ من أمس عشان ما ينقطع قبل ما يخلص اليوم.
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

function countLastSevenDays(habitId) {
  const today = todayStr();
  const start = addDays(today, -6);
  return habitLogs.filter(l => l.habit_id === habitId && l.log_date >= start && l.log_date <= today).length;
}

function renderHabits() {
  const box = $('habitsList');
  box.innerHTML = '';
  const today = todayStr();

  for (const h of habits) {
    const checked = habitLogs.some(l => l.habit_id === h.id && l.log_date === today);

    const div = document.createElement('div');
    div.className = 'habit' + (checked ? ' checked' : '');

    const info = document.createElement('div');
    info.className = 'info';
    const title = document.createElement('strong');
    title.textContent = h.title;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = h.frequency === 'weekly' ? 'أسبوعية' : 'يومية';
    info.appendChild(title);
    info.appendChild(meta);

    const streakDiv = document.createElement('div');
    streakDiv.className = 'streak';
    if (h.frequency === 'weekly') {
      streakDiv.textContent = 'أنجزتها ' + countLastSevenDays(h.id) + ' مرة هذا الأسبوع';
    } else {
      const s = calcStreak(h.id);
      streakDiv.textContent = s > 0 ? 'سلسلة: ' + s + ' يوم متتالي' : 'ابدأ السلسلة اليوم';
    }
    info.appendChild(streakDiv);

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = checked ? 'إلغاء اليوم' : 'أنجزت اليوم';
    toggleBtn.onclick = () => toggleHabitToday(h.id);

    const delBtn = document.createElement('button');
    delBtn.textContent = 'حذف';
    delBtn.onclick = () => deleteHabit(h.id);

    div.appendChild(info);
    div.appendChild(toggleBtn);
    div.appendChild(delBtn);
    box.appendChild(div);
  }

  if (habits.length === 0) {
    box.textContent = 'ما عندك عادات بعد.';
  }
}

// ---------- الصفحة الرئيسية ----------

function renderHome() {
  const today = todayStr();
  const total = tasks.length;
  const done = tasks.filter(t => effStatus(t) === 'done').length;
  const late = tasks.filter(t => t.due_date && t.due_date < today && effStatus(t) !== 'done').length;

  $('cTotal').textContent = total;
  $('cDone').textContent = done;
  $('cLeft').textContent = total - done;
  $('cLate').textContent = late;

  const hour = new Date().getHours();
  const word = hour < 12 ? 'صباح الخير' : 'مساء الخير';
  $('greeting').textContent = currentName ? word + ' ' + currentName : word;
  $('quote').textContent = QUOTES[new Date().getDate() % QUOTES.length];

  const todays = tasks.filter(t => t.due_date === today);
  const todayDone = todays.filter(t => effStatus(t) === 'done').length;
  const pct = todays.length ? Math.round(todayDone / todays.length * 100) : 0;
  $('todayFill').style.width = pct + '%';
  $('barText').textContent = todays.length
    ? 'أنجزت ' + todayDone + ' من ' + todays.length + ' مهام اليوم (' + pct + '%)'
    : 'ما عندك مهام مجدولة لليوم';

  const important = todays
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
    todayList.textContent = todays.length ? 'كل مهام اليوم منجزة. أحسنت!' : 'ما عندك شي مجدول لليوم.';
  }
}

init();