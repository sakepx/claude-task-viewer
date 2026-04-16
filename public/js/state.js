// Shared application state
export const ARCHIVE_DAYS = 7;

export const state = {
  sessions: [],
  currentSessionId: null,
  currentTasks: [],
  viewMode: 'session',
  sessionFilter: localStorage.getItem('sessionFilter') || 'all',
  sessionLimit: localStorage.getItem('sessionLimit') || '20',
  filterProject: null,
  searchQuery: '',
  allTasksCache: [],
  bulkDeleteSessionId: null,
  notificationsEnabled: localStorage.getItem('notificationsEnabled') === 'true',
  previousTaskStatuses: new Map(),
  currentView: localStorage.getItem('currentView') || 'kanban',
  archivedExpanded: localStorage.getItem('archivedExpanded') === 'true',

  // Delete confirmation state
  deleteTaskId: null,
  deleteSessionId: null,

  // DOM element references (populated by initDOM)
  sessionsList: null,
  noSession: null,
  sessionView: null,
  sessionTitle: null,
  sessionMeta: null,
  progressPercent: null,
  progressBar: null,
  pendingTasks: null,
  inProgressTasks: null,
  completedTasks: null,
  pendingCount: null,
  inProgressCount: null,
  completedCount: null,
  detailPanel: null,
  detailContent: null,
  connectionStatus: null,
};

export function initDOM() {
  state.sessionsList = document.getElementById('sessions-list');
  state.noSession = document.getElementById('no-session');
  state.sessionView = document.getElementById('session-view');
  state.sessionTitle = document.getElementById('session-title');
  state.sessionMeta = document.getElementById('session-meta');
  state.progressPercent = document.getElementById('progress-percent');
  state.progressBar = document.getElementById('progress-bar');
  state.pendingTasks = document.getElementById('pending-tasks');
  state.inProgressTasks = document.getElementById('in-progress-tasks');
  state.completedTasks = document.getElementById('completed-tasks');
  state.pendingCount = document.getElementById('pending-count');
  state.inProgressCount = document.getElementById('in-progress-count');
  state.completedCount = document.getElementById('completed-count');
  state.detailPanel = document.getElementById('detail-panel');
  state.detailContent = document.getElementById('detail-content');
  state.connectionStatus = document.getElementById('connection-status');
}
