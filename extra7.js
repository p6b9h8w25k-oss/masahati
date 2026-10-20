// ============ الشخصية والمساعد الذكي ============

const AI_KEY = 'masahati-ai';
let aiHistory = [];

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

// ---------- المساعد الذكي ----------

function buildContext() {
  const today = todayStr();
  const todayTasks = tasks.filter(t => t.due_date === today);
  const late = tasks.filter(t => t.due_date && t.due_date < today && effStatus(t) !== 'done');
  const habitLines = habits.map(h =>
    h.title + ': ' + (habitLogs.some(l => l.habit_id === h.id && l.log_date === today) ? 'تمت' : 'لم تتم')
  );
  return [
    'التاريخ: ' + today,
    'مهام اليوم: ' + (todayTasks.map(t => t.title + ' (' + effStatus(t) + ')').join('، ') || 'لا شي'),
    'المهام المتأخرة: ' + (late.map(t => t.title).join('، ') || 'لا شي'),
    'العادات: ' + (habitLines.join('، ') || 'لا شي'),
    'الأهداف: ' + (goals.map(g => g.title).join('، ') || 'لا شي'),
    'دقائق التركيز اليوم: ' + focusMinutes(today, today),
  ].join('\n');
}

async function askAI(question) {
  const s = aiSettings();
  if (!s.key) return 'حط مفتاح Groq في إعدادات المساعد أولاً.';

  const sys =
    'أنت مساعد شخصي داخل تطبيق مساحتي. ترد بالعربي، باختصار ووضوح، وتعطي خطوات عملية. ' +
    'بيانات المستخدم الحالية:\n' + buildContext();

  const messages = [{ role: 'system', content: sys }, ...aiHistory.slice(-10), { role: 'user', content: question }];

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.key },
      body: JSON.stringify({ model: s.model || 'llama-3.3-70b-versatile', messages, temperature: 0.6 }),
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
  const wait = addBubble('جاري التفكير...', 'bot');
  const answer = await askAI(q);
  wait.textContent = answer;
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
  model.placeholder = 'الموديل (اختياري)';
  model.value = s.model || 'llama-3.3-70b-versatile';
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'حفظ';
  saveBtn.onclick = () => {
    saveAiSettings({ key: key.value.trim(), model: model.value.trim() });
    alert('تم الحفظ على جهازك');
  };
  const note = document.createElement('p');
  note.className = 'meta';
  note.textContent = 'المفتاح يتحفظ على هذا الجهاز فقط. أسئلتك وبيانات اليوم تنرسل لخدمة Groq عشان ترد عليك.';
  det.appendChild(key);
  det.appendChild(model);
  det.appendChild(saveBtn);
  det.appendChild(note);
  box.appendChild(det);

  // أزرار سريعة
  const quick = document.createElement('div');
  quick.className = 'more-form';
  [
    ['خطة اليوم', 'اعطني خطة عملية لليوم بناءً على مهامي وعاداتي.'],
    ['نصيحة للعادات', 'وش تنصحني أسوي عشان أحافظ على عاداتي؟'],
    ['تحليل الأسبوع', 'حلل إنجازي هذا الأسبوع وقولي وش أحسن شي وأضعف شي.'],
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
  input.placeholder = 'اسأل المساعد...';
  input.style.width = '70%';
  input.onkeydown = e => { if (e.key === 'Enter') sendQuestion(input.value); };
  const send = document.createElement('button');
  send.textContent = 'إرسال';
  send.onclick = () => sendQuestion(input.value);
  row.appendChild(input);
  row.appendChild(send);
  box.appendChild(row);

  addBubble('هلا، أنا جاهز أساعدك. اضغط على زر سريع أو اكتب سؤالك.', 'bot');
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
    details summary { cursor: pointer; font-size: 14px; color: var(--muted); }
  `;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();