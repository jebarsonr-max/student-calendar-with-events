/**
 * ============================================================================
 * Student Calendar with Events - Calendar Rendering & View Engine
 * ============================================================================
 * Renders interactive Monthly, Weekly, and Daily calendar grids with
 * category-styled event pills and navigation.
 * ============================================================================
 */

const CalendarView = {
    currentDate: new Date(),
    viewMode: 'month', // 'month', 'week', 'day'
    events: [],

    monthNames: [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ],

    dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    dayNamesFull: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],

    init() {
        this.bindControls();
    },

    bindControls() {
        const prevBtn = document.getElementById('calPrevBtn');
        const nextBtn = document.getElementById('calNextBtn');
        const todayBtn = document.getElementById('calTodayBtn');

        if (prevBtn) prevBtn.addEventListener('click', () => this.navigate(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => this.navigate(1));
        if (todayBtn) todayBtn.addEventListener('click', () => {
            this.currentDate = new Date();
            this.render();
        });

        // View mode toggles
        document.querySelectorAll('.view-toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.viewMode = btn.dataset.view;
                this.render();
            });
        });
    },

    navigate(direction) {
        if (this.viewMode === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        } else if (this.viewMode === 'week') {
            this.currentDate.setDate(this.currentDate.getDate() + (direction * 7));
        } else if (this.viewMode === 'day') {
            this.currentDate.setDate(this.currentDate.getDate() + direction);
        }
        this.render();
    },

    setEvents(eventsList) {
        this.events = eventsList || [];
        this.render();
    },

    render() {
        const titleEl = document.getElementById('calendarMonthTitle');
        const gridEl = document.getElementById('calendarGridContainer');
        if (!gridEl) return;

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        if (titleEl) {
            if (this.viewMode === 'month') {
                titleEl.textContent = `${this.monthNames[month]} ${year}`;
            } else if (this.viewMode === 'week') {
                const weekStart = this.getStartOfWeek(new Date(this.currentDate));
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                titleEl.textContent = `${this.monthNames[weekStart.getMonth()].substring(0, 3)} ${weekStart.getDate()} - ${this.monthNames[weekEnd.getMonth()].substring(0, 3)} ${weekEnd.getDate()}, ${year}`;
            } else if (this.viewMode === 'day') {
                titleEl.textContent = `${this.dayNamesFull[this.currentDate.getDay()]}, ${this.monthNames[month]} ${this.currentDate.getDate()}, ${year}`;
            }
        }

        if (this.viewMode === 'month') {
            this.renderMonthView(gridEl, year, month);
        } else if (this.viewMode === 'week') {
            this.renderWeekView(gridEl);
        } else if (this.viewMode === 'day') {
            this.renderDayView(gridEl);
        }
    },

    getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day; // Sunday as start
        return new Date(d.setDate(diff));
    },

    formatDateKey(year, month, day) {
        const m = String(month + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${year}-${m}-${d}`;
    },

    getCategoryClass(category) {
        const cat = (category || '').toLowerCase();
        if (cat.includes('exam')) return 'cat-badge-exam';
        if (cat.includes('assignment')) return 'cat-badge-assignment';
        if (cat.includes('workshop')) return 'cat-badge-workshop';
        if (cat.includes('project')) return 'cat-badge-project';
        if (cat.includes('college')) return 'cat-badge-college';
        if (cat.includes('personal')) return 'cat-badge-personal';
        return 'cat-badge-other';
    },

    renderMonthView(container, year, month) {
        const today = new Date();
        const todayStr = this.formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

        const firstDayIndex = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        let html = '<div class="calendar-grid">';

        // Day of week headers
        this.dayNamesShort.forEach(d => {
            html += `<div class="calendar-day-header">${d}</div>`;
        });

        // Previous month trailing days
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const dayNum = daysInPrevMonth - i;
            const prevMonth = month === 0 ? 11 : month - 1;
            const prevYear = month === 0 ? year - 1 : year;
            const dateStr = this.formatDateKey(prevYear, prevMonth, dayNum);

            html += `
                <div class="calendar-cell other-month" data-date="${dateStr}">
                    <div class="calendar-cell-top">
                        <span class="cell-date-number">${dayNum}</span>
                    </div>
                </div>
            `;
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = this.formatDateKey(year, month, day);
            const isToday = dateStr === todayStr;
            const dayEvents = this.events.filter(e => e.date === dateStr);

            html += `
                <div class="calendar-cell ${isToday ? 'is-today' : ''}" data-date="${dateStr}">
                    <div class="calendar-cell-top">
                        <span class="cell-date-number">${day}</span>
                        <button class="cell-add-btn" title="Add event on this day" onclick="App.openAddModal('${dateStr}', event)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                        </button>
                    </div>
                    <div class="cell-events-list">
            `;

            // Render up to 3 event pills, with +N more counter
            const maxVisible = 3;
            dayEvents.slice(0, maxVisible).forEach(e => {
                const catClass = this.getCategoryClass(e.category);
                html += `
                    <div class="event-pill ${catClass}" onclick="App.openEventDetails(${e.id}, event)" title="${e.title} (${e.startTime}-${e.endTime})">
                        <span>${e.startTime}</span>
                        <span>${this.escapeHtml(e.title)}</span>
                    </div>
                `;
            });

            if (dayEvents.length > maxVisible) {
                html += `<div class="pill-more" onclick="App.openDayOverview('${dateStr}', event)">+${dayEvents.length - maxVisible} more</div>`;
            }

            html += `
                    </div>
                </div>
            `;
        }

        // Next month trailing days to complete 7x5 or 7x6 grid
        const totalCellsRendered = firstDayIndex + daysInMonth;
        const totalGridCells = totalCellsRendered > 35 ? 42 : 35;
        const remainingDays = totalGridCells - totalCellsRendered;

        for (let day = 1; day <= remainingDays; day++) {
            const nextMonth = month === 11 ? 0 : month + 1;
            const nextYear = month === 11 ? year + 1 : year;
            const dateStr = this.formatDateKey(nextYear, nextMonth, day);

            html += `
                <div class="calendar-cell other-month" data-date="${dateStr}">
                    <div class="calendar-cell-top">
                        <span class="cell-date-number">${day}</span>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;

        // Add cell click listener for quick event creation
        container.querySelectorAll('.calendar-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                if (e.target.closest('.event-pill') || e.target.closest('.cell-add-btn') || e.target.closest('.pill-more')) {
                    return;
                }
                const date = cell.dataset.date;
                if (date) App.openAddModal(date);
            });
        });
    },

    renderWeekView(container) {
        const weekStart = this.getStartOfWeek(new Date(this.currentDate));
        const todayStr = new Date().toISOString().split('T')[0];

        let html = '<div class="calendar-grid" style="grid-template-columns: repeat(7, 1fr);">';

        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            const dateStr = this.formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
            const isToday = dateStr === todayStr;
            const dayEvents = this.events.filter(e => e.date === dateStr);

            html += `
                <div class="calendar-cell ${isToday ? 'is-today' : ''}" style="min-height: 380px;" data-date="${dateStr}">
                    <div class="calendar-cell-top" style="flex-direction: column; align-items: flex-start; gap: 4px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color);">
                        <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">${this.dayNamesShort[d.getDay()]}</span>
                        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                            <span class="cell-date-number">${d.getDate()}</span>
                            <button class="cell-add-btn" style="opacity: 1;" onclick="App.openAddModal('${dateStr}', event)">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                            </button>
                        </div>
                    </div>
                    <div class="cell-events-list" style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px;">
            `;

            if (dayEvents.length === 0) {
                html += `<div style="font-size: 0.75rem; color: var(--text-dim); text-align: center; padding: 2rem 0;">No events</div>`;
            } else {
                dayEvents.forEach(e => {
                    const catClass = this.getCategoryClass(e.category);
                    html += `
                        <div class="event-pill ${catClass}" style="padding: 6px 8px; font-size: 0.8rem;" onclick="App.openEventDetails(${e.id}, event)">
                            <div style="font-weight: 700;">${e.startTime} - ${e.endTime}</div>
                            <div style="font-weight: 600;">${this.escapeHtml(e.title)}</div>
                            <div style="font-size: 0.7rem; opacity: 0.85;">${this.escapeHtml(e.venue)}</div>
                        </div>
                    `;
                });
            }

            html += `
                    </div>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;
    },

    renderDayView(container) {
        const d = this.currentDate;
        const dateStr = this.formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
        const dayEvents = this.events.filter(e => e.date === dateStr);

        let html = `
            <div style="background: var(--bg-surface); border-radius: var(--radius-lg); padding: 1.5rem; border: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
                    <div>
                        <h3 style="font-size: 1.25rem; font-weight: 800;">${this.dayNamesFull[d.getDay()]}, ${this.monthNames[d.getMonth()]} ${d.getDate()}</h3>
                        <p style="font-size: 0.85rem; color: var(--text-muted);">${dayEvents.length} event(s) scheduled for this day</p>
                    </div>
                    <button class="btn btn-primary" onclick="App.openAddModal('${dateStr}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                        Add Event
                    </button>
                </div>
                <div style="display: flex; flex-direction: column; gap: 1rem;">
        `;

        if (dayEvents.length === 0) {
            html += `
                <div class="zero-state" style="padding: 4rem 1rem;">
                    <div class="zero-icon">☕</div>
                    <h4>No events scheduled for today</h4>
                    <p>Enjoy your free time or schedule a study session.</p>
                </div>
            `;
        } else {
            dayEvents.forEach(e => {
                const catClass = this.getCategoryClass(e.category);
                html += `
                    <div class="event-card" onclick="App.openEventDetails(${e.id})" style="cursor: pointer;">
                        <div class="event-card-header">
                            <div>
                                <span class="badge ${catClass}">${e.category}</span>
                                <h4 class="event-card-title" style="margin-top: 6px;">${this.escapeHtml(e.title)}</h4>
                            </div>
                            <span class="badge" style="background: var(--bg-app); border: 1px solid var(--border-color); color: var(--pri-${e.priority.toLowerCase()}); font-weight: 700;">
                                ${e.priority} Priority
                            </span>
                        </div>
                        <p class="event-card-desc">${this.escapeHtml(e.description)}</p>
                        <div class="event-card-meta">
                            <div class="meta-row">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                <span>${e.startTime} - ${e.endTime}</span>
                            </div>
                            <div class="meta-row">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                <span>${this.escapeHtml(e.venue)}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        html += `
                </div>
            </div>
        `;
        container.innerHTML = html;
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

window.CalendarView = CalendarView;
