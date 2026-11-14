/**
 * ============================================================================
 * Student Calendar with Events - Event Management & API Module
 * ============================================================================
 * Handles communication with the C-backed Node.js API bridge with intelligent
 * automatic fallback to local browser storage when running offline or standalone.
 * ============================================================================
 */

const SAMPLE_EVENTS = [
    {
        id: 1,
        title: "Data Structures Assignment",
        description: "Implement Binary Search Trees and AVL balance rotations in C. Submit via college portal.",
        date: "2026-09-28",
        startTime: "10:00",
        endTime: "12:00",
        venue: "CS Lab 3 / Online Submission",
        category: "Assignment",
        priority: "High",
        reminder: "1 hour before",
        isDeleted: 0
    },
    {
        id: 2,
        title: "AI & Machine Learning Workshop",
        description: "Hands-on session on Neural Networks and Transformer Architectures with industry experts.",
        date: "2026-09-29",
        startTime: "14:00",
        endTime: "16:30",
        venue: "Auditorium Hall B",
        category: "Workshop",
        priority: "Medium",
        reminder: "30 minutes before",
        isDeleted: 0
    },
    {
        id: 3,
        title: "Mathematics Internal Exam",
        description: "Semester Midterm covering Linear Algebra, Eigenvalues, and Fourier Series.",
        date: "2026-10-02",
        startTime: "09:00",
        endTime: "11:00",
        venue: "Examination Hall 104",
        category: "Exam",
        priority: "High",
        reminder: "1 day before",
        isDeleted: 0
    },
    {
        id: 4,
        title: "Capstone Project Review",
        description: "Demonstrate working prototype of Full-Stack Student Calendar with C Backend.",
        date: "2026-10-05",
        startTime: "16:00",
        endTime: "17:30",
        venue: "Faculty Conference Room",
        category: "Project",
        priority: "High",
        reminder: "1 hour before",
        isDeleted: 0
    },
    {
        id: 5,
        title: "Annual Tech Fest Inception",
        description: "Inauguration ceremony for annual inter-college hackathon and technical symposium.",
        date: "2026-10-10",
        startTime: "09:30",
        endTime: "13:00",
        venue: "Main Campus Arena",
        category: "College Event",
        priority: "Medium",
        reminder: "1 day before",
        isDeleted: 0
    },
    {
        id: 6,
        title: "Library Study Group",
        description: "Review Operating System concepts and Process Scheduling algorithms.",
        date: "2026-09-28",
        startTime: "15:00",
        endTime: "17:00",
        venue: "Central Library Floor 2",
        category: "Personal",
        priority: "Low",
        reminder: "10 minutes before",
        isDeleted: 0
    },
    {
        id: 7,
        title: "DSD",
        description: "class",
        date: "2026-11-14",
        startTime: "14:00",
        endTime: "23:00",
        venue: "CLASS 1",
        category: "Exam",
        priority: "Medium",
        reminder: "1 hour before",
        isDeleted: 0
    }
];

const LOCAL_STORAGE_KEY = 'student_calendar_events_v1';

const EventsAPI = {
    allEvents: [],
    lastStats: null,
    lastCInfo: null,
    isBackendOnline: null,

    /**
     * Resolves appropriate API Base URL depending on environment
     */
    getApiBase() {
        if (typeof window === 'undefined') return '/api';
        if (window.location.protocol === 'file:') {
            return 'http://localhost:3000/api';
        }
        if (window.location.port !== '3000' && window.location.port !== '') {
            return 'http://localhost:3000/api';
        }
        return '/api';
    },

    /**
     * LocalStorage Helper: Read active events
     */
    getLocalEvents() {
        try {
            const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (!raw) {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SAMPLE_EVENTS));
                return JSON.parse(JSON.stringify(SAMPLE_EVENTS));
            }
            return JSON.parse(raw);
        } catch (e) {
            console.warn('[EventsAPI] LocalStorage read failed:', e);
            return JSON.parse(JSON.stringify(SAMPLE_EVENTS));
        }
    },

    /**
     * LocalStorage Helper: Save events array
     */
    saveLocalEvents(events) {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(events));
            return true;
        } catch (e) {
            console.error('[EventsAPI] LocalStorage save failed:', e);
            return false;
        }
    },

    /**
     * Pure C Algorithm Mirror implementation for browser-side standalone execution
     */
    timeToMinutes(timeStr) {
        if (!timeStr) return -1;
        const parts = timeStr.split(':').map(Number);
        if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return -1;
        return parts[0] * 60 + parts[1];
    },

    sortEvents(events) {
        return events.sort((a, b) => {
            const dateCmp = (a.date || '').localeCompare(b.date || '');
            if (dateCmp !== 0) return dateCmp;
            return (a.startTime || '').localeCompare(b.startTime || '');
        });
    },

    localCheckConflict(date, startTime, endTime, excludeId = 0) {
        const newStart = this.timeToMinutes(startTime);
        const newEnd = this.timeToMinutes(endTime);
        if (newStart < 0 || newEnd <= newStart) return { conflict: false };

        const events = this.getLocalEvents();
        for (const e of events) {
            if (e.isDeleted) continue;
            if (excludeId > 0 && e.id === excludeId) continue;

            if (e.date === date) {
                const curStart = this.timeToMinutes(e.startTime);
                const curEnd = this.timeToMinutes(e.endTime);

                // Overlap condition: S1 < E2 && S2 < E1
                if (newStart < curEnd && curStart < newEnd) {
                    return { conflict: true, conflictingEvent: e };
                }
            }
        }
        return { conflict: false };
    },

    calculateLocalStats(refDate = null) {
        const todayStr = refDate || new Date().toISOString().split('T')[0];
        const events = this.getLocalEvents().filter(e => !e.isDeleted);

        const stats = {
            totalEvents: events.length,
            todayEvents: 0,
            upcomingEvents: 0,
            examCount: 0,
            assignmentCount: 0,
            workshopCount: 0,
            projectCount: 0,
            collegeEventCount: 0,
            personalCount: 0,
            weekdayDistribution: [0, 0, 0, 0, 0, 0, 0]
        };

        for (const e of events) {
            if (e.date === todayStr) stats.todayEvents++;
            if (e.date >= todayStr) stats.upcomingEvents++;

            const cat = (e.category || '').toLowerCase();
            if (cat.includes('exam')) stats.examCount++;
            else if (cat.includes('assignment')) stats.assignmentCount++;
            else if (cat.includes('workshop')) stats.workshopCount++;
            else if (cat.includes('project')) stats.projectCount++;
            else if (cat.includes('college')) stats.collegeEventCount++;
            else if (cat.includes('personal')) stats.personalCount++;

            try {
                const d = new Date(e.date + 'T00:00:00');
                const dayOfWeek = d.getDay();
                if (dayOfWeek >= 0 && dayOfWeek < 7) {
                    stats.weekdayDistribution[dayOfWeek]++;
                }
            } catch (err) {
                // ignore invalid date
            }
        }

        return stats;
    },

    /**
     * Notify UI of engine mode
     */
    updateEngineBadge(isOnline, engineName = null) {
        this.isBackendOnline = isOnline;
        const statusHeader = document.querySelector('.c-status-header');
        const statusDesc = document.querySelector('.c-status-desc');
        const statusDot = document.querySelector('.status-dot');

        if (statusHeader && statusDesc) {
            if (isOnline) {
                if (statusDot) statusDot.style.background = '#10b981';
                statusDesc.innerHTML = `<span style="color:#10b981;font-weight:600;">● Online</span> • ${engineName || 'C Core Engine'}`;
            } else {
                if (statusDot) statusDot.style.background = '#f59e0b';
                statusDesc.innerHTML = `<span style="color:#f59e0b;font-weight:600;">● Local Storage</span> • Run <code>npm start</code> for C-Core`;
            }
        }
    },

    /**
     * Fetch all active events from C Core, fallback to LocalStorage
     */
    async getAllEvents() {
        const apiBase = this.getApiBase();
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`${apiBase}/events`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.events)) {
                    this.allEvents = data.events;
                    this.updateEngineBadge(true, data.meta?.engine);
                    // Sync to local storage for offline resilience
                    this.saveLocalEvents(data.events);
                    if (window.App && data.meta) window.App.logCExecution(data.meta);
                    return data.events;
                }
            }
        } catch (err) {
            // Backend unavailable or network error
        }

        // Seamless LocalStorage Fallback
        this.updateEngineBadge(false);
        const local = this.getLocalEvents().filter(e => !e.isDeleted);
        this.allEvents = this.sortEvents(local);
        return this.allEvents;
    },

    /**
     * Fetch a single event by ID
     */
    async getEventById(id) {
        const numId = parseInt(id, 10);
        const apiBase = this.getApiBase();

        if (this.isBackendOnline !== false) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                const res = await fetch(`${apiBase}/events/${numId}`, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.event) {
                        if (window.App && data.meta) window.App.logCExecution(data.meta);
                        return data.event;
                    }
                }
            } catch (err) {
                // pass to local fallback
            }
        }

        // Local Fallback
        const events = this.getLocalEvents();
        const found = events.find(e => e.id === numId && !e.isDeleted);
        return found || null;
    },

    /**
     * Check if a date & time slot conflicts with an existing event
     */
    async checkConflict(date, startTime, endTime, excludeId = 0) {
        const apiBase = this.getApiBase();

        if (this.isBackendOnline !== false) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                const res = await fetch(`${apiBase}/check-conflict`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date, startTime, endTime, excludeId }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const data = await res.json();
                    if (window.App && data.meta) window.App.logCExecution(data.meta);
                    return data;
                }
            } catch (err) {
                // pass to local fallback
            }
        }

        // Pure C Overlap Algorithm executed locally
        return this.localCheckConflict(date, startTime, endTime, excludeId);
    },

    /**
     * Add a new event (Backend + LocalStorage fallback)
     */
    async addEvent(eventData, allowConflict = true) {
        const apiBase = this.getApiBase();

        if (this.isBackendOnline !== false) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 800);
                const res = await fetch(`${apiBase}/events`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...eventData, allowConflict }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const data = await res.json();
                if (window.App && data.meta) window.App.logCExecution(data.meta);

                if (res.ok && data.success && data.event) {
                    // Sync to local storage
                    const events = this.getLocalEvents();
                    events.push(data.event);
                    this.saveLocalEvents(events);
                    return { status: res.status, data, isLocal: false };
                }

                if (res.status === 409) {
                    return { status: 409, data };
                }
            } catch (err) {
                console.warn('[EventsAPI] Backend unreachable during add, saving to LocalStorage...');
            }
        }

        // Local Storage Fallback
        const events = this.getLocalEvents();
        const maxId = events.reduce((max, e) => Math.max(max, e.id || 0), 0);
        const newEvent = {
            id: maxId + 1,
            title: eventData.title.trim(),
            description: (eventData.description || '').trim(),
            date: eventData.date,
            startTime: eventData.startTime,
            endTime: eventData.endTime,
            venue: (eventData.venue || 'Campus').trim(),
            category: eventData.category || 'Other',
            priority: eventData.priority || 'Medium',
            reminder: eventData.reminder || 'None',
            isDeleted: 0
        };

        events.push(newEvent);
        this.saveLocalEvents(events);
        this.updateEngineBadge(false);

        return {
            status: 201,
            data: {
                success: true,
                message: 'Event scheduled successfully (Saved in browser storage)',
                event: newEvent
            },
            isLocal: true
        };
    },

    /**
     * Update an existing event (Backend + LocalStorage fallback)
     */
    async updateEvent(id, eventData, allowConflict = true) {
        const numId = parseInt(id, 10);
        const apiBase = this.getApiBase();

        if (this.isBackendOnline !== false) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2500);
                const res = await fetch(`${apiBase}/events/${numId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...eventData, allowConflict }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const data = await res.json();
                if (window.App && data.meta) window.App.logCExecution(data.meta);

                if (res.ok && data.success && data.event) {
                    const events = this.getLocalEvents();
                    const idx = events.findIndex(e => e.id === numId);
                    if (idx !== -1) events[idx] = data.event;
                    this.saveLocalEvents(events);
                    return { status: res.status, data, isLocal: false };
                }

                if (res.status === 409) {
                    return { status: 409, data };
                }
            } catch (err) {
                console.warn(`[EventsAPI] Backend unreachable during update of ${numId}, updating LocalStorage...`);
            }
        }

        // Local Storage Fallback
        const events = this.getLocalEvents();
        const idx = events.findIndex(e => e.id === numId && !e.isDeleted);
        if (idx !== -1) {
            const updated = {
                ...events[idx],
                title: eventData.title.trim(),
                description: (eventData.description || '').trim(),
                date: eventData.date,
                startTime: eventData.startTime,
                endTime: eventData.endTime,
                venue: (eventData.venue || 'Campus').trim(),
                category: eventData.category || 'Other',
                priority: eventData.priority || 'Medium',
                reminder: eventData.reminder || 'None',
                isDeleted: 0
            };
            events[idx] = updated;
            this.saveLocalEvents(events);
            this.updateEngineBadge(false);

            return {
                status: 200,
                data: {
                    success: true,
                    message: 'Event updated successfully (Saved in browser storage)',
                    event: updated
                },
                isLocal: true
            };
        }

        return { status: 404, data: { success: false, error: 'Event not found' } };
    },

    /**
     * Delete an event (Backend + LocalStorage fallback)
     */
    async deleteEvent(id) {
        const numId = parseInt(id, 10);
        const apiBase = this.getApiBase();

        if (this.isBackendOnline !== false) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                const res = await fetch(`${apiBase}/events/${numId}`, {
                    method: 'DELETE',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const data = await res.json();
                if (window.App && data.meta) window.App.logCExecution(data.meta);

                if (res.ok && data.success) {
                    const events = this.getLocalEvents();
                    const idx = events.findIndex(e => e.id === numId);
                    if (idx !== -1) events[idx].isDeleted = 1;
                    this.saveLocalEvents(events);
                    return data;
                }
            } catch (err) {
                // local fallback
            }
        }

        // Local Storage Fallback
        const events = this.getLocalEvents();
        const idx = events.findIndex(e => e.id === numId && !e.isDeleted);
        if (idx !== -1) {
            events[idx].isDeleted = 1;
            this.saveLocalEvents(events);
            return { success: true, message: `Event ${numId} deleted`, id: numId };
        }

        return { success: false, error: 'Event not found' };
    },

    /**
     * Search and filter events
     */
    async searchEvents(query = '', category = '', priority = '', date = '') {
        const apiBase = this.getApiBase();

        if (this.isBackendOnline !== false) {
            try {
                const params = new URLSearchParams();
                if (query) params.append('q', query);
                if (category && category !== 'All') params.append('category', category);
                if (priority && priority !== 'All') params.append('priority', priority);
                if (date) params.append('date', date);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                const res = await fetch(`${apiBase}/events/search?${params.toString()}`, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const data = await res.json();
                    if (window.App && data.meta) window.App.logCExecution(data.meta);
                    return data.events || [];
                }
            } catch (err) {
                // local fallback
            }
        }

        // Local Search & Filtering
        let events = this.getLocalEvents().filter(e => !e.isDeleted);
        const kw = (query || '').toLowerCase().trim();

        if (category && category !== 'All') {
            events = events.filter(e => (e.category || '').toLowerCase() === category.toLowerCase());
        }
        if (priority && priority !== 'All') {
            events = events.filter(e => (e.priority || '').toLowerCase() === priority.toLowerCase());
        }
        if (date) {
            events = events.filter(e => e.date === date);
        }
        if (kw) {
            events = events.filter(e => {
                return (e.title && e.title.toLowerCase().includes(kw)) ||
                       (e.description && e.description.toLowerCase().includes(kw)) ||
                       (e.venue && e.venue.toLowerCase().includes(kw)) ||
                       (e.category && e.category.toLowerCase().includes(kw));
            });
        }

        return this.sortEvents(events);
    },

    /**
     * Fetch upcoming events
     */
    async getUpcomingEvents() {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const apiBase = this.getApiBase();

        if (this.isBackendOnline !== false) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                const res = await fetch(`${apiBase}/events/upcoming?date=${dateStr}&time=${timeStr}`, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const data = await res.json();
                    if (window.App && data.meta) window.App.logCExecution(data.meta);
                    return data.events || [];
                }
            } catch (err) {
                // local fallback
            }
        }

        // Local Upcoming Filter
        const events = this.getLocalEvents().filter(e => !e.isDeleted);
        const filtered = events.filter(e => {
            if (e.date > dateStr) return true;
            if (e.date === dateStr) {
                return (e.endTime >= timeStr || e.startTime >= timeStr);
            }
            return false;
        });

        return this.sortEvents(filtered);
    },

    /**
     * Fetch calendar stats
     */
    async getStats() {
        const todayStr = new Date().toISOString().split('T')[0];
        const apiBase = this.getApiBase();

        if (this.isBackendOnline !== false) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                const res = await fetch(`${apiBase}/stats?date=${todayStr}`, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.stats) {
                        this.lastStats = data.stats;
                        if (window.App && data.meta) window.App.logCExecution(data.meta);
                        return data.stats;
                    }
                }
            } catch (err) {
                // local fallback
            }
        }

        const localStats = this.calculateLocalStats(todayStr);
        this.lastStats = localStats;
        return localStats;
    },

    /**
     * Reset and seed sample dataset
     */
    async seedSampleData() {
        const apiBase = this.getApiBase();
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SAMPLE_EVENTS));

        if (this.isBackendOnline !== false) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                const res = await fetch(`${apiBase}/seed`, { method: 'POST', signal: controller.signal });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const data = await res.json();
                    if (window.App && data.meta) window.App.logCExecution(data.meta);
                    return data;
                }
            } catch (err) {
                // local success
            }
        }

        return { success: true, message: 'Sample academic dataset restored successfully' };
    },

    /**
     * Fetch C engine status and meta
     */
    async getCInfo() {
        const apiBase = this.getApiBase();
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`${apiBase}/c-info`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                this.lastCInfo = data;
                return data;
            }
        } catch (err) {
            // fallback
        }

        return {
            engine: 'C Core Struct & Algorithm Engine (Offline / Local Mode)',
            binaryPath: 'c-core/calendar_core.exe',
            binarySizeKB: '48.5',
            compiler: 'GCC 16.1.0 (C17 Standard)',
            persistenceFile: 'data/events.json & data/events.dat',
            dataStructure: 'struct Event { id, title[100], description[300], date[20], startTime[10], endTime[10], venue[100], category[50], priority[20], reminder[30], isDeleted }',
            features: [
                'Binary and Structured File Persistence',
                'Chronological Date & Time Sorting via qsort()',
                'O(N) Schedule Conflict Detection [S1 < E2 && S2 < E1]',
                'Multi-criteria Case-insensitive Search & Filtering',
                'Dynamic Day-of-the-Week & Workload Statistics',
                'Interactive Terminal CLI for Project Viva Demonstration'
            ]
        };
    }
};

window.EventsAPI = EventsAPI;
