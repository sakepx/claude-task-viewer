// API fetch functions and SSE event source setup
import { state } from './state.js';
import { renderSessions, renderSession, renderAllTasks, renderLiveUpdates } from './render.js';
import { fireTaskNotification, updateNotificationButton } from './notifications.js';

export async function fetchSessions() {
  console.log('[fetchSessions] Starting...');
  try {
    // Snapshot previous task statuses for notification detection
    const oldStatuses = new Map();
    for (const task of state.allTasksCache) {
      const key = `${task.sessionId}:${task.id}`;
      oldStatuses.set(key, task.status);
    }

    const res = await fetch(`/api/sessions?limit=${state.sessionLimit}`);
    state.sessions = await res.json();
    console.log('[fetchSessions] Sessions loaded:', state.sessions.length);

    // Fetch all tasks for search
    const tasksRes = await fetch('/api/tasks/all');
    state.allTasksCache = await tasksRes.json();
    console.log('[fetchSessions] Tasks cache loaded');

    // Detect task completions and fire notifications
    if (state.notificationsEnabled && oldStatuses.size > 0) {
      for (const task of state.allTasksCache) {
        const key = `${task.sessionId}:${task.id}`;
        const oldStatus = oldStatuses.get(key);
        if (oldStatus === 'in_progress' && task.status === 'completed') {
          fireTaskNotification(task);
        }
      }
    }

    // Update previous statuses
    state.previousTaskStatuses = oldStatuses;

    renderSessions();
    console.log('[fetchSessions] Render complete');
    fetchLiveUpdates();
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
  }
}

export async function fetchLiveUpdates() {
  try {
    const res = await fetch('/api/tasks/all');
    const allTasks = await res.json();
    let activeTasks = allTasks.filter(t => t.status === 'in_progress');
    if (state.filterProject) {
      activeTasks = activeTasks.filter(t => t.project === state.filterProject);
    }
    renderLiveUpdates(activeTasks);
  } catch (error) {
    console.error('Failed to fetch live updates:', error);
  }
}

export async function fetchTasks(sessionId) {
  try {
    state.viewMode = 'session';
    const res = await fetch(`/api/sessions/${sessionId}`);

    if (res.ok) {
      state.currentTasks = await res.json();
    } else if (res.status === 404) {
      // Session has no tasks directory yet - start with empty task list
      state.currentTasks = [];
    } else {
      throw new Error(`Failed to fetch tasks: ${res.status}`);
    }

    state.currentSessionId = sessionId;
    renderSession();
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    // Clear tasks on error to avoid showing stale data
    state.currentTasks = [];
    state.currentSessionId = sessionId;
    renderSession();
  }
}

export async function showAllTasks() {
  try {
    state.viewMode = 'all';
    state.currentSessionId = null;
    const res = await fetch('/api/tasks/all');
    let tasks = await res.json();
    if (state.filterProject) {
      tasks = tasks.filter(t => t.project === state.filterProject);
    }
    state.currentTasks = tasks;
    renderAllTasks();
    renderSessions();
  } catch (error) {
    console.error('Failed to fetch all tasks:', error);
  }
}

export async function openLiveTask(sessionId, taskId) {
  await fetchTasks(sessionId);
  window.showTaskDetail(taskId, sessionId);
}

export function setupEventSource() {
  let retryDelay = 1000;
  let eventSource;

  function connect() {
    eventSource = new EventSource('/api/events');

    eventSource.onopen = () => {
      retryDelay = 1000; // Reset on successful connection
      state.connectionStatus.innerHTML = `
        <span class="connection-dot live"></span>
        <span>${i18next.t('connection.connected')}</span>
      `;
    };

    eventSource.onerror = () => {
      eventSource.close();
      state.connectionStatus.innerHTML = `
        <span class="connection-dot error"></span>
        <span>${i18next.t('connection.reconnecting')}</span>
      `;
      setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000); // Max 30s
    };

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('[SSE] Event received:', data);
      if (data.type === 'update' || data.type === 'metadata-update') {
        console.log('[SSE] Calling fetchSessions()...');
        fetchSessions().catch(err => {
          console.error('[SSE] fetchSessions failed:', err);
        });

        // For metadata-update or matching sessionId, refresh current session view
        if (state.currentSessionId && (data.type === 'metadata-update' || data.sessionId === state.currentSessionId)) {
          console.log('[SSE] Refreshing current session view:', state.currentSessionId);
          fetchTasks(state.currentSessionId);
        }
      }
    };
  }

  connect();
}
