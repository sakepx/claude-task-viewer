// i18n initialization and language switching
import { state } from './state.js';

const savedLang = localStorage.getItem('lang') || 'en';

export function updateI18nDOM() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = i18next.t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = i18next.t(key);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.title = i18next.t(key);
  });
}

export function updateLangButton() {
  const label = document.getElementById('lang-label');
  if (label) {
    label.textContent = i18next.t('lang.switchLabel');
  }
}

export function toggleLanguage() {
  const newLang = i18next.language === 'en' ? 'ja' : 'en';
  i18next.changeLanguage(newLang).then(() => {
    localStorage.setItem('lang', newLang);
    updateI18nDOM();
    updateLangButton();
    // Re-render dynamic content via window.* to avoid circular deps
    window.renderSessions();
    if (state.viewMode === 'all') {
      window.renderAllTasks();
    } else if (state.currentSessionId) {
      window.renderSession();
    }
    window.fetchLiveUpdates();
    window.updateNotificationButton();
  });
}

export function initI18n(onReady) {
  i18next
    .use(i18nextHttpBackend)
    .init({
      lng: savedLang,
      fallbackLng: 'en',
      backend: {
        loadPath: '/locales/{{lng}}/{{ns}}.json'
      },
      interpolation: {
        escapeValue: false
      }
    })
    .then(() => {
      updateI18nDOM();
      updateLangButton();
      if (onReady) onReady();
    });
}
