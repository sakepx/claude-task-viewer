// Desktop and audio notification functions
import { state } from './state.js';

export function toggleNotifications() {
  if (!state.notificationsEnabled && Notification.permission !== 'granted') {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') {
        state.notificationsEnabled = true;
        localStorage.setItem('notificationsEnabled', 'true');
        updateNotificationButton();
      }
    });
  } else {
    state.notificationsEnabled = !state.notificationsEnabled;
    localStorage.setItem('notificationsEnabled', String(state.notificationsEnabled));
    updateNotificationButton();
  }
}

export function updateNotificationButton() {
  const btn = document.getElementById('notifications-toggle');
  if (!btn) return;
  if (state.notificationsEnabled) {
    btn.classList.add('notifications-active');
    btn.title = i18next.t('notification.notificationsOn');
  } else {
    btn.classList.remove('notifications-active');
    btn.title = i18next.t('notification.notificationsOff');
  }
}

export function fireTaskNotification(task) {
  // Desktop notification
  if (Notification.permission === 'granted') {
    const n = new Notification(i18next.t('notification.taskCompleted'), {
      body: task.subject,
      icon: undefined,
      tag: `task-${task.sessionId}-${task.id}`
    });
    n.onclick = () => {
      window.focus();
      window.openLiveTask(task.sessionId, task.id);
      n.close();
    };
  }

  // Audio chime (C5 → E5, two-tone)
  playChime();
}

export function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    // First tone: C5 (523Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.frequency.value = 523;
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second tone: E5 (659Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.frequency.value = 659;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0.15, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.25);

    // Clean up
    setTimeout(() => ctx.close(), 500);
  } catch (e) {
    // Audio not available
  }
}
