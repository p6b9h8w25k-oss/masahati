// ============ الشخصية والمساعد الذكي ============

const AI_KEY = 'masahati-ai';
let aiHistory = [];

const PRIOS = ['urgent', 'high', 'normal', 'low', 'none'];
const STATS = ['done', 'upcoming', 'postponed', 'missed', 'partial'];
const TERMS = ['daily', 'weekly', 'monthly', 'yearly'];

function aiSettings() {
  try { return JSON.parse(localStorage.getItem(AI_KEY)) || {}; } catch (e) { return {}; }
}

function saveAiSettings(s) {
  try { localStorage.setItem(AI_KEY, JSON.stringify(s)); } catch (e) {}
}

// ---------- الشخصية ----------

function mascotState() {
  const today = todayStr();
  if (overdueCount() > 0) return 'sleepy';
  const doneToday =
    tasks.some(t => t.due_date === today && effStatus(t) === 'done') ||
    habitLogs.some(l => l.log_date === today);
  return doneToday ? 'happy' : 'idle';
}

function mascotSVG(state) {
  const body =
    '<ellipse cx="60" cy="66" rx="42" ry="40" style="fill:var(--accent)"></ellipse>' +
    '<path d="M36 34 L30 14 L48 28 Z" style="fill:var(--accent)"></path>' +
    '<path d="M84 34 L90 14 L72 28 Z" style="fill:var(--accent)"></path>';

  const line = 'style="stroke:var(--bg);fill:none;stroke-width:4;stroke-linecap:round"';
  let face;
  if (state === 'happy') {
    face =
      '<path d="M40 64 Q46 56 52 64" ' + line + '></path>' +
      '<path d="M68 64 Q74 56 80 64" ' + line + '></path>' +
      '<path d="M46 78 Q60 90 74 78" ' + line + '></path>' +
      '<text x="96" y="26" style="fill:var(--gold);font-size:18px">✦</text>';
  } else if (state === 'sleepy') {
    face =
      '<path d="M40 66 H52" ' + line + '></path>' +
      '<path d="M68 66 H80" ' + line + '></path>' +
      '<path d="M50 82 Q60 78 70 82" ' + line + '></path>' +
      '<text x="90" y="26" style="fill:var(--secondary);font-size:14px;font-family:var(--sans)">z z</text>';
  } else {
    face =
      '<circle cx="46" cy="62" r="5" style="fill:var(--bg)"></circle>' +
      '<circle cx="74" cy="62" r="5" style="fill:var(--bg)"></circle>' +
      '<path d="M50 78 Q60 84 70 78" ' + line + '></path>';
  }
  return '<svg viewBox="0 0 120 120" width="110" height="110" role="img" aria-label="الشخصية">' + body + face + '</svg>';
}

function longestStreak() {
  return habits
    .filter(h => h.frequency !== 'weekly')
    .reduce((mx, h) => Math.max(mx, calcStreak(h.id)), 0);
}

function renderMascot() {
  const box = $('mascotBox');
  if (!box) return;
  const state = mascotState();
  const msgs = {
    happy: 'أحسنت، اليوم ماشي بشكل ممتاز.',
    sleepy: 'عندك مهام متأخرة. نبدأ بوحدة منها؟',
    idle: 'وش نسوي اليوم؟',
  };

  box.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'mascot-wrap';
  wrap.innerHTML = mascotSVG(state);

  const text = document.createElement('div');
  const msg = document.createElement('div');
  msg.textContent = msgs[state];
  const streak = document.createElement('div');
  streak.className = 'meta';
  streak.textContent = 'أطول سلسلة عادات: ' + longestStreak() + ' يوم';
  text.appendChild(msg);
  text.appendChild(streak);

  wrap.appendChild(text);
  box.appendChild(wrap);
}

// ---------- سياق المساعد ----------

function buildContext() {
  const today = todayStr();
  const active = tasks.filter(t => effStatus(t) !== 'done').slice(0, 30);
  const late = tasks.filter(t => t.due_date && t.due_date < today && effStatus(t) !== 'done');
  const habitLines = habits.map(h =>
    h.id + ' | ' + h.title + ' | ' + (habitLogs.some(l => l.habit_id === h.id && l.log_date === today) ? 'تمت' : 'لم تتم')
  );
  return [
    'التاريخ: ' + today,
    'المهام النشطة (id | العنوان | الحالة):',
    active.map(t => t.id + ' | ' + t.title + ' | ' + effStatus(t) + (t.due_date ? ' | ' + t.due_date : '')).join('\n') || 'لا شي',
    'عدد المهام المتأخرة: ' + late.length,
    'العادات (id | الاسم | حالة اليوم):',
    habitLines.join('\n') || 'لا شي',
    'الأهداف: ' + (goals.map(g => g.title).join('، ') || 'لا شي'),
    'دقائق التركيز اليوم: ' + focusMinutes(today, today),
  ].join('\n');
}

// ---------- الإجراءات (المساعد يقترح، المستخدم يؤكد) ----------

function parseReply(text) {
  const m = text.match(/```action\s*([\s\S]*?)```/);
  const clean = text.replace(/```action[\s\S]*?```/g, '').trim();
  let action = null;
  if (m) {
    try { action = JSON.parse(m[1].trim()); } catch (e) { action = null; }
  }
  return { clean, action };
}

function validateAction(a) {
  if (!a || typeof a.type !== 'string') return 'الإجراء غير صالح';
  if (a.type === 'add_task') {
    if (!a.title) return 'عنوان المهمة ناقص';
    if (a.priority && !PRIOS.includes(a.priority)) return 'أولوية غير معروفة';
    return null;
  }
  if (a.type === 'add_habit') {
    if (!a.title) return 'اسم العادة ناقص';
    if (a.frequency === 'weekly' && Array.isArray(a.weekdays) && a.weekdays.some(d => d < 0 || d > 6)) return 'الأيام غير صحيحة';
    return null;
  }
  if (a.type === 'add_goal') {
    if (!a.title) return 'اسم الهدف ناقص';
    if (a.term && !TERMS.includes(a.term)) return 'مدة الهدف غير معروفة';
    return null;
  }
  if (a.type === 'set_task_status') {
    if (!tasks.some(t => t.id === a.id)) return 'ما لقيت المهمة';
    if (!STATS.includes(a.status)) return 'الحالة غير معروفة';
    return null;
  }
  return 'نوع الإجراء غير مدعوم';
}

function describeAction(a) {
  if (a.type === 'add_task') return 'إضافة مهمة: ' + a.title;
  if (a.type === 'add_habit') return 'إضافة عادة: ' + a.title;
  if (a.type === 'add_goal') return 'إضافة هدف: ' + a.title;
  if (a.type === 'set_task_status') {
    const t = tasks.find(x => x.id === a.id);
    return 'تغيير حالة "' + (t ? t.title : 'مهمة') + '" إلى ' + (STATUS_NAMES[a.status] || a.status);
  }
  return 'إجراء';
}

async function runAction(a) {
  if (a.type === 'add_task') {
    return db.from('tasks').insert({
      title: a.title,
      priority: a.priority || 'normal',
      due_date: a.due_date || null,
      status: 'upcoming',
    });
  }
  if (a.type === 'add_habit') {
    const weekly = a.frequency === 'weekly';
    return db.from('habits').insert({
      title: a.title,
      frequency: weekly ? 'weekly' : 'daily',
      habit_time: a.habit_time || null,
      weekdays: weekly ? (a.weekdays || []) : null,
    });
  }
  if (a.type === 'add_goal') {
    return db.from('goals').insert({ title: a.title, term: a.term || 'monthly' });
  }
  if (a.type === 'set_task_status') {
    return db.from('tasks').update({ status: a.status }).eq('id', a.id);
  }
  return { error: { message: 'إجراء غير مدعوم' } };
}

function attachConfirm(bubble, action) {
  const row = document.createElement('div');
  row.className = 'ai-action';

  const desc = document.createElement('div');
  desc.className = 'meta';
  desc.textContent = 'اقتراح: ' + describeAction(action);

  const ok = document.createElement('button');
  ok.textContent = 'تأكيد';
  const no = document.createElement('button');
  no.textContent = 'إلغاء';

  ok.onclick = async () => {
    ok.disabled = true;
    no.disabled = true;
    const { error } = await runAction(action);
    if (error) {
      row.textContent = 'ما تنفذ: ' + error.message;
      return;
    }
    row.textContent = '✓ تم التنفيذ';
    loadAll();
  };
  no.onclick = () => { row.textContent = 'تم الإلغاء'; };

  row.appendChild(desc);
  row.appendChild(ok);
  row.appendChild(no);
  bubble.appendChild(row);
}

// ---------- المساعد ----------

async function askAI(question) {
  const s = aiSettings();
  if (!s.key) return 'حط مفتاح Groq في إعدادات المساعد أولاً.';

  const sys = [
    'أنت مساعد داخل تطبيق مساحتي. قواعد صارمة:',
    '- ردك قصير: جملتان أو ثلاث كحد أقصى، بدون مقدمات ولا قوائم طويلة.',
    '- لا تقول إنك نفذت أي شي. أنت ما تنفذ، التطبيق ينفذ بعد ما المستخدم يضغط تأكيد.',
    '- إذا المستخدم طلب إضافة أو تعديل، اكتب الإجراء داخل بلوك بهذا الشكل بالضبط، وبعده جملة قصيرة:',
    '```action',
    '{"type":"add_habit","title":"قراءة","frequency":"daily","habit_time":"21:00"}',
    '```',
    'الأنواع المدعومة:',
    '- add_task: title، priority (urgent|high|normal|low|none)، due_date (YYYY-MM-DD)',
    '- add_habit: title، frequency (daily|weekly)، habit_time (HH:MM)، weekdays (أرقام من 0 الأحد إلى 6 السبت)',
    '- add_goal: title، term (daily|weekly|monthly|yearly)',
    '- set_task_status: id (من القائمة فقط)، status (done|upcoming|postponed|missed|partial)',
    '- إذا السؤال نصيحة أو تحليل، جاوب بدون بلوك.',
    '',
    'بيانات المستخدم الحالية:',
    buildContext(),
  ].join('\n');

  const messages = [{ role: 'system', content: sys }, ...aiHistory.slice(-10), { role: 'user', content: question }];

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.key },
      body: JSON.stringify({
        model: s.model || 'openai/gpt-oss-120b',
        messages,
        temperature: 0.4,
        max_tokens: 300,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return 'خطأ من خدمة الذكاء: ' + ((json.error && json.error.message) || res.status);
    const reply = json.choices[0].message.content;
    aiHistory.push({ role: 'user', content: question }, { role: 'assistant', content: reply });
    if (aiHistory.length > 20) aiHistory = aiHistory.slice(-20);
    return reply;
  } catch (e) {
    return 'ما قدرت أتصل بالخدمة. تأكد من الإنترنت ومن المفتاح.';
  }
}

function addBubble(text, who) {
  const log = $('aiLog');
  const div = document.createElement('div');
  div.className = 'ai-msg ' + who;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

async function sendQuestion(q) {
  q = q.trim();
  if (!q) return;
  addBubble(q, 'user');
  $('aiInput').value = '';
  const wait = addBubble('...', 'bot');

  const raw = await askAI(q);
  const { clean, action } = parseReply(raw);
  wait.textContent = clean || 'تمام.';

  if (action) {
    const err = validateAction(action);
    if (err) wait.textContent += '\n(' + err + ')';
    else attachConfirm(wait, action);
  }
}

function renderAssistant() {
  const box = $('assistantBox');
  if (!box || box.dataset.built) return;
  box.dataset.built = '1';

  const h = document.createElement('h3');
  h.textContent = 'المساعد الذكي';
  box.appendChild(h);

  // الإعدادات
  const det = document.createElement('details');
  det.className = 'more-form';
  const sum = document.createElement('summary');
  sum.textContent = 'إعدادات المساعد (المفتاح)';
  det.appendChild(sum);

  const s = aiSettings();
  const key = document.createElement('input');
  key.type = 'password';
  key.placeholder = 'مفتاح Groq';
  key.value = s.key || '';
  const model = document.createElement('input');
  model.placeholder = 'الموديل';
  model.value = s.model || 'openai/gpt-oss-120b';
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'حفظ';
  saveBtn.onclick = () => {
    saveAiSettings({ key: key.value.trim(), model: model.value.trim() });
    alert('تم الحفظ على جهازك');
  };
  const note = document.createElement('p');
  note.className = 'meta';
  note.textContent = 'المفتاح يتحفظ على هذا الجهاز فقط. أسئلتك وبيانات اليوم تنرسل لخدمة Groq.';
  det.appendChild(key);
  det.appendChild(model);
  det.appendChild(saveBtn);
  det.appendChild(note);
  box.appendChild(det);

  // أزرار سريعة
  const quick = document.createElement('div');
  quick.className = 'more-form';
  [
    ['خطة اليوم', 'اقترح خطة قصيرة لليوم بناءً على مهامي.'],
    ['نصيحة للعادات', 'وش أحسن نصيحة لعاداتي اليوم؟'],
    ['تحليل الأسبوع', 'حلل إنجازي هذا الأسبوع في جملتين.'],
  ].forEach(([label, prompt]) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => sendQuestion(prompt);
    quick.appendChild(b);
  });
  box.appendChild(quick);

  // السجل
  const log = document.createElement('div');
  log.id = 'aiLog';
  log.className = 'ai-log';
  box.appendChild(log);

  // الإدخال
  const row = document.createElement('div');
  row.className = 'more-form';
  const input = document.createElement('input');
  input.id = 'aiInput';
  input.placeholder = 'اكتب طلبك أو سؤالك...';
  input.style.width = '70%';
  input.onkeydown = e => { if (e.key === 'Enter') sendQuestion(input.value); };
  const send = document.createElement('button');
  send.textContent = 'إرسال';
  send.onclick = () => sendQuestion(input.value);
  row.appendChild(input);
  row.appendChild(send);
  box.appendChild(row);

  addBubble('هلا. اسألني، أو قل لي تبي أضيف شي (مهمة، عادة، هدف) وأجهزه لك للتأكيد.', 'bot');
}

// ---------- الربط مع التحميل ----------

const _loadAllBeforeExtra7 = loadAll;
loadAll = async function () {
  await _loadAllBeforeExtra7();
  renderMascot();
  renderAssistant();
};

// ---------- الستايل ----------

(function addStyles7() {
  const css = `
    .mascot-wrap { display: flex; align-items: center; gap: 16px; background: var(--surface); border-radius: var(--radius); padding: 14px; margin: 12px 0; }
    .mascot-wrap svg { flex-shrink: 0; }
    .ai-log { max-height: 340px; overflow-y: auto; background: var(--surface); border-radius: var(--radius); padding: 10px; margin: 8px 0; }
    .ai-msg { padding: 10px 12px; border-radius: 12px; margin: 6px 0; white-space: pre-wrap; max-width: 90%; font-size: 15px; }
    .ai-msg.user { margin-inline-start: auto; background: var(--secondary); color: #fff; }
    .ai-msg.bot { background: var(--surface-2); }
    .ai-action { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); }
    details summary { cursor: pointer; font-size: 14px; color: var(--muted); }
  `;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();