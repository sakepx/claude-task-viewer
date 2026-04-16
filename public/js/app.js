// Application entry point — wires everything together
import { state, initDOM } from './state.js';
import { initI18n, toggleLanguage } from './i18n-setup.js';
import { toggleNotifications, updateNotificationButton } from './notifications.js';
import {
  renderSessions, renderSession, renderAllTasks, renderKanban,
  renderTimeline, renderLiveUpdates, showTaskDetail,
  showTimelineTooltip, hideTimelineTooltip
} from './render.js';
import {
  fetchSessions, fetchTasks, fetchLiveUpdates, showAllTasks,
  openLiveTask, setupEventSource
} from './api.js';
import {
  handleSearch, clearSearch,
  deleteAllSessionTasks, closeDeleteSessionTasksModal, confirmDeleteSessionTasks,
  topologicalSort, showDeleteResultModal, closeDeleteResultModal,
  deleteTask, confirmDelete, closeDeleteConfirmModal,
  addNote, closeDetailPanel,
  showBlockedTaskModal, closeBlockedTaskModal,
  showHelpModal, closeHelpModal,
  filterByProject, filterBySessions, changeSessionLimit,
  switchView, toggleTheme, loadTheme, loadPreferences,
  refreshCurrentView, toggleArchived
} from './actions.js';
import { isSessionStale } from './render.js';

// --- Expose everything to window for inline onclick handlers ---

// Static HTML handlers
window.filterByProject = filterByProject;
window.filterBySessions = filterBySessions;
window.changeSessionLimit = changeSessionLimit;
window.handleSearch = handleSearch;
window.showAllTasks = showAllTasks;
window.clearSearch = clearSearch;
window.switchView = switchView;
window.toggleNotifications = toggleNotifications;
window.toggleTheme = toggleTheme;
window.toggleLanguage = toggleLanguage;
window.showHelpModal = showHelpModal;
window.closeHelpModal = closeHelpModal;
window.closeDeleteConfirmModal = closeDeleteConfirmModal;
window.confirmDelete = confirmDelete;
window.closeDeleteSessionTasksModal = closeDeleteSessionTasksModal;
window.confirmDeleteSessionTasks = confirmDeleteSessionTasks;
window.closeDeleteResultModal = closeDeleteResultModal;
window.closeBlockedTaskModal = closeBlockedTaskModal;

// Dynamic HTML handlers (generated at runtime in render functions)
window.openLiveTask = openLiveTask;
window.toggleArchived = toggleArchived;
window.fetchTasks = fetchTasks;
window.deleteAllSessionTasks = deleteAllSessionTasks;
window.showTaskDetail = showTaskDetail;
window.addNote = addNote;
window.showTimelineTooltip = showTimelineTooltip;
window.hideTimelineTooltip = hideTimelineTooltip;
window.deleteTask = deleteTask;

// Also expose render functions used via window.* in other modules
window.renderSessions = renderSessions;
window.renderSession = renderSession;
window.renderAllTasks = renderAllTasks;
window.renderTimeline = renderTimeline;
window.fetchLiveUpdates = fetchLiveUpdates;
window.updateNotificationButton = updateNotificationButton;

// --- Initialise DOM refs (must run after DOMContentLoaded to guarantee elements exist) ---
document.addEventListener('DOMContentLoaded', () => {
  initDOM();

  // Wire up static close-detail button
  document.getElementById('close-detail').onclick = closeDetailPanel;

  // Global keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in input/textarea/select
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      return;
    }

    if (e.key === 'Escape' && state.detailPanel && state.detailPanel.classList.contains('visible')) {
      closeDetailPanel();
    }

    if (state.detailPanel && state.detailPanel.classList.contains('visible')) {
      // Get task ID from detail panel label
      const labelElement = document.querySelector('.detail-label');
      if (!labelElement) return;

      const taskId = labelElement.textContent.match(/\d+/)?.[0];
      if (!taskId) return;

      const task = state.currentTasks.find(t => t.id === taskId);
      if (!task) return;

      const sessionId = task.sessionId || state.currentSessionId;

      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        deleteTask(taskId, sessionId);
      }
    }

    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      e.preventDefault();
      showHelpModal();
    }
  });

  loadTheme();
  loadPreferences();

  // i18next init kicks off the rest of the app
  initI18n(() => {
    updateNotificationButton();

    // Restore view toggle state
    if (state.currentView === 'timeline') {
      switchView('timeline');
    }

    setupEventSource();

    fetchSessions().then(() => {
      if (state.sessions.length > 0) {
        fetchTasks(state.sessions[0].id);
      } else {
        showAllTasks();
      }
    });
  });
});
