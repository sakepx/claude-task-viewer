// User-action functions
import { state, ARCHIVE_DAYS } from './state.js';
import { fetchSessions, fetchTasks, fetchLiveUpdates, showAllTasks } from './api.js';
import { renderSessions, renderSession, renderAllTasks } from './render.js';
import { escapeHtml } from './utils.js';

// --- Search ---

export function handleSearch(query) {
  state.searchQuery = query.toLowerCase().trim();

  const clearBtn = document.getElementById('search-clear-btn');
  if (state.searchQuery) {
    clearBtn.classList.add('visible');
  } else {
    clearBtn.classList.remove('visible');
  }

  renderSessions();
}

export function clearSearch() {
  const searchInput = document.getElementById('search-input');
  searchInput.value = '';
  state.searchQuery = '';
  document.getElementById('search-clear-btn').classList.remove('visible');
  renderSessions();
}

// --- Filters ---

export function filterBySessions(value) {
  state.sessionFilter = value;
  localStorage.setItem('sessionFilter', state.sessionFilter);
  renderSessions();
}

export function changeSessionLimit(value) {
  state.sessionLimit = value;
  localStorage.setItem('sessionLimit', state.sessionLimit);
  fetchSessions();
}

export function filterByProject(project) {
  state.filterProject = project || null;
  renderSessions();
  fetchLiveUpdates();
  showAllTasks();
}

// --- Bulk delete ---

export function deleteAllSessionTasks(sessionId) {
  const session = state.sessions.find(s => s.id === sessionId);
  if (!session) return;

  const sessionTasks = state.currentSessionId === sessionId
    ? state.currentTasks
    : state.currentTasks.filter(t => t.sessionId === sessionId);

  if (sessionTasks.length === 0) {
    alert(i18next.t('session.noTasksToDelete'));
    return;
  }

  state.bulkDeleteSessionId = sessionId;

  const displayName = session.name || sessionId;
  const message = i18next.t('modal.deleteAllConfirm', { count: sessionTasks.length, name: displayName });

  document.getElementById('delete-session-tasks-message').textContent = message;

  const modal = document.getElementById('delete-session-tasks-modal');
  modal.classList.add('visible');

  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDeleteSessionTasksModal();
      document.removeEventListener('keydown', keyHandler);
    }
  };
  document.addEventListener('keydown', keyHandler);
}

export function closeDeleteSessionTasksModal() {
  const modal = document.getElementById('delete-session-tasks-modal');
  modal.classList.remove('visible');
  state.bulkDeleteSessionId = null;
}

export async function confirmDeleteSessionTasks() {
  if (!state.bulkDeleteSessionId) return;

  const sessionId = state.bulkDeleteSessionId;
  closeDeleteSessionTasksModal();

  const sessionTasks = state.currentSessionId === sessionId
    ? state.currentTasks
    : state.currentTasks.filter(t => t.sessionId === sessionId);

  const sortedTasks = topologicalSort(sessionTasks);

  let successCount = 0;
  let failedCount = 0;
  const failedTasks = [];

  for (const task of sortedTasks) {
    try {
      const res = await fetch(`/api/tasks/${sessionId}/${task.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        successCount++;
      } else {
        failedCount++;
        const error = await res.json();
        failedTasks.push({ id: task.id, subject: task.subject, error: error.error });
        console.error(`Failed to delete task ${task.id}:`, error);
      }
    } catch (error) {
      failedCount++;
      failedTasks.push({ id: task.id, subject: task.subject, error: 'Network error' });
      console.error(`Error deleting task ${task.id}:`, error);
    }
  }

  showDeleteResultModal(successCount, failedCount, failedTasks);
  closeDetailPanel();
  await refreshCurrentView();
}

// --- Topological sort ---

export function topologicalSort(tasks) {
  const result = [];
  const visited = new Set();
  const visiting = new Set();
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  function visit(taskId) {
    if (visited.has(taskId)) return;
    if (visiting.has(taskId)) return; // Cycle - skip

    visiting.add(taskId);
    const task = taskMap.get(taskId);

    if (task && task.blocks && task.blocks.length > 0) {
      for (const blockedId of task.blocks) {
        if (taskMap.has(blockedId)) {
          visit(blockedId);
        }
      }
    }

    visiting.delete(taskId);
    visited.add(taskId);
    if (task) result.push(task);
  }

  for (const task of tasks) {
    visit(task.id);
  }

  return result;
}

// --- Delete result modal ---

export function showDeleteResultModal(successCount, failedCount, failedTasks) {
  const modal = document.getElementById('delete-result-modal');
  const messageEl = document.getElementById('delete-result-message');
  const detailsEl = document.getElementById('delete-result-details');

  if (failedCount === 0) {
    messageEl.textContent = i18next.t('modal.deleteSuccess', { count: successCount });
    detailsEl.style.display = 'none';
  } else {
    messageEl.textContent = i18next.t('modal.deletePartial', { success: successCount, failed: failedCount });

    const failedList = failedTasks.map(t =>
      `<li><strong>${escapeHtml(t.subject)}</strong> (#${escapeHtml(t.id)}): ${escapeHtml(t.error)}</li>`
    ).join('');
    detailsEl.innerHTML = `<ul style="margin: 8px 0 0 0; padding-left: 20px;">${failedList}</ul>`;
    detailsEl.style.display = 'block';
  }

  modal.classList.add('visible');

  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDeleteResultModal();
      document.removeEventListener('keydown', keyHandler);
    }
  };
  document.addEventListener('keydown', keyHandler);
}

export function closeDeleteResultModal() {
  const modal = document.getElementById('delete-result-modal');
  modal.classList.remove('visible');
}

// --- Single task delete ---

export function deleteTask(taskId, sessionId) {
  const task = state.currentTasks.find(t => t.id === taskId);
  if (!task) return;

  state.deleteTaskId = taskId;
  state.deleteSessionId = sessionId;

  const message = document.getElementById('delete-confirm-message');
  message.textContent = i18next.t('modal.deleteConfirm', { subject: task.subject });

  const modal = document.getElementById('delete-confirm-modal');
  modal.classList.add('visible');

  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDeleteConfirmModal();
      document.removeEventListener('keydown', keyHandler);
    }
  };
  document.addEventListener('keydown', keyHandler);
}

export function closeDeleteConfirmModal() {
  const modal = document.getElementById('delete-confirm-modal');
  modal.classList.remove('visible');
  state.deleteTaskId = null;
  state.deleteSessionId = null;
}

export async function confirmDelete() {
  if (!state.deleteTaskId || !state.deleteSessionId) return;

  const taskId = state.deleteTaskId;
  const sessionId = state.deleteSessionId;

  closeDeleteConfirmModal();

  try {
    const res = await fetch(`/api/tasks/${sessionId}/${taskId}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      closeDetailPanel();
      await refreshCurrentView();
    } else {
      const error = await res.json();
      alert('Failed to delete task: ' + (error.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Failed to delete task:', error);
    alert('Failed to delete task');
  }
}

// --- Notes ---

export async function addNote(event, taskId, sessionId) {
  event.preventDefault();
  const input = document.getElementById('note-input');
  const note = input.value.trim();
  if (!note) return;

  try {
    const res = await fetch(`/api/tasks/${sessionId}/${taskId}/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });

    if (res.ok) {
      input.value = '';
      if (state.viewMode === 'all') {
        const tasksRes = await fetch('/api/tasks/all');
        state.currentTasks = await tasksRes.json();
      } else {
        await fetchTasks(sessionId);
      }
      window.showTaskDetail(taskId, sessionId);
    }
  } catch (error) {
    console.error('Failed to add note:', error);
  }
}

// --- Detail panel ---

export function closeDetailPanel() {
  state.detailPanel.classList.remove('visible');
}

// --- Blocked task modal ---

export function showBlockedTaskModal(task) {
  const messageDiv = document.getElementById('blocked-task-message');

  const blockedByList = task.blockedBy.map(id => {
    const blockingTask = state.currentTasks.find(t => t.id === id);
    if (blockingTask) {
      return `<li><strong>#${blockingTask.id}</strong> - ${escapeHtml(blockingTask.subject)}</li>`;
    }
    return `<li><strong>#${id}</strong></li>`;
  }).join('');

  messageDiv.innerHTML = `
    <p style="margin-bottom: 12px;">${i18next.t('modal.blockedTaskMsg', { id: task.id, subject: escapeHtml(task.subject) })}</p>
    <ul style="margin: 0 0 16px 20px; padding: 0;">${blockedByList}</ul>
    <p style="margin: 0; color: var(--text-secondary); font-size: 13px;">
      ${i18next.t('modal.resolveFirst')}
    </p>
  `;

  const modal = document.getElementById('blocked-task-modal');
  modal.classList.add('visible');

  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeBlockedTaskModal();
      document.removeEventListener('keydown', keyHandler);
    }
  };
  document.addEventListener('keydown', keyHandler);
}

export function closeBlockedTaskModal() {
  const modal = document.getElementById('blocked-task-modal');
  modal.classList.remove('visible');
}

// --- Help modal ---

export function showHelpModal() {
  const modal = document.getElementById('help-modal');
  modal.classList.add('visible');

  const keyHandler = (e) => {
    if (e.key === 'Escape' || e.key === '?') {
      e.preventDefault();
      closeHelpModal();
      document.removeEventListener('keydown', keyHandler);
    }
  };
  document.addEventListener('keydown', keyHandler);
}

export function closeHelpModal() {
  const modal = document.getElementById('help-modal');
  modal.classList.remove('visible');
}

// --- Theme ---

export function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  document.getElementById('theme-icon-dark').style.display = isLight ? 'none' : 'block';
  document.getElementById('theme-icon-light').style.display = isLight ? 'block' : 'none';
}

export function loadTheme() {
  if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light');
    document.getElementById('theme-icon-dark').style.display = 'none';
    document.getElementById('theme-icon-light').style.display = 'block';
  }
}

// --- Preferences ---

export function loadPreferences() {
  document.getElementById('session-filter').value = state.sessionFilter;
  document.getElementById('session-limit').value = state.sessionLimit;
}

// --- View toggle ---

export function switchView(view) {
  state.currentView = view;
  localStorage.setItem('currentView', view);

  const kanbanEl = document.querySelector('.kanban');
  const timelineEl = document.getElementById('timeline-view');
  const kanbanBtn = document.getElementById('view-kanban-btn');
  const timelineBtn = document.getElementById('view-timeline-btn');

  if (view === 'kanban') {
    kanbanEl.style.display = 'flex';
    timelineEl.classList.remove('visible');
    kanbanBtn.classList.add('active');
    timelineBtn.classList.remove('active');
  } else {
    kanbanEl.style.display = 'none';
    timelineEl.classList.add('visible');
    kanbanBtn.classList.remove('active');
    timelineBtn.classList.add('active');
    window.renderTimeline();
  }
}

// --- Refresh ---

export async function refreshCurrentView() {
  fetchLiveUpdates();
  if (state.viewMode === 'all') {
    await showAllTasks();
  } else if (state.currentSessionId) {
    await fetchTasks(state.currentSessionId);
  } else {
    await fetchSessions();
  }
}

// --- Archive ---

export function toggleArchived() {
  state.archivedExpanded = !state.archivedExpanded;
  localStorage.setItem('archivedExpanded', String(state.archivedExpanded));
  const header = document.querySelector('.archived-header');
  const container = document.querySelector('.archived-sessions');
  if (header) header.classList.toggle('expanded', state.archivedExpanded);
  if (container) container.classList.toggle('visible', state.archivedExpanded);
}

