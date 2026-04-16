// Rendering functions for sessions, tasks, kanban, timeline, detail panel
import { state, ARCHIVE_DAYS } from './state.js';
import { formatDate, escapeHtml, fuzzyMatch } from './utils.js';

// --- Helper: isTaskActuallyBlocked ---

export function isTaskActuallyBlocked(task) {
  if (!task.blockedBy || task.blockedBy.length === 0) return false;
  return task.blockedBy.some(id => {
    const blockingTask = state.currentTasks.find(t =>
      t.id === id && (state.viewMode !== 'all' || t.sessionId === task.sessionId)
    );
    return !blockingTask || blockingTask.status !== 'completed';
  });
}

// --- Project dropdown ---

export function updateProjectDropdown() {
  const dropdown = document.getElementById('project-filter');
  if (!dropdown) return;
  const projects = [...new Set(state.sessions.map(s => s.project).filter(Boolean))].sort();

  dropdown.innerHTML = `<option value="">${i18next.t('sidebar.allProjects')}</option>` +
    projects.map(p => {
      const name = p.split('/').pop();
      const selected = p === state.filterProject ? ' selected' : '';
      return `<option value="${p}"${selected} title="${escapeHtml(p)}">${escapeHtml(name)}</option>`;
    }).join('');
}

// --- Session list rendering ---

export function isSessionStale(session) {
  if (session.inProgress > 0) return false;
  const modifiedAt = new Date(session.modifiedAt);
  const daysAgo = (Date.now() - modifiedAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysAgo > ARCHIVE_DAYS;
}

export function renderSessionItem(session, isArchived) {
  const total = session.taskCount;
  const percent = total > 0 ? Math.round((session.completed / total) * 100) : 0;
  const isActive = session.id === state.currentSessionId && state.viewMode === 'session';
  const hasInProgress = session.inProgress > 0;
  const sessionName = session.name || session.id.slice(0, 8) + '...';
  const projectName = session.project ? session.project.split('/').pop() : null;
  const primaryName = projectName || sessionName;
  const secondaryName = projectName ? sessionName : null;

  const gitBranch = session.gitBranch ? escapeHtml(session.gitBranch) : null;

  const createdDisplay = session.createdAt ? formatDate(session.createdAt) : '';
  const modifiedDisplay = formatDate(session.modifiedAt);
  const timeDisplay = session.createdAt && createdDisplay !== modifiedDisplay
    ? `Created ${createdDisplay} · Modified ${modifiedDisplay}`
    : modifiedDisplay;

  const tooltip = [timeDisplay, gitBranch ? `Branch: ${gitBranch}` : ''].filter(Boolean).join(' | ');

  return `
    <button onclick="fetchTasks('${session.id}')" class="session-item ${isActive ? 'active' : ''} ${isArchived ? 'archived' : ''}" title="${tooltip}">
      <div class="session-name">
        <span>${escapeHtml(primaryName)}</span>
        ${hasInProgress ? '<span class="pulse"></span>' : ''}
      </div>
      ${secondaryName ? `<div class="session-secondary">${escapeHtml(secondaryName)}</div>` : ''}
      ${gitBranch ? `<div class="session-branch">${gitBranch}</div>` : ''}
      <div class="session-progress">
        <div class="progress-bar"><div class="progress-fill" style="width: ${percent}%"></div></div>
        <span class="progress-text">${session.completed}/${total}</span>
      </div>
      <div class="session-time">${formatDate(session.modifiedAt)}</div>
    </button>
  `;
}

export function renderSessions() {
  // Update project dropdown
  updateProjectDropdown();

  let filteredSessions = state.sessions;
  if (state.sessionFilter === 'active') {
    filteredSessions = filteredSessions.filter(s => s.pending > 0 || s.inProgress > 0);
  }
  if (state.filterProject) {
    filteredSessions = filteredSessions.filter(s => s.project === state.filterProject);
  }

  // Apply search filter
  if (state.searchQuery) {
    filteredSessions = filteredSessions.filter(session => {
      // Search in session name and ID
      if (session.name && fuzzyMatch(session.name, state.searchQuery)) return true;
      if (session.id && fuzzyMatch(session.id, state.searchQuery)) return true;

      // Search in project path
      if (session.project && fuzzyMatch(session.project, state.searchQuery)) return true;

      // Search in description
      if (session.description && fuzzyMatch(session.description, state.searchQuery)) return true;

      // Search in tasks for this session
      const sessionTasks = state.allTasksCache.filter(t => t.sessionId === session.id);
      return sessionTasks.some(task =>
        (task.subject && fuzzyMatch(task.subject, state.searchQuery)) ||
        (task.description && fuzzyMatch(task.description, state.searchQuery)) ||
        (task.activeForm && fuzzyMatch(task.activeForm, state.searchQuery))
      );
    });
  }

  if (filteredSessions.length === 0) {
    let emptyMsg = i18next.t('session.noSessions');
    let emptyHint = i18next.t('session.sessionsAppear');

    if (state.searchQuery) {
      emptyMsg = i18next.t('session.noResults', { query: state.searchQuery });
      emptyHint = i18next.t('session.tryDifferent');
    } else if (state.filterProject && state.sessionFilter === 'active') {
      emptyMsg = i18next.t('session.noActiveForProject');
      emptyHint = i18next.t('session.tryAllSessions');
    } else if (state.filterProject) {
      emptyMsg = i18next.t('session.noSessionsForProject');
      emptyHint = i18next.t('session.selectAllProjects');
    } else if (state.sessionFilter === 'active') {
      emptyMsg = i18next.t('session.noActiveSessions');
      emptyHint = i18next.t('session.selectAllSessions');
    }
    state.sessionsList.innerHTML = `
      <div style="padding: 24px 12px; text-align: center; color: var(--text-muted); font-size: 12px;">
        <p>${emptyMsg}</p>
        <p style="margin-top: 8px; font-size: 11px;">${emptyHint}</p>
      </div>
    `;
    return;
  }

  // Split into active and archived
  const activeSessions = [];
  const archivedSessions = [];
  for (const session of filteredSessions) {
    if (state.sessionFilter === 'active' || state.searchQuery) {
      activeSessions.push(session);
    } else if (isSessionStale(session)) {
      archivedSessions.push(session);
    } else {
      activeSessions.push(session);
    }
  }

  let html = activeSessions.map(session => renderSessionItem(session, false)).join('');

  if (archivedSessions.length > 0) {
    html += `
      <div class="archived-header ${state.archivedExpanded ? 'expanded' : ''}" onclick="toggleArchived()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6"/>
        </svg>
        <span>${i18next.t('session.archived')} (${archivedSessions.length})</span>
      </div>
      <div class="archived-sessions ${state.archivedExpanded ? 'visible' : ''}">
        ${archivedSessions.map(session => renderSessionItem(session, true)).join('')}
      </div>
    `;
  }

  state.sessionsList.innerHTML = html;
}

// --- Live updates ---

export function renderLiveUpdates(activeTasks) {
  const container = document.getElementById('live-updates');
  if (!container) return;

  if (activeTasks.length === 0) {
    container.innerHTML = `<div class="live-empty">${i18next.t('kanban.noActive')}</div>`;
    return;
  }

  container.innerHTML = activeTasks.map(task => `
    <div class="live-item" onclick="openLiveTask('${task.sessionId}', '${task.id}')">
      <span class="pulse"></span>
      <div class="live-item-content">
        <div class="live-item-action">${escapeHtml(task.activeForm || task.subject)}</div>
        <div class="live-item-session">${escapeHtml(task.sessionName || task.sessionId.slice(0, 8))}</div>
      </div>
    </div>
  `).join('');
}

// --- Task card ---

export function renderTaskCard(task) {
  const isBlocked = isTaskActuallyBlocked(task);
  const taskId = state.viewMode === 'all' ? `${task.sessionId?.slice(0,4)}-${task.id}` : task.id;
  const sessionLabel = state.viewMode === 'all' && task.sessionName ? task.sessionName : null;
  const statusClass = task.status.replace('_', '-');
  const actualSessionId = task.sessionId || state.currentSessionId;

  return `
    <div
      onclick="showTaskDetail('${task.id}', '${actualSessionId}')"
      class="task-card ${statusClass} ${isBlocked ? 'blocked' : ''}">
      <div class="task-id">
        <span>#${taskId}</span>
        ${isBlocked ? `<span class="task-badge blocked">${i18next.t('task.blocked')}</span>` : ''}
      </div>
      <div class="task-title">${escapeHtml(task.subject)}</div>
      ${sessionLabel ? `<div class="task-session">${escapeHtml(sessionLabel)}</div>` : ''}
      ${task.status === 'in_progress' && task.activeForm ? `<div class="task-active">${escapeHtml(task.activeForm)}</div>` : ''}
      ${isBlocked ? `<div class="task-blocked">${i18next.t('task.waitingOn', { ids: task.blockedBy.map(id => '#' + id).join(', ') })}</div>` : ''}
      ${task.description ? `<div class="task-desc">${escapeHtml(task.description.split('\n')[0])}</div>` : ''}
    </div>
  `;
}

// --- Kanban ---

export function renderKanban() {
  const pending = state.currentTasks.filter(t => t.status === 'pending');
  const inProgress = state.currentTasks.filter(t => t.status === 'in_progress');
  const completed = state.currentTasks.filter(t => t.status === 'completed');

  state.pendingCount.textContent = pending.length;
  state.inProgressCount.textContent = inProgress.length;
  state.completedCount.textContent = completed.length;

  state.pendingTasks.innerHTML = pending.length > 0
    ? pending.map(renderTaskCard).join('')
    : `<div class="column-empty">${i18next.t('kanban.noPending')}</div>`;

  state.inProgressTasks.innerHTML = inProgress.length > 0
    ? inProgress.map(renderTaskCard).join('')
    : `<div class="column-empty">${i18next.t('kanban.noActive')}</div>`;

  state.completedTasks.innerHTML = completed.length > 0
    ? completed.map(renderTaskCard).join('')
    : `<div class="column-empty">${i18next.t('kanban.noCompleted')}</div>`;

  // Also update timeline if visible
  if (state.currentView === 'timeline') {
    renderTimeline();
  }
}

// --- All tasks view ---

export function renderAllTasks() {
  state.noSession.style.display = 'none';
  state.sessionView.classList.add('visible');

  const totalTasks = state.currentTasks.length;
  const completed = state.currentTasks.filter(t => t.status === 'completed').length;
  const percent = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

  const projectName = state.filterProject ? state.filterProject.split('/').pop() : null;
  state.sessionTitle.textContent = state.filterProject
    ? i18next.t('task.tasksInProject', { project: projectName })
    : i18next.t('task.allTasks');
  state.sessionMeta.textContent = state.filterProject
    ? i18next.t('task.tasksInThisProject', { count: totalTasks })
    : i18next.t('task.tasksAcrossSessions', { count: totalTasks, sessions: state.sessions.length });
  state.progressPercent.textContent = `${percent}%`;
  state.progressBar.style.width = `${percent}%`;

  renderKanban();
}

// --- Session view ---

export function renderSession() {
  state.noSession.style.display = 'none';
  state.sessionView.classList.add('visible');

  const session = state.sessions.find(s => s.id === state.currentSessionId);
  if (!session) return;

  const displayName = session.name || state.currentSessionId;

  // Create header with delete button
  state.sessionTitle.innerHTML = `
    <span style="flex: 1;">${escapeHtml(displayName)}</span>
    <button class="icon-btn icon-btn-danger" onclick="deleteAllSessionTasks('${session.id}')" title="${i18next.t('tooltip.deleteAllTasks')}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
    </button>
  `;

  // Build meta text with project path, branch, and description
  const projectName = session.project ? session.project.split('/').pop() : null;
  const metaParts = [i18next.t('task.taskCount', { count: state.currentTasks.length })];
  if (projectName) {
    metaParts.push(projectName);
  }
  if (session.gitBranch) {
    metaParts.push(session.gitBranch);
  }
  if (session.description) {
    metaParts.push(session.description);
  }
  metaParts.push(formatDate(session.modifiedAt));
  state.sessionMeta.textContent = metaParts.join(' · ');

  const completed = state.currentTasks.filter(t => t.status === 'completed').length;
  const percent = state.currentTasks.length > 0
    ? Math.round((completed / state.currentTasks.length) * 100)
    : 0;

  state.progressPercent.textContent = `${percent}%`;
  state.progressBar.style.width = `${percent}%`;

  renderKanban();
  renderSessions();
}

// --- Task detail panel ---

export function getAvailableTasksOptions(currentTaskId = null) {
  const pending = state.currentTasks.filter(t => t.status === 'pending' && t.id !== currentTaskId);
  const inProgress = state.currentTasks.filter(t => t.status === 'in_progress' && t.id !== currentTaskId);
  const completed = state.currentTasks.filter(t => t.status === 'completed' && t.id !== currentTaskId);

  let options = '';

  if (pending.length > 0) {
    options += `<optgroup label="${i18next.t('kanban.pending')}">`;
    pending.forEach(t => {
      options += `<option value="${t.id}">#${t.id} - ${escapeHtml(t.subject)}</option>`;
    });
    options += '</optgroup>';
  }

  if (inProgress.length > 0) {
    options += `<optgroup label="${i18next.t('kanban.inProgress')}">`;
    inProgress.forEach(t => {
      options += `<option value="${t.id}">#${t.id} - ${escapeHtml(t.subject)}</option>`;
    });
    options += '</optgroup>';
  }

  if (completed.length > 0) {
    options += `<optgroup label="${i18next.t('kanban.completed')}">`;
    completed.forEach(t => {
      options += `<option value="${t.id}">#${t.id} - ${escapeHtml(t.subject)}</option>`;
    });
    options += '</optgroup>';
  }

  return options;
}

export async function showTaskDetail(taskId, sessionId = null) {
  let task = state.currentTasks.find(t => t.id === taskId && (!sessionId || t.sessionId === sessionId));

  // If task not found in currentTasks, fetch it from the session
  if (!task && sessionId && sessionId !== 'undefined') {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      const tasks = await res.json();
      task = tasks.find(t => t.id === taskId);
      if (!task) return;
    } catch (error) {
      console.error('Failed to fetch task:', error);
      return;
    }
  }

  if (!task) return;

  state.detailPanel.classList.add('visible');

  const isBlocked = isTaskActuallyBlocked(task);
  const actualSessionId = task.sessionId || sessionId || state.currentSessionId;

  state.detailContent.innerHTML = `
    <div class="detail-section">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div style="flex: 1;">
          <div class="detail-label">${i18next.t('detail.taskId', { id: task.id })}</div>
          <h2 class="detail-title">${escapeHtml(task.subject)}</h2>
        </div>
        <div style="display: flex; gap: 8px;">
          <button id="delete-task-btn" class="icon-btn" title="${i18next.t('tooltip.deleteTask')}" style="color: #ef4444; border-color: #ef4444;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-label">${i18next.t('detail.status')}</div>
      <div style="font-size: 14px; color: var(--text-primary); padding: 8px 12px; background: var(--bg-secondary); border-radius: 6px; display: inline-block;">
        ${task.status === 'pending' ? i18next.t('detail.statusPending') : task.status === 'in_progress' ? i18next.t('detail.statusInProgress') : i18next.t('detail.statusCompleted')}
      </div>
      ${isBlocked && task.status !== 'in_progress' ? `<div style="font-size: 10px; color: var(--warning); margin-top: 4px;">${i18next.t('detail.blockedByDeps')}</div>` : ''}
      <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">${i18next.t('detail.statusControlled')}</div>
    </div>

    ${task.activeForm && task.status === 'in_progress' ? `
      <div class="detail-section">
        <div class="detail-box active">
          <strong>${i18next.t('detail.currently')}</strong> ${escapeHtml(task.activeForm)}
        </div>
      </div>
    ` : ''}

    <div class="detail-section">
      <div class="detail-label">${i18next.t('detail.blockedBy')}</div>
      <div class="detail-desc">
        ${task.blockedBy && task.blockedBy.length > 0
          ? `<div class="detail-box blocked"><strong>${i18next.t('detail.blockedByLabel')}</strong> ${task.blockedBy.map(id => '#' + id).join(', ')}</div>`
          : `<em style="color: var(--text-muted); font-size: 13px;">${i18next.t('detail.noDependencies')}</em>`}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-label">${i18next.t('detail.blocks')}</div>
      <div class="detail-desc">
        ${task.blocks && task.blocks.length > 0
          ? `<div class="detail-box blocks"><strong>${i18next.t('detail.blocksLabel')}</strong> ${task.blocks.map(id => '#' + id).join(', ')}</div>`
          : `<em style="color: var(--text-muted); font-size: 13px;">${i18next.t('detail.noTasksBlocked')}</em>`}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-label">${i18next.t('detail.description')}</div>
      <div class="detail-desc">${task.description ? DOMPurify.sanitize(marked.parse(task.description)) : `<em style="color: var(--text-muted);">${i18next.t('detail.noDescription')}</em>`}</div>
    </div>

    <div class="detail-section note-section">
      <div class="detail-label">${i18next.t('detail.addNote')}</div>
      <form class="note-form" onsubmit="addNote(event, '${task.id}', '${actualSessionId}')">
        <textarea id="note-input" class="note-input" placeholder="${i18next.t('detail.notePlaceholder')}" rows="3"></textarea>
        <button type="submit" class="note-submit">${i18next.t('detail.addNote')}</button>
      </form>
    </div>
  `;

  // Setup button handlers — references window.deleteTask to avoid import cycle
  document.getElementById('delete-task-btn').onclick = () => window.deleteTask(task.id, actualSessionId);
}

// --- Timeline ---

export function formatTimelineLabel(timestamp, totalSpan) {
  const date = new Date(timestamp);
  const hours = totalSpan / 3600000;

  if (hours < 1) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } else if (hours < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

export function renderTimeline() {
  const tasks = [...state.currentTasks].filter(t => t.createdAt);
  if (tasks.length === 0) {
    document.getElementById('timeline-rows').innerHTML =
      `<div style="padding: 32px; text-align: center; color: var(--text-muted);">${i18next.t('session.noTimestampData')}</div>`;
    document.getElementById('timeline-axis').innerHTML = '';
    return;
  }

  // Sort by creation time
  tasks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const minTime = new Date(tasks[0].createdAt).getTime();
  const maxTime = Math.max(
    ...tasks.map(t => new Date(t.updatedAt || t.createdAt).getTime()),
    Date.now()
  );
  const span = maxTime - minTime || 1;

  // Generate axis labels using percentage-based positioning
  const axisEl = document.getElementById('timeline-axis');
  const labelCount = 6;
  axisEl.innerHTML = '';
  for (let i = 0; i <= labelCount; i++) {
    const t = minTime + (span * i / labelCount);
    const pct = (i / labelCount) * 100;
    const label = document.createElement('span');
    label.className = 'timeline-axis-label';
    label.style.left = `calc(160px + (100% - 172px) * ${pct} / 100)`;
    label.textContent = formatTimelineLabel(t, span);
    axisEl.appendChild(label);
  }

  // Render rows
  const rowsEl = document.getElementById('timeline-rows');
  rowsEl.innerHTML = tasks.map(task => {
    const start = new Date(task.createdAt).getTime();
    const end = new Date(task.updatedAt || task.createdAt).getTime();
    const leftPct = ((start - minTime) / span) * 100;
    const widthPct = Math.max(((end - start) / span) * 100, 0.5);
    const statusClass = task.status === 'in_progress' ? 'in_progress' : task.status;
    const actualSessionId = task.sessionId || state.currentSessionId;
    const safeSubject = escapeHtml(task.subject).replace(/'/g, '&#39;');

    return `
      <div class="timeline-row"
           onclick="showTaskDetail('${task.id}', '${actualSessionId}')"
           data-subject="${safeSubject}"
           data-created="${task.createdAt}"
           data-updated="${task.updatedAt || task.createdAt}"
           onmouseenter="showTimelineTooltip(event, this.dataset.subject, this.dataset.created, this.dataset.updated)"
           onmouseleave="hideTimelineTooltip()">
        <div class="timeline-row-label" title="${safeSubject}">#${task.id} ${escapeHtml(task.subject)}</div>
        <div class="timeline-row-track">
          <div class="timeline-bar ${statusClass}" style="left: ${leftPct}%; width: ${widthPct}%;"></div>
        </div>
      </div>
    `;
  }).join('');
}

export function showTimelineTooltip(event, title, createdAt, updatedAt) {
  const tooltip = document.getElementById('timeline-tooltip');
  document.getElementById('tooltip-title').textContent = title;

  const created = new Date(createdAt);
  const updated = new Date(updatedAt);
  const durationMs = updated - created;
  let durationStr;
  if (durationMs < 60000) durationStr = Math.round(durationMs / 1000) + 's';
  else if (durationMs < 3600000) durationStr = Math.round(durationMs / 60000) + 'm';
  else durationStr = (durationMs / 3600000).toFixed(1) + 'h';

  document.getElementById('tooltip-time').textContent =
    `${created.toLocaleString()} → ${updated.toLocaleString()} (${durationStr})`;

  tooltip.style.left = (event.clientX + 12) + 'px';
  tooltip.style.top = (event.clientY - 10) + 'px';
  tooltip.classList.add('visible');
}

export function hideTimelineTooltip() {
  document.getElementById('timeline-tooltip').classList.remove('visible');
}
