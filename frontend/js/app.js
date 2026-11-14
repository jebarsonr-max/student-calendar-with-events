/**
 * ============================================================================
 * Student Calendar with Events - Main Application Controller
 * ============================================================================
 * Coordinates routing, UI state, modals, reminders, and Viva C inspector.
 * ============================================================================
 */

const App = {
    currentView: 'home',
    activeEvents: [],
    editingEventId: null,
    deleteTargetId: null,
    notificationsEnabled: false,
    conflictDetected: false,
    cExecutionLogs: [],

    async init() {
        this.initTheme();
        this.bindNavigation();
        this.bindModals();
        this.bindSearchAndFilters();
        this.bindAddEventForm();
        this.bindConflictDetectionListener();
        this.bindVivaControls();
        this.initNotifications();

        CalendarView.init();

        // Check hash routing or default to home
        const initialHash = window.location.hash.replace('#', '') || 'home';
        this.navigate(initialHash);

        // Load initial data from C core
        await this.refreshAllData();

        // Start reminder worker
        setInterval(() => this.checkReminders(), 30000);
    },

    /**
     * Theme management (Dark / Light)
     */
    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        const toggleBtn = document.getElementById('themeToggleBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const cur = document.documentElement.getAttribute('data-theme');
                const next = cur === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', next);
                localStorage.setItem('theme', next);
                this.showToast(`Switched to ${next} theme`, 'info');
            });
        }
    },

    /**
     * Routing and View Switcher
     */
    bindNavigation() {
        document.querySelectorAll('[data-nav]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const target = el.dataset.nav;
                this.navigate(target);
            });
        });

        // Mobile drawer toggle
        const mobileToggle = document.getElementById('mobileMenuToggle');
        const sidebar = document.querySelector('.sidebar');
        if (mobileToggle && sidebar) {
            mobileToggle.addEventListener('click', () => {
                sidebar.classList.toggle('mobile-open');
            });
            // Close sidebar when clicking links on mobile
            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', () => sidebar.classList.remove('mobile-open'));
            });
        }
    },

    navigate(viewName) {
        this.currentView = viewName;
        window.location.hash = viewName;

        // Update active page view
        document.querySelectorAll('.page-view').forEach(view => {
            view.classList.remove('active');
        });
        const targetView = document.getElementById(`view-${viewName}`);
        if (targetView) {
            targetView.classList.add('active');
        }

        // Update active sidebar nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.dataset.nav === viewName) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Specific view activations
        if (viewName === 'calendar') {
            CalendarView.render();
        } else if (viewName === 'dashboard') {
            this.renderDashboard();
        } else if (viewName === 'upcoming') {
            this.renderUpcomingView();
        } else if (viewName === 'search') {
            this.executeSearch();
        } else if (viewName === 'settings') {
            this.renderVivaInspector();
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * Refresh data across the application from the C core
     */
    async refreshAllData() {
        const events = await EventsAPI.getAllEvents();
        this.activeEvents = events;
        CalendarView.setEvents(events);

        await this.updateDashboardStats();
        this.updateHeaderDate();

        if (this.currentView === 'dashboard') this.renderDashboard();
        if (this.currentView === 'upcoming') this.renderUpcomingView();
        if (this.currentView === 'calendar') CalendarView.render();
    },

    updateHeaderDate() {
        const headerDate = document.getElementById('headerDateDisplay');
        if (headerDate) {
            const now = new Date();
            const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
            headerDate.textContent = now.toLocaleDateString('en-US', options);
        }
    },

    /**
     * Dashboard View Rendering & Weekly Chart
     */
    async updateDashboardStats() {
        const stats = await EventsAPI.getStats();
        if (!stats) return;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val !== undefined ? val : 0;
        };

        setVal('statTotalEvents', stats.totalEvents);
        setVal('statTodayEvents', stats.todayEvents);
        setVal('statUpcomingEvents', stats.upcomingEvents);
        setVal('statExams', stats.examCount);
        setVal('statAssignments', stats.assignmentCount);

        // Render weekly distribution bars
        const maxVal = Math.max(...(stats.weekdayDistribution || [1]), 1);
        const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        stats.weekdayDistribution.forEach((cnt, idx) => {
            const barFill = document.getElementById(`barFill_${dayKeys[idx]}`);
            const barCount = document.getElementById(`barCount_${dayKeys[idx]}`);
            if (barFill) {
                const percent = Math.max((cnt / maxVal) * 100, 8);
                barFill.style.height = `${percent}%`;
            }
            if (barCount) {
                barCount.textContent = cnt;
            }
        });
    },

    renderDashboard() {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayEvents = this.activeEvents.filter(e => e.date === todayStr);
        const upcomingDeadlines = this.activeEvents.filter(e => {
            return (e.category === 'Exam' || e.category === 'Assignment' || e.priority === 'High') && e.date >= todayStr;
        }).slice(0, 5);

        // Render Today's List
        const todayContainer = document.getElementById('dashboardTodayList');
        if (todayContainer) {
            if (todayEvents.length === 0) {
                todayContainer.innerHTML = `
                    <div class="zero-state" style="padding: 1.5rem 0.5rem;">
                        <div style="font-size: 1.75rem;">📅</div>
                        <p style="font-size: 0.85rem; color: var(--text-muted);">No events scheduled for today.</p>
                        <button class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.35rem 0.75rem; margin-top: 0.5rem;" onclick="App.openAddModal('${todayStr}')">Schedule Now</button>
                    </div>
                `;
            } else {
                todayContainer.innerHTML = todayEvents.map(e => `
                    <div class="event-mini-item" onclick="App.openEventDetails(${e.id})">
                        <div class="event-mini-left">
                            <span class="category-dot" style="background: var(--cat-${e.category.toLowerCase().replace(' ', '') || 'other'});"></span>
                            <div>
                                <div class="event-mini-title">${this.escapeHtml(e.title)}</div>
                                <div class="event-mini-meta">
                                    <span>${e.startTime} - ${e.endTime}</span> • <span>${this.escapeHtml(e.venue)}</span>
                                </div>
                            </div>
                        </div>
                        <span class="badge ${CalendarView.getCategoryClass(e.category)}">${e.category}</span>
                    </div>
                `).join('');
            }
        }

        // Render Imminent Deadlines
        const deadlineContainer = document.getElementById('dashboardDeadlinesList');
        if (deadlineContainer) {
            if (upcomingDeadlines.length === 0) {
                deadlineContainer.innerHTML = `
                    <div class="zero-state" style="padding: 1.5rem 0.5rem;">
                        <div style="font-size: 1.75rem;">🎉</div>
                        <p style="font-size: 0.85rem; color: var(--text-muted);">No urgent exam or assignment deadlines.</p>
                    </div>
                `;
            } else {
                deadlineContainer.innerHTML = upcomingDeadlines.map(e => `
                    <div class="event-mini-item" onclick="App.openEventDetails(${e.id})">
                        <div class="event-mini-left">
                            <span class="category-dot" style="background: var(--pri-${e.priority.toLowerCase()});"></span>
                            <div>
                                <div class="event-mini-title">${this.escapeHtml(e.title)}</div>
                                <div class="event-mini-meta">
                                    <span>📅 ${e.date}</span> • <span>${e.startTime}</span>
                                </div>
                            </div>
                        </div>
                        <span class="badge" style="background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--pri-${e.priority.toLowerCase()}); font-weight: 700;">
                            ${e.priority}
                        </span>
                    </div>
                `).join('');
            }
        }
    },

    /**
     * Upcoming Events View (Grouped: Today, Tomorrow, This Week, Later)
     */
    async renderUpcomingView() {
        const container = document.getElementById('upcomingTimelineContainer');
        if (!container) return;

        const categoryFilter = document.querySelector('.filter-pill.active[data-cat-filter]')?.dataset.catFilter || 'All';
        const priorityFilter = document.getElementById('upcomingPriorityFilter')?.value || 'All';

        let events = await EventsAPI.getUpcomingEvents();

        // Apply filters
        if (categoryFilter !== 'All') {
            events = events.filter(e => e.category.toLowerCase() === categoryFilter.toLowerCase());
        }
        if (priorityFilter !== 'All') {
            events = events.filter(e => e.priority.toLowerCase() === priorityFilter.toLowerCase());
        }

        if (events.length === 0) {
            container.innerHTML = `
                <div class="zero-state" style="padding: 4rem 1rem;">
                    <div class="zero-icon">🔍</div>
                    <h3>No upcoming events match your filter</h3>
                    <p>Try selecting a different category or add a new event.</p>
                </div>
            `;
            return;
        }

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const weekEnd = new Date();
        weekEnd.setDate(today.getDate() + 7);
        const weekEndStr = weekEnd.toISOString().split('T')[0];

        const groups = {
            today: { title: "TODAY", events: [] },
            tomorrow: { title: "TOMORROW", events: [] },
            thisWeek: { title: "THIS WEEK", events: [] },
            later: { title: "LATER", events: [] }
        };

        events.forEach(e => {
            if (e.date === todayStr) {
                groups.today.events.push(e);
            } else if (e.date === tomorrowStr) {
                groups.tomorrow.events.push(e);
            } else if (e.date > tomorrowStr && e.date <= weekEndStr) {
                groups.thisWeek.events.push(e);
            } else {
                groups.later.events.push(e);
            }
        });

        let html = '';
        Object.values(groups).forEach(grp => {
            if (grp.events.length === 0) return;

            html += `
                <div class="timeline-group">
                    <div class="timeline-heading">${grp.title} (${grp.events.length})</div>
                    <div class="event-cards-grid">
            `;

            grp.events.forEach(e => {
                const catClass = CalendarView.getCategoryClass(e.category);
                html += `
                    <div class="event-card">
                        <div class="event-card-header">
                            <div>
                                <span class="badge ${catClass}">${e.category}</span>
                                <h4 class="event-card-title" style="margin-top: 6px;">${this.escapeHtml(e.title)}</h4>
                            </div>
                            <span class="badge" style="background: var(--bg-app); border: 1px solid var(--border-color); color: var(--pri-${e.priority.toLowerCase()}); font-weight: 700;">
                                ${e.priority}
                            </span>
                        </div>
                        <p class="event-card-desc">${this.escapeHtml(e.description)}</p>
                        <div class="event-card-meta">
                            <div class="meta-row">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                <span>${e.date}</span>
                            </div>
                            <div class="meta-row">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                <span>${e.startTime} - ${e.endTime}</span>
                            </div>
                            <div class="meta-row">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                <span>${this.escapeHtml(e.venue)}</span>
                            </div>
                            ${e.reminder && e.reminder !== 'None' ? `
                            <div class="meta-row" style="color: var(--primary);">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                                <span>Reminder: ${e.reminder}</span>
                            </div>` : ''}
                        </div>
                        <div class="event-card-actions">
                            <button class="btn btn-secondary" style="font-size: 0.775rem; padding: 0.35rem 0.75rem;" onclick="App.openEditModal(${e.id})">Edit</button>
                            <button class="btn btn-secondary" style="font-size: 0.775rem; padding: 0.35rem 0.75rem; color: #ef4444;" onclick="App.openDeleteConfirm(${e.id})">Delete</button>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    /**
     * Search and Filter View
     */
    bindSearchAndFilters() {
        const searchInput = document.getElementById('searchKeywordInput');
        const catSelect = document.getElementById('searchCategorySelect');
        const priSelect = document.getElementById('searchPrioritySelect');
        const dateInput = document.getElementById('searchDateInput');
        const resetBtn = document.getElementById('searchResetBtn');

        let debounceTimer;
        const triggerSearch = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => this.executeSearch(), 200);
        };

        if (searchInput) searchInput.addEventListener('input', triggerSearch);
        if (catSelect) catSelect.addEventListener('change', triggerSearch);
        if (priSelect) priSelect.addEventListener('change', triggerSearch);
        if (dateInput) dateInput.addEventListener('change', triggerSearch);

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                if (catSelect) catSelect.value = 'All';
                if (priSelect) priSelect.value = 'All';
                if (dateInput) dateInput.value = '';
                this.executeSearch();
            });
        }

        // Category filter pills in Upcoming View
        document.querySelectorAll('.filter-pill[data-cat-filter]').forEach(pill => {
            pill.addEventListener('click', () => {
                document.querySelectorAll('.filter-pill[data-cat-filter]').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.renderUpcomingView();
            });
        });

        const upPri = document.getElementById('upcomingPriorityFilter');
        if (upPri) upPri.addEventListener('change', () => this.renderUpcomingView());
    },

    async executeSearch() {
        const container = document.getElementById('searchResultsContainer');
        const countLabel = document.getElementById('searchResultCount');
        if (!container) return;

        const q = document.getElementById('searchKeywordInput')?.value || '';
        const cat = document.getElementById('searchCategorySelect')?.value || '';
        const pri = document.getElementById('searchPrioritySelect')?.value || '';
        const dt = document.getElementById('searchDateInput')?.value || '';

        const results = await EventsAPI.searchEvents(q, cat, pri, dt);

        if (countLabel) {
            countLabel.textContent = `${results.length} event(s) found`;
        }

        if (results.length === 0) {
            container.innerHTML = `
                <div class="zero-state" style="padding: 4rem 1rem;">
                    <div class="zero-icon">🔍</div>
                    <h3>No matching events found</h3>
                    <p>Try adjusting your search keywords or clearing filters.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="event-cards-grid">
                ${results.map(e => {
                    const catClass = CalendarView.getCategoryClass(e.category);
                    return `
                        <div class="event-card">
                            <div class="event-card-header">
                                <div>
                                    <span class="badge ${catClass}">${e.category}</span>
                                    <h4 class="event-card-title" style="margin-top: 6px;">${this.escapeHtml(e.title)}</h4>
                                </div>
                                <span class="badge" style="background: var(--bg-app); border: 1px solid var(--border-color); color: var(--pri-${e.priority.toLowerCase()}); font-weight: 700;">
                                    ${e.priority}
                                </span>
                            </div>
                            <p class="event-card-desc">${this.escapeHtml(e.description)}</p>
                            <div class="event-card-meta">
                                <div class="meta-row">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                    <span>${e.date}</span>
                                </div>
                                <div class="meta-row">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    <span>${e.startTime} - ${e.endTime}</span>
                                </div>
                                <div class="meta-row">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                    <span>${this.escapeHtml(e.venue)}</span>
                                </div>
                            </div>
                            <div class="event-card-actions">
                                <button class="btn btn-secondary" style="font-size: 0.775rem; padding: 0.35rem 0.75rem;" onclick="App.openEditModal(${e.id})">Edit</button>
                                <button class="btn btn-secondary" style="font-size: 0.775rem; padding: 0.35rem 0.75rem; color: #ef4444;" onclick="App.openDeleteConfirm(${e.id})">Delete</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * Real-time Conflict Detection on Add/Edit Form
     */
    bindConflictDetectionListener() {
        const dateInput = document.getElementById('eventDate');
        const startInput = document.getElementById('eventStartTime');
        const endInput = document.getElementById('eventEndTime');
        const conflictBox = document.getElementById('eventConflictAlert');

        const checkFormConflict = async () => {
            const date = dateInput?.value;
            const start = startInput?.value;
            const end = endInput?.value;

            if (date && start && end && start < end) {
                const res = await EventsAPI.checkConflict(date, start, end, this.editingEventId || 0);
                if (res.conflict && res.conflictingEvent) {
                    this.conflictDetected = true;
                    if (conflictBox) {
                        conflictBox.classList.add('active');
                        conflictBox.innerHTML = `
                            <div class="conflict-title">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                Schedule Conflict Detected
                            </div>
                            <div>Overlaps with: <strong>${this.escapeHtml(res.conflictingEvent.title)}</strong> (${res.conflictingEvent.startTime} to ${res.conflictingEvent.endTime}) on this date.</div>
                        `;
                    }
                } else {
                    this.conflictDetected = false;
                    if (conflictBox) conflictBox.classList.remove('active');
                }
            } else {
                this.conflictDetected = false;
                if (conflictBox) conflictBox.classList.remove('active');
            }
        };

        if (dateInput) dateInput.addEventListener('change', checkFormConflict);
        if (startInput) startInput.addEventListener('change', checkFormConflict);
        if (endInput) endInput.addEventListener('change', checkFormConflict);
    },

    /**
     * Modal Operations
     */
    bindModals() {
        // Close modals on clicking overlay or close button
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal || e.target.closest('.modal-close-btn') || e.target.closest('.modal-cancel-btn')) {
                    modal.classList.remove('active');
                }
            });
        });

        // Quick add event button
        const quickAddBtn = document.getElementById('quickAddEventBtn');
        if (quickAddBtn) quickAddBtn.addEventListener('click', () => this.openAddModal());

        // Confirm Delete Button
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', async () => {
                if (this.deleteTargetId) {
                    const res = await EventsAPI.deleteEvent(this.deleteTargetId);
                    if (res.success) {
                        this.showToast('Event removed successfully', 'success');
                        this.closeModal('modalConfirmDelete');
                        this.closeModal('modalEventDetails');
                        await this.refreshAllData();
                    } else {
                        this.showToast('Failed to delete event', 'error');
                    }
                }
            });
        }
    },

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('active');
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    },

    openAddModal(prefilledDate = null, event = null) {
        if (event) event.stopPropagation();
        this.editingEventId = null;
        this.conflictDetected = false;

        const form = document.getElementById('addEventForm');
        if (form) form.reset();

        document.getElementById('modalEventFormTitle').textContent = 'Create New Event';
        document.getElementById('eventConflictAlert').classList.remove('active');

        const dateInput = document.getElementById('eventDate');
        if (dateInput) {
            dateInput.value = prefilledDate || new Date().toISOString().split('T')[0];
        }
        const startInput = document.getElementById('eventStartTime');
        const endInput = document.getElementById('eventEndTime');
        if (startInput) startInput.value = '10:00';
        if (endInput) endInput.value = '11:00';

        this.openModal('modalEventForm');
    },

    async openEditModal(eventId, event = null) {
        if (event) event.stopPropagation();
        this.closeModal('modalEventDetails');

        const e = await EventsAPI.getEventById(eventId);
        if (!e) {
            this.showToast('Event not found', 'error');
            return;
        }

        this.editingEventId = eventId;
        this.conflictDetected = false;

        document.getElementById('modalEventFormTitle').textContent = 'Edit Event';
        document.getElementById('eventTitle').value = e.title;
        document.getElementById('eventDescription').value = e.description || '';
        document.getElementById('eventDate').value = e.date;
        document.getElementById('eventStartTime').value = e.startTime;
        document.getElementById('eventEndTime').value = e.endTime;
        document.getElementById('eventVenue').value = e.venue || '';
        document.getElementById('eventCategory').value = e.category;
        document.getElementById('eventPriority').value = e.priority;
        document.getElementById('eventReminder').value = e.reminder || 'None';
        document.getElementById('eventConflictAlert').classList.remove('active');

        this.openModal('modalEventForm');
    },

    async openEventDetails(eventId, event = null) {
        if (event) event.stopPropagation();
        const e = await EventsAPI.getEventById(eventId);
        if (!e) {
            this.showToast('Event not found', 'error');
            return;
        }

        const catClass = CalendarView.getCategoryClass(e.category);
        document.getElementById('detailsCategory').className = `badge ${catClass}`;
        document.getElementById('detailsCategory').textContent = e.category;

        const priBadge = document.getElementById('detailsPriority');
        priBadge.textContent = `${e.priority} Priority`;
        priBadge.style.color = `var(--pri-${e.priority.toLowerCase()})`;

        document.getElementById('detailsTitle').textContent = e.title;
        document.getElementById('detailsDescription').textContent = e.description || 'No description provided.';
        document.getElementById('detailsDate').textContent = e.date;
        document.getElementById('detailsTime').textContent = `${e.startTime} - ${e.endTime}`;
        document.getElementById('detailsVenue').textContent = e.venue || 'Campus';
        document.getElementById('detailsReminder').textContent = e.reminder || 'None';

        // Action buttons
        const editBtn = document.getElementById('detailsEditBtn');
        const deleteBtn = document.getElementById('detailsDeleteBtn');

        if (editBtn) editBtn.onclick = () => this.openEditModal(e.id);
        if (deleteBtn) deleteBtn.onclick = () => this.openDeleteConfirm(e.id, e.title);

        this.openModal('modalEventDetails');
    },

    openDeleteConfirm(eventId, eventTitle = '') {
        this.deleteTargetId = eventId;
        const targetTitleEl = document.getElementById('deleteTargetTitle');
        if (targetTitleEl) {
            targetTitleEl.textContent = eventTitle ? `"${eventTitle}"` : 'this event';
        }
        this.openModal('modalConfirmDelete');
    },

    /**
     * Add/Edit Form Submission
     */
    bindAddEventForm() {
        const form = document.getElementById('addEventForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById('saveEventSubmitBtn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Saving...';
            }

            try {
                const title = document.getElementById('eventTitle')?.value.trim();
                const description = document.getElementById('eventDescription')?.value.trim();
                const date = document.getElementById('eventDate')?.value;
                const startTime = document.getElementById('eventStartTime')?.value;
                const endTime = document.getElementById('eventEndTime')?.value;
                const venue = document.getElementById('eventVenue')?.value.trim() || 'Campus';
                const category = document.getElementById('eventCategory')?.value;
                const priority = document.getElementById('eventPriority')?.value;
                const reminder = document.getElementById('eventReminder')?.value;

                // Validation
                if (!title) {
                    this.showToast('Please enter an event title', 'error');
                    return;
                }
                if (!date) {
                    this.showToast('Please select a valid date', 'error');
                    return;
                }
                if (!startTime || !endTime) {
                    this.showToast('Please specify start and end times', 'error');
                    return;
                }
                if (startTime >= endTime) {
                    this.showToast('End time must be later than start time', 'error');
                    return;
                }

                const payload = {
                    title,
                    description,
                    date,
                    startTime,
                    endTime,
                    venue,
                    category,
                    priority,
                    reminder
                };

                let res;
                if (this.editingEventId) {
                    res = await EventsAPI.updateEvent(this.editingEventId, payload, true);
                } else {
                    res = await EventsAPI.addEvent(payload, true);
                }

                if (res && (res.status === 200 || res.status === 201)) {
                    const modeNotice = res.isLocal ? ' (Saved locally)' : '';
                    this.showToast((this.editingEventId ? 'Event updated successfully' : 'Event scheduled successfully') + modeNotice, 'success');
                    this.closeModal('modalEventForm');
                    await this.refreshAllData();
                } else if (res && res.status === 409) {
                    this.showToast('Schedule conflict detected!', 'warning');
                } else {
                    this.showToast(res?.data?.error || 'Failed to save event', 'error');
                }
            } catch (err) {
                console.error('[App] Save event exception:', err);
                this.showToast('Failed to save event: ' + (err.message || 'Unknown error'), 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Save Event';
                }
            }
        });
    },

    /**
     * Notifications & Reminders Engine
     */
    initNotifications() {
        const notifBtn = document.getElementById('notificationToggleBtn');
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                this.notificationsEnabled = true;
            }
        }

        if (notifBtn) {
            notifBtn.addEventListener('click', async () => {
                if (!('Notification' in window)) {
                    this.showToast('Browser notifications not supported by this browser', 'warning');
                    return;
                }

                if (Notification.permission === 'granted') {
                    this.showToast('Browser notifications are already active', 'info');
                } else if (Notification.permission !== 'denied') {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        this.notificationsEnabled = true;
                        this.showToast('Notifications enabled for reminders!', 'success');
                    } else {
                        this.showToast('Notification permission was dismissed', 'warning');
                    }
                } else {
                    this.showToast('Notifications are blocked in browser settings', 'warning');
                }
            });
        }
    },

    checkReminders() {
        const now = new Date();
        const curDate = now.toISOString().split('T')[0];
        const curMinutes = now.getHours() * 60 + now.getMinutes();

        this.activeEvents.forEach(e => {
            if (e.date !== curDate || !e.reminder || e.reminder === 'None') return;

            const [sh, sm] = e.startTime.split(':').map(Number);
            const eventMinutes = sh * 60 + sm;
            const diff = eventMinutes - curMinutes;

            let shouldAlert = false;
            let reminderText = '';

            if (e.reminder.includes('10 min') && diff === 10) {
                shouldAlert = true;
                reminderText = `Reminder: "${e.title}" starts in 10 minutes at ${e.venue}.`;
            } else if (e.reminder.includes('30 min') && diff === 30) {
                shouldAlert = true;
                reminderText = `Reminder: "${e.title}" starts in 30 minutes at ${e.venue}.`;
            } else if (e.reminder.includes('1 hour') && diff === 60) {
                shouldAlert = true;
                reminderText = `Reminder: "${e.title}" starts in 1 hour at ${e.venue}.`;
            }

            if (shouldAlert) {
                this.showToast(reminderText, 'info');
                if (this.notificationsEnabled && Notification.permission === 'granted') {
                    new Notification('Student Calendar Alert', {
                        body: reminderText,
                        icon: '/favicon.ico'
                    });
                }
            }
        });
    },

    /**
     * Viva C-Core Live Architecture Inspector
     */
    logCExecution(meta) {
        if (!meta) return;
        this.cExecutionLogs.unshift({
            timestamp: new Date().toLocaleTimeString(),
            command: meta.command,
            executionMs: meta.executionMs
        });
        if (this.cExecutionLogs.length > 10) this.cExecutionLogs.pop();

        if (this.currentView === 'settings') {
            this.renderVivaInspector();
        }
    },

    bindVivaControls() {
        const seedBtn = document.getElementById('vivaSeedBtn');
        if (seedBtn) {
            seedBtn.addEventListener('click', async () => {
                const res = await EventsAPI.seedSampleData();
                if (res.success) {
                    this.showToast('Sample academic dataset restored into C binary storage', 'success');
                    await this.refreshAllData();
                } else {
                    this.showToast('Failed to seed sample data', 'error');
                }
            });
        }
    },

    async renderVivaInspector() {
        const cInfo = await EventsAPI.getCInfo();
        const infoBox = document.getElementById('vivaEngineDetails');
        const logsBox = document.getElementById('vivaExecutionLogs');

        if (infoBox && cInfo) {
            infoBox.innerHTML = `
                <div><strong>Engine:</strong> ${cInfo.engine}</div>
                <div><strong>Binary Executable:</strong> <code>${cInfo.binaryPath}</code></div>
                <div><strong>Binary Size:</strong> ${cInfo.binarySizeKB} KB</div>
                <div><strong>Persistence File:</strong> <code>data/events.dat</code> (Binary Struct Storage)</div>
                <div><strong>Core Algorithms:</strong> Chronological qsort, O(N) Conflict Detection, Case-insensitive Multi-field Substring Search</div>
            `;
        }

        if (logsBox) {
            if (this.cExecutionLogs.length === 0) {
                logsBox.innerHTML = `<div style="color: var(--text-dim);">No C engine executions recorded yet. Navigate the calendar or perform an action to inspect real-time C binary calls.</div>`;
            } else {
                logsBox.innerHTML = this.cExecutionLogs.map(log => `
                    <div style="padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.07);">
                        <span style="color: #94a3b8;">[${log.timestamp}]</span>
                        <span style="color: #38bdf8; font-weight: 600;">$ ${log.command}</span>
                        <span style="color: #34d399; margin-left: 8px;">(${log.executionMs}ms)</span>
                    </div>
                `).join('');
            }
        }
    },

    /**
     * Toast Notifications UI
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '⚠️';
        if (type === 'warning') icon = '🔔';

        toast.innerHTML = `<span>${icon}</span><span>${this.escapeHtml(message)}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};

window.App = App;

// Launch on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
