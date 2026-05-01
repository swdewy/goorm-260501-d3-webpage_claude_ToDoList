// app.js — Main logic (LocalStorage CRUD + View routing)

// ==============================================
// CONSTANTS
// ==============================================

const STORAGE_KEYS = {
  tasks:    'd3todo_tasks',
  settings: 'd3todo_settings',
  version:  'd3todo_version'
};

const CATEGORY_LABELS = {
  career:  '커리어',
  dev:     '자기계발',
  home:    '집안일',
  finance: '재무',
  custom1: '커스텀1',
  custom2: '커스텀2'
};

// ==============================================
// DATA LAYER — LocalStorage CRUD
// ==============================================

function getTasks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.tasks) || '[]'); }
  catch { return []; }
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
}

function addTask(text, category = null) {
  const tasks = getTasks();
  const task = {
    id:          crypto.randomUUID(),
    text:        text.trim(),
    status:      'todo',
    category:    category || null,
    createdAt:   new Date().toISOString(),
    completedAt: null,
    order:       tasks.length
  };
  tasks.push(task);
  saveTasks(tasks);
  return task;
}

function updateTaskStatus(id, status) {
  const tasks = getTasks();
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.status      = status;
  task.completedAt = status === 'done' ? new Date().toISOString() : null;
  saveTasks(tasks);
}

function updateTaskText(id, text) {
  const tasks = getTasks();
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.text = text.trim();
  saveTasks(tasks);
}

function deleteTask(id) {
  saveTasks(getTasks().filter(t => t.id !== id));
}

function getTodayTasks() {
  const todayStr = new Date().toISOString().split('T')[0];
  return getTasks().filter(t => t.createdAt.startsWith(todayStr));
}

function getTasksByCategory(category) {
  return getTasks().filter(t => t.category === category);
}

function getSettings() {
  try {
    const defaults = { theme: 'system', defaultView: 'today', customCategories: [] };
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}') };
  } catch {
    return { theme: 'system', defaultView: 'today', customCategories: [] };
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

// ==============================================
// THEME
// ==============================================

function applyTheme(theme) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  syncThemeButtons(theme);
}

function syncThemeButtons(theme) {
  document.querySelectorAll('.theme-opt').forEach(btn => {
    const active = btn.dataset.themeVal === theme;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function getEffectiveTheme() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t) return t;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// ==============================================
// STATE
// ==============================================

let currentView     = 'today'; // 'today' | 'all' | 'insight' | 'settings'
let currentCategory = 'all';   // 'all' | 'career' | 'dev' | 'home' | 'finance'

// ==============================================
// HEADER DATE
// ==============================================

function renderHeaderDate() {
  const now  = new Date();
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const m    = now.getMonth() + 1;
  const d    = now.getDate();
  const day  = days[now.getDay()];
  document.getElementById('header-date').textContent = `${m}월 ${d}일 ${day}`;
}

// ==============================================
// VIEW SWITCHING
// ==============================================

function switchView(view) {
  currentView = view;

  // Toggle view sections
  document.getElementById('view-tasks').classList.toggle('active',    view === 'today' || view === 'all');
  document.getElementById('view-insight').classList.toggle('active',  view === 'insight');
  document.getElementById('view-settings').classList.toggle('active', view === 'settings');

  // Bottom nav active state
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const active = btn.dataset.view === view;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  // FAB: hide on insight / settings
  document.getElementById('fab').classList.toggle('is-hidden', view === 'insight' || view === 'settings');

  // Render content for the view
  if (view === 'today' || view === 'all') {
    render();
  } else if (view === 'insight') {
    renderStats();
    // Slight delay so the container has layout before D3 reads clientWidth
    setTimeout(() => { if (typeof updateCharts === 'function') updateCharts(getTasks()); }, 60);
  } else if (view === 'settings') {
    const settings = getSettings();
    syncThemeButtons(settings.theme);
  }
}

// ==============================================
// INSIGHT STATS
// ==============================================

function renderStats() {
  const tasks        = getTasks();
  const todayStr     = new Date().toISOString().split('T')[0];
  const todayDone    = tasks.filter(t => t.status === 'done' && t.completedAt && t.completedAt.startsWith(todayStr));
  const inprog       = tasks.filter(t => t.status === 'inprogress');

  document.getElementById('stat-total').textContent      = tasks.length;
  document.getElementById('stat-today-done').textContent = todayDone.length;
  document.getElementById('stat-inprog').textContent     = inprog.length;
}

// ==============================================
// TASK RENDERING
// ==============================================

function getCategoryLabel(category) {
  if (!category) return null;
  const custom = getSettings().customCategories.find(c => c.id === category);
  return custom ? custom.name : (CATEGORY_LABELS[category] || category);
}

function formatDate(isoStr) {
  const date      = new Date(isoStr);
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString())     return '오늘';
  if (date.toDateString() === yesterday.toDateString()) return '어제';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function createTaskElement(task) {
  const li = document.createElement('li');
  li.setAttribute('role', 'listitem');
  li.className = `task-item${task.status === 'done' ? ' task-item--done' : ''}`;
  li.dataset.id = task.id;

  // Double-click inline edit (기술명세서 3.1.1)
  li.addEventListener('dblclick', e => {
    if (e.target.closest('.status-btn, .action-btn')) return;
    const titleEl = li.querySelector('.task-title');
    if (titleEl) startEdit(task.id, li, titleEl);
  });

  // Status button
  const statusBtn = document.createElement('button');
  statusBtn.className = `status-btn status-btn--${task.status}`;
  statusBtn.setAttribute('aria-label', '상태 변경');
  statusBtn.addEventListener('click', () => cycleStatus(task.id, task.status));

  // Content
  const content = document.createElement('div');
  content.className = 'task-content';

  // L2 Card Title
  const titleEl = document.createElement('p');
  titleEl.className = 'task-title';
  titleEl.textContent = task.text;

  // Meta row
  const meta = document.createElement('div');
  meta.className = 'task-meta';

  // In-progress badge (warn colors, 기술명세서 3.1.2)
  if (task.status === 'inprogress') {
    const badge = document.createElement('span');
    badge.className = 'badge-progress';
    badge.textContent = '진행중';
    meta.appendChild(badge);
  }

  // Category badge
  if (task.category) {
    const catBadge = document.createElement('span');
    catBadge.className = `cat-badge cat-badge--${task.category}`;
    catBadge.textContent = getCategoryLabel(task.category);
    meta.appendChild(catBadge);
  }

  // L5 Muted date
  const dateEl = document.createElement('span');
  dateEl.className = 'task-date';
  dateEl.textContent = formatDate(task.createdAt);
  meta.appendChild(dateEl);

  content.appendChild(titleEl);
  content.appendChild(meta);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'action-btn action-btn--edit';
  editBtn.setAttribute('aria-label', '수정');
  editBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  editBtn.addEventListener('click', () => {
    const titleEl = li.querySelector('.task-title');
    startEdit(task.id, li, titleEl);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'action-btn action-btn--delete';
  deleteBtn.setAttribute('aria-label', '삭제');
  deleteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`;
  deleteBtn.addEventListener('click', () => removeTask(task.id, li));

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  li.appendChild(statusBtn);
  li.appendChild(content);
  li.appendChild(actions);
  return li;
}

function getFilteredTasks() {
  let tasks = currentView === 'today' ? getTodayTasks() : getTasks();
  if (currentCategory !== 'all') {
    tasks = tasks.filter(t => t.category === currentCategory);
  }
  return tasks;
}

function render() {
  const tasks  = getFilteredTasks();
  const todo   = tasks.filter(t => t.status === 'todo');
  const inprog = tasks.filter(t => t.status === 'inprogress');
  const done   = tasks.filter(t => t.status === 'done');

  document.getElementById('count-todo').textContent       = todo.length;
  document.getElementById('count-inprogress').textContent = inprog.length;
  document.getElementById('count-done').textContent       = done.length;

  renderList('list-todo',       todo);
  renderList('list-inprogress', inprog);
  renderList('list-done',       done);

  document.getElementById('empty-state').hidden = tasks.length > 0;
}

function renderList(id, tasks) {
  const ul = document.getElementById(id);
  ul.innerHTML = '';
  tasks.forEach(task => ul.appendChild(createTaskElement(task)));
}

// ==============================================
// EVENT HANDLERS
// ==============================================

function cycleStatus(id, current) {
  const next = { todo: 'inprogress', inprogress: 'done', done: 'todo' };
  updateTaskStatus(id, next[current]);
  render();
}

function startEdit(id, li, titleEl) {
  if (!titleEl || li.querySelector('.task-edit-input')) return;
  const task = getTasks().find(t => t.id === id);
  if (!task) return;

  const input = document.createElement('input');
  input.type      = 'text';
  input.className = 'task-edit-input';
  input.value     = task.text;

  titleEl.replaceWith(input);
  input.focus();
  input.select();

  let committed = false;
  function commit() {
    if (committed) return;
    committed = true;
    const newText = input.value.trim();
    if (newText && newText !== task.text) updateTaskText(id, newText);
    render();
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { committed = true; render(); }
  });
}

function removeTask(id, li) {
  li.style.opacity    = '0';
  li.style.transform  = 'translateX(16px)';
  li.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
  setTimeout(() => { deleteTask(id); render(); }, 180);
}

function focusInput() {
  const input = document.getElementById('task-input');
  input.focus();
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ==============================================
// INIT
// ==============================================

function init() {
  const settings = getSettings();
  applyTheme(settings.theme);

  if (!localStorage.getItem(STORAGE_KEYS.version)) {
    localStorage.setItem(STORAGE_KEYS.version, '1.0');
  }

  renderHeaderDate();

  // Header theme toggle
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const isDark = getEffectiveTheme() === 'dark';
    const next   = isDark ? 'light' : 'dark';
    const s      = getSettings();
    s.theme = next;
    saveSettings(s);
    applyTheme(next);
    // Redraw charts if visible (theme colors change)
    if (currentView === 'insight' && typeof updateCharts === 'function') {
      setTimeout(() => updateCharts(getTasks()), 60);
    }
  });

  // Bottom nav
  document.querySelector('.bottom-nav').addEventListener('click', e => {
    const btn = e.target.closest('.nav-btn');
    if (btn) switchView(btn.dataset.view);
  });

  // FAB → focus input (switch to today view if needed)
  document.getElementById('fab').addEventListener('click', () => {
    if (currentView !== 'today' && currentView !== 'all') switchView('today');
    setTimeout(focusInput, 60);
  });

  // Empty state CTA
  document.getElementById('empty-cta').addEventListener('click', focusInput);

  // Category tabs
  document.getElementById('category-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    currentCategory = btn.dataset.category;
    render();
  });

  // Task form
  document.getElementById('task-form').addEventListener('submit', e => {
    e.preventDefault();
    const input  = document.getElementById('task-input');
    const select = document.getElementById('category-select');
    const text   = input.value.trim();
    if (!text) return;
    addTask(text, select.value || null);
    input.value = '';
    render();
    input.focus();
  });

  // Settings: theme option buttons
  document.querySelectorAll('.theme-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.themeVal;
      const s     = getSettings();
      s.theme = theme;
      saveSettings(s);
      applyTheme(theme);
      if (currentView === 'insight' && typeof updateCharts === 'function') {
        setTimeout(() => updateCharts(getTasks()), 60);
      }
    });
  });

  // Settings: clear all tasks
  document.getElementById('clear-all-btn').addEventListener('click', () => {
    if (confirm('모든 할일을 삭제할까요? 이 작업은 되돌릴 수 없어요.')) {
      saveTasks([]);
      render();
    }
  });

  // Auto-focus input on load
  document.getElementById('task-input').focus();

  render();
}

document.addEventListener('DOMContentLoaded', init);
