/**
 * ============================================================================
 * Student Calendar with Events - Event Management & API Module
 * ============================================================================
 * Handles communication with the C-backed Node.js API bridge.
 * ============================================================================
 */

const EventsAPI = {
    // Cache for quick UI lookups
    allEvents: [],
    lastStats: null,
    lastCInfo: null,

    /**
     * Fetch all active events from C Core
     */
    async getAllEvents() {
        try {
            const res = await fetch('/api/events');
            const data = await res.json();
            if (data.success && Array.isArray(data.events)) {
                this.allEvents = data.events;
                if (window.App) window.App.logCExecution(data.meta);
                return data.events;
            }
            return [];
        } catch (err) {
            console.error('[EventsAPI] Error fetching events:', err);
            return [];
        }
    },

    /**
     * Fetch a single event by ID
     */
    async getEventById(id) {
        try {
            const res = await fetch(`/api/events/${id}`);
            const data = await res.json();
            if (data.success) {
                if (window.App) window.App.logCExecution(data.meta);
                return data.event;
            }
            return null;
        } catch (err) {
            console.error(`[EventsAPI] Error fetching event ${id}:`, err);
            return null;
        }
    },

    /**
     * Check if a date & time slot conflicts with an existing event
     */
    async checkConflict(date, startTime, endTime, excludeId = 0) {
        try {
            const res = await fetch('/api/check-conflict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, startTime, endTime, excludeId })
            });
            const data = await res.json();
            if (window.App && data.meta) window.App.logCExecution(data.meta);
            return data;
        } catch (err) {
            console.error('[EventsAPI] Error checking conflict:', err);
            return { conflict: false };
        }
    },

    /**
     * Add a new event
     */
    async addEvent(eventData, allowConflict = false) {
        try {
            const res = await fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...eventData, allowConflict })
            });
            const data = await res.json();
            if (window.App && data.meta) window.App.logCExecution(data.meta);
            return { status: res.status, data };
        } catch (err) {
            console.error('[EventsAPI] Error adding event:', err);
            return { status: 500, data: { success: false, error: 'Network or backend error' } };
        }
    },

    /**
     * Update an existing event
     */
    async updateEvent(id, eventData, allowConflict = false) {
        try {
            const res = await fetch(`/api/events/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...eventData, allowConflict })
            });
            const data = await res.json();
            if (window.App && data.meta) window.App.logCExecution(data.meta);
            return { status: res.status, data };
        } catch (err) {
            console.error(`[EventsAPI] Error updating event ${id}:`, err);
            return { status: 500, data: { success: false, error: 'Network or backend error' } };
        }
    },

    /**
     * Delete an event
     */
    async deleteEvent(id) {
        try {
            const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (window.App && data.meta) window.App.logCExecution(data.meta);
            return data;
        } catch (err) {
            console.error(`[EventsAPI] Error deleting event ${id}:`, err);
            return { success: false, error: 'Failed to delete event' };
        }
    },

    /**
     * Search and filter events
     */
    async searchEvents(query = '', category = '', priority = '', date = '') {
        try {
            const params = new URLSearchParams();
            if (query) params.append('q', query);
            if (category && category !== 'All') params.append('category', category);
            if (priority && priority !== 'All') params.append('priority', priority);
            if (date) params.append('date', date);

            const res = await fetch(`/api/events/search?${params.toString()}`);
            const data = await res.json();
            if (window.App && data.meta) window.App.logCExecution(data.meta);
            return data.events || [];
        } catch (err) {
            console.error('[EventsAPI] Error searching events:', err);
            return [];
        }
    },

    /**
     * Fetch upcoming events
     */
    async getUpcomingEvents() {
        try {
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            const res = await fetch(`/api/events/upcoming?date=${dateStr}&time=${timeStr}`);
            const data = await res.json();
            if (window.App && data.meta) window.App.logCExecution(data.meta);
            return data.events || [];
        } catch (err) {
            console.error('[EventsAPI] Error fetching upcoming events:', err);
            return [];
        }
    },

    /**
     * Fetch calendar stats calculated by C Core
     */
    async getStats() {
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const res = await fetch(`/api/stats?date=${todayStr}`);
            const data = await res.json();
            if (data.success && data.stats) {
                this.lastStats = data.stats;
                if (window.App && data.meta) window.App.logCExecution(data.meta);
                return data.stats;
            }
            return null;
        } catch (err) {
            console.error('[EventsAPI] Error fetching stats:', err);
            return null;
        }
    },

    /**
     * Reset and seed initial sample dataset
     */
    async seedSampleData() {
        try {
            const res = await fetch('/api/seed', { method: 'POST' });
            const data = await res.json();
            if (window.App && data.meta) window.App.logCExecution(data.meta);
            return data;
        } catch (err) {
            console.error('[EventsAPI] Error seeding sample data:', err);
            return { success: false };
        }
    },

    /**
     * Fetch C engine status and meta
     */
    async getCInfo() {
        try {
            const res = await fetch('/api/c-info');
            const data = await res.json();
            this.lastCInfo = data;
            return data;
        } catch (err) {
            return null;
        }
    }
};

window.EventsAPI = EventsAPI;
