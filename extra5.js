// ============ مرفقات الملاحظات ============

const MAX_FILE_MB = 10;
let attNoteId = null;

function safeFileName(name) {
  return name.replace(/[^\w.\-]/g, '_');
}

async function uploadAttachment(noteItem, file) {
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    return alert('الملف أكبر من ' + MAX_FILE_MB + ' ميغا. اختر ملف أصغر.');
  }
  const { data: { user } } = await db.auth.getUser();
  const path = user.id + '/' + Date.now() + '-' + safeFileName(file.name);

  const { error: upErr } = await db.storage.from('attachments').upload(path, file);
  if (upErr) return alert('ما قدرت أرفع الملف: ' + upErr.message);

  const files = (noteItem.extra && noteItem.extra.files) || [];
  const { error } = await db.from('items').update({
    extra: { ...(noteItem.extra || {}), files: [...files, { path, name: file.name }] },
  }).eq('id', noteItem.id);
  if (error) return alert(error.message);

  loadAll();
}

async function openAttachment(path) {
  const { data, error } = await db.storage.from('attachments').createSignedUrl(path, 3600);
  if (error) return alert(error.message);
  window.open(data.signedUrl, '_blank', 'noopener');
}

async function deleteAttachment(noteItem, path) {
  if (!confirm('تبي تحذف هذا المرفق؟')) return;
  await db.storage.from('attachments').remove([path]);
  const files = ((noteItem.extra && noteItem.extra.files) || []).filter(f => f.path !== path);
  const { error } = await db.from('items').update({
    extra: { ...(noteItem.extra || {}), files },
  }).eq('id', noteItem.id);
  if (error) return alert(error.message);
  loadAll();
}

function renderAttachments() {
  const box = $('attBox');
  if (!box) return;

  // نبني الواجهة مرة وحدة، والقائمة تتحدث مع كل تحميل
  if (!box.dataset.built) {
    box.dataset.built = '1';
    const h = document.createElement('h3');
    h.textContent = 'مرفقات الملاحظات';
    box.appendChild(h);

    const form = document.createElement('div');
    form.className = 'more-form';
    const sel = document.createElement('select');
    sel.id = 'attNoteSelect';
    sel.onchange = () => { attNoteId = sel.value; drawAttachments(); };
    const file = document.createElement('input');
    file.type = 'file';
    file.id = 'attFile';
    const upBtn = document.createElement('button');
    upBtn.textContent = 'رفع الملف';
    upBtn.onclick = () => {
      const note = items.find(i => i.id === attNoteId);
      const f = $('attFile').files[0];
      if (!note) return alert('اختر ملاحظة أولاً');
      if (!f) return alert('اختر ملف أولاً');
      uploadAttachment(note, f);
    };
    form.appendChild(sel);
    form.appendChild(file);
    form.appendChild(upBtn);
    box.appendChild(form);

    const list = document.createElement('div');
    list.id = 'attList';
    box.appendChild(list);
  }

  // تحديث قائمة الملاحظات في الاختيار
  const sel = $('attNoteSelect');
  const notes = items.filter(i => i.kind === 'note');
  const current = sel.value;
  sel.innerHTML = '';
  if (notes.length === 0) {
    const o = document.createElement('option');
    o.textContent = 'أضف ملاحظة أولاً من عام ← ملاحظات';
    o.value = '';
    sel.appendChild(o);
    attNoteId = null;
  } else {
    for (const n of notes) {
      const o = document.createElement('option');
      o.value = n.id;
      o.textContent = n.title;
      sel.appendChild(o);
    }
    if (notes.some(n => n.id === (attNoteId || current))) {
      sel.value = attNoteId || current;
    } else {
      attNoteId = notes[0].id;
      sel.value = attNoteId;
    }
  }
  drawAttachments();
}

function drawAttachments() {
  const list = $('attList');
  if (!list) return;
  list.innerHTML = '';
  const note = items.find(i => i.id === attNoteId);
  if (!note) return;

  const files = (note.extra && note.extra.files) || [];
  if (files.length === 0) {
    const p = document.createElement('div');
    p.className = 'meta';
    p.textContent = 'ما فيه مرفقات لهذي الملاحظة.';
    list.appendChild(p);
    return;
  }

  for (const f of files) {
    const div = document.createElement('div');
    div.className = 'task';
    const info = document.createElement('div');
    info.className = 'info';
    const t = document.createElement('strong');
    t.textContent = f.name;
    info.appendChild(t);

    const open = document.createElement('button');
    open.textContent = 'فتح';
    open.onclick = () => openAttachment(f.path);

    const del = document.createElement('button');
    del.textContent = 'حذف';
    del.onclick = () => deleteAttachment(note, f.path);

    div.appendChild(info);
    div.appendChild(open);
    div.appendChild(del);
    list.appendChild(div);
  }
}

// ---------- الربط مع التحميل ----------

const _loadAllBeforeExtra5 = loadAll;
loadAll = async function () {
  await _loadAllBeforeExtra5();
  renderAttachments();
};