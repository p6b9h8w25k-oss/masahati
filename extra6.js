// ============ التذكير والموقع مقفل (Web Push) ============

const VAPID_PUBLIC = 'BApb0PhLH8IDA233JgFw_VO03Mo4AwDCkNYWL4rcC0XCEKjUi92jWxlQrod6dRGWUW8jbrwd3DKw_MpxrEVJdiU';

function urlB64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function currentPushSub() {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

// إيقاف التذكير المحلي القديم عشان ما يتكرر مع تذكير السيرفر
checkReminder = function () {};

async function enablePush(time) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return alert('هذا المتصفح ما يدعم التذكير. على الآيفون: أضف الموقع للشاشة الرئيسية وافتحه من هناك (iOS 16.4 أو أحدث).');
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return alert('ما سمحت بالإشعارات. فعّلها من إعدادات الموقع.');

  const reg = await navigator.serviceWorker.register('sw.js');
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC),
    });
  }

  const j = sub.toJSON();
  const { data: { user } } = await db.auth.getUser();
  const { error } = await db.from('push_subs').upsert({
    user_id: user.id,
    endpoint: j.endpoint,
    p256dh: j.keys.p256dh,
    auth_key: j.keys.auth,
    remind_time: time || '21:00',
    tz_minutes: -new Date().getTimezoneOffset(),
  }, { onConflict: 'endpoint' });
  if (error) return alert(error.message);

  saveNotifySettings({ ...getNotifySettings(), time });
  alert('تم تفعيل التذكير');
  renderNotifyBox();
}

async function disablePush() {
  const sub = await currentPushSub();
  if (sub) {
    await db.from('push_subs').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
  renderNotifyBox();
}

async function renderNotifyBox() {
  const box = $('notifyBox');
  if (!box) return;
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

  const sub = await currentPushSub().catch(() => null);
  const saved = getNotifySettings();

  const row = document.createElement('div');
  row.className = 'more-form';

  const label = document.createElement('label');
  label.textContent = 'وقت التذكير اليومي: ';
  const time = document.createElement('input');
  time.type = 'time';
  time.value = saved.time || '21:00';
  time.onchange = async () => {
    saveNotifySettings({ ...getNotifySettings(), time: time.value });
    if (sub) await db.from('push_subs').update({ remind_time: time.value }).eq('endpoint', sub.endpoint);
  };
  label.appendChild(time);

  const btn = document.createElement('button');
  btn.textContent = sub ? 'إيقاف التذكير' : 'تشغيل التذكير';
  btn.onclick = () => (sub ? disablePush() : enablePush(time.value));

  row.appendChild(label);
  row.appendChild(btn);
  box.appendChild(row);

  const status = document.createElement('p');
  status.className = 'meta';
  status.textContent = sub
    ? 'التذكير مفعّل، ويوصلك حتى لو الموقع مسكر.'
    : 'التذكير متوقف.';
  box.appendChild(status);
}