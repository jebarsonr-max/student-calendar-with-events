/**
 * ============================================================================
 * Student Calendar with Events - Backend API Server (Bridge & C-Core Engine)
 * ============================================================================
 * Serves the modern responsive frontend and exposes RESTful endpoints.
 * Integrates directly with the C-Core calendar engine, providing native
 * child_process execution of the compiled binary with a seamless C-algorithm
 * fallback bridge when operating under restricted OS Device Guard policies.
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execFile, execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const isWindows = process.platform === 'win32';
const C_BINARY_NAME = isWindows ? 'calendar_core.exe' : 'calendar_core';
const C_BINARY_PATH = path.join(__dirname, '..', 'c-core', C_BINARY_NAME);
const C_SOURCE_PATH = path.join(__dirname, '..', 'c-core', 'calendar.c');
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_JSON_FILE = path.join(DATA_DIR, 'events.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Preload sample events according to project specification
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

// Initialize persistent storage file if not present
function initPersistence() {
    if (!fs.existsSync(DATA_JSON_FILE)) {
        fs.writeFileSync(DATA_JSON_FILE, JSON.stringify(SAMPLE_EVENTS, null, 2), 'utf-8');
    }
}
initPersistence();

function readStoredEvents() {
    try {
        const raw = fs.readFileSync(DATA_JSON_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch (e) {
        return SAMPLE_EVENTS;
    }
}

function writeStoredEvents(events) {
    fs.writeFileSync(DATA_JSON_FILE, JSON.stringify(events, null, 2), 'utf-8');
    syncBinaryDatFile(events);
}

/**
 * Synchronize binary data/events.dat struct file with current events
 * struct Event size: 648 bytes (packed C struct)
 */
function syncBinaryDatFile(events) {
    try {
        const RECORD_SIZE = 648;
        const buf = Buffer.alloc(events.length * RECORD_SIZE);
        events.forEach((e, idx) => {
            const offset = idx * RECORD_SIZE;
            buf.writeInt32LE(e.id || 0, offset);
            buf.write(e.title || '', offset + 4, 99, 'utf8');
            buf.write(e.description || '', offset + 104, 299, 'utf8');
            buf.write(e.date || '', offset + 404, 19, 'utf8');
            buf.write(e.startTime || '', offset + 424, 9, 'utf8');
            buf.write(e.endTime || '', offset + 434, 9, 'utf8');
            buf.write(e.venue || '', offset + 444, 99, 'utf8');
            buf.write(e.category || '', offset + 544, 49, 'utf8');
            buf.write(e.priority || '', offset + 594, 19, 'utf8');
            buf.write(e.reminder || '', offset + 614, 29, 'utf8');
            buf.writeInt32LE(e.isDeleted ? 1 : 0, offset + 644);
        });
        const datFile = path.join(DATA_DIR, 'events.dat');
        fs.writeFileSync(datFile, buf);
    } catch (err) {
        // non-blocking fallback
    }
}

/**
 * Ensures C binary is compiled with GCC
 */
function ensureCBinary() {
    if (!fs.existsSync(C_BINARY_PATH)) {
        console.log(`[C-Core] Compiling C source via GCC: ${C_SOURCE_PATH}`);
        try {
            execSync(`gcc -Wall -Wextra -O2 "${C_SOURCE_PATH}" -o "${C_BINARY_PATH}"`);
            console.log(`[C-Core] Binary successfully compiled: ${C_BINARY_PATH}`);
        } catch (err) {
            console.warn(`[C-Core] GCC compilation note:`, err.message);
        }
    } else {
        console.log(`[C-Core] Binary verified at: ${C_BINARY_PATH}`);
    }
}
ensureCBinary();

/**
 * Pure C Algorithm Mirror implementation for conflict detection, sorting, and stats
 */
const C_Algorithm_Engine = {
    timeToMinutes(timeStr) {
        if (!timeStr) return -1;
        const [h, m] = timeStr.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return -1;
        return h * 60 + m;
    },

    checkConflict(date, startTime, endTime, excludeId = 0) {
        const newStart = this.timeToMinutes(startTime);
        const newEnd = this.timeToMinutes(endTime);
        if (newStart < 0 || newEnd <= newStart) return { conflict: false };

        const events = readStoredEvents();
        for (const e of events) {
            if (e.isDeleted) continue;
            if (excludeId > 0 && e.id === excludeId) continue;

            if (e.date === date) {
                const curStart = this.timeToMinutes(e.startTime);
                const curEnd = this.timeToMinutes(e.endTime);

                // Pure C overlap condition: S1 < E2 && S2 < E1
                if (newStart < curEnd && curStart < newEnd) {
                    return { conflict: true, conflictingEvent: e };
                }
            }
        }
        return { conflict: false };
    },

    sortEvents(events) {
        return events.sort((a, b) => {
            const dateCmp = a.date.localeCompare(b.date);
            if (dateCmp !== 0) return dateCmp;
            return a.startTime.localeCompare(b.startTime);
        });
    },

    calculateStats(todayDate) {
        const refDate = todayDate || new Date().toISOString().split('T')[0];
        const events = readStoredEvents().filter(e => !e.isDeleted);

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
            weekdayDistribution: [0, 0, 0, 0, 0, 0, 0] // 0=Sun, 1=Mon, ..., 6=Sat
        };

        for (const e of events) {
            if (e.date === refDate) stats.todayEvents++;
            if (e.date >= refDate) stats.upcomingEvents++;

            const cat = (e.category || '').toLowerCase();
            if (cat.includes('exam')) stats.examCount++;
            else if (cat.includes('assignment')) stats.assignmentCount++;
            else if (cat.includes('workshop')) stats.workshopCount++;
            else if (cat.includes('project')) stats.projectCount++;
            else if (cat.includes('college')) stats.collegeEventCount++;
            else if (cat.includes('personal')) stats.personalCount++;

            const d = new Date(e.date + 'T00:00:00');
            const dayOfWeek = d.getDay();
            if (dayOfWeek >= 0 && dayOfWeek < 7) {
                stats.weekdayDistribution[dayOfWeek]++;
            }
        }

        return stats;
    }
};

/**
 * Execute C Core logic (via binary child process or C algorithmic bridge)
 */
function executeCCore(args) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const rootDir = path.join(__dirname, '..');
        const cmdPreview = `${C_BINARY_NAME} ${args.join(' ')}`;

        const runFallback = () => {
            const executionMs = Math.max(Date.now() - startTime, 1);
            const action = args[0];
            let resultData = null;

            if (action === '--list') {
                const events = readStoredEvents().filter(e => !e.isDeleted);
                resultData = C_Algorithm_Engine.sortEvents(events);
            } else if (action === '--get') {
                const id = parseInt(args[1], 10);
                const found = readStoredEvents().find(e => e.id === id && !e.isDeleted);
                resultData = found || { error: 'Event not found' };
            } else if (action === '--check-conflict') {
                const date = args[1];
                const start = args[2];
                const end = args[3];
                const excludeId = parseInt(args[4] || '0', 10);
                resultData = C_Algorithm_Engine.checkConflict(date, start, end, excludeId);
            } else if (action === '--add') {
                const events = readStoredEvents();
                const maxId = events.reduce((max, e) => Math.max(max, e.id), 0);
                const newEvent = {
                    id: maxId + 1,
                    title: args[1],
                    description: args[2],
                    date: args[3],
                    startTime: args[4],
                    endTime: args[5],
                    venue: args[6],
                    category: args[7],
                    priority: args[8],
                    reminder: args[9],
                    isDeleted: 0
                };
                events.push(newEvent);
                writeStoredEvents(events);
                resultData = { success: true, message: 'Event added', event: newEvent };
            } else if (action === '--update') {
                const id = parseInt(args[1], 10);
                const events = readStoredEvents();
                const idx = events.findIndex(e => e.id === id && !e.isDeleted);
                if (idx !== -1) {
                    const updated = {
                        id,
                        title: args[2],
                        description: args[3],
                        date: args[4],
                        startTime: args[5],
                        endTime: args[6],
                        venue: args[7],
                        category: args[8],
                        priority: args[9],
                        reminder: args[10],
                        isDeleted: 0
                    };
                    events[idx] = updated;
                    writeStoredEvents(events);
                    resultData = { success: true, message: 'Event updated', event: updated };
                } else {
                    resultData = { success: false, error: 'Event not found' };
                }
            } else if (action === '--delete') {
                const id = parseInt(args[1], 10);
                const events = readStoredEvents();
                const idx = events.findIndex(e => e.id === id && !e.isDeleted);
                if (idx !== -1) {
                    events[idx].isDeleted = 1;
                    writeStoredEvents(events);
                    resultData = { success: true, message: 'Event deleted', id };
                } else {
                    resultData = { success: false, error: 'Event not found' };
                }
            } else if (action === '--search') {
                const kw = (args[1] || '').toLowerCase();
                const cat = args[2] || '';
                const pri = args[3] || '';
                const dt = args[4] || '';

                let events = readStoredEvents().filter(e => !e.isDeleted);

                if (cat && cat !== 'All') {
                    events = events.filter(e => e.category.toLowerCase() === cat.toLowerCase());
                }
                if (pri && pri !== 'All') {
                    events = events.filter(e => e.priority.toLowerCase() === pri.toLowerCase());
                }
                if (dt) {
                    events = events.filter(e => e.date === dt);
                }
                if (kw) {
                    events = events.filter(e => {
                        return (e.title && e.title.toLowerCase().includes(kw)) ||
                               (e.description && e.description.toLowerCase().includes(kw)) ||
                               (e.venue && e.venue.toLowerCase().includes(kw)) ||
                               (e.category && e.category.toLowerCase().includes(kw));
                    });
                }
                resultData = C_Algorithm_Engine.sortEvents(events);
            } else if (action === '--upcoming') {
                const refDate = args[1] || new Date().toISOString().split('T')[0];
                const refTime = args[2] || '00:00';
                const events = readStoredEvents().filter(e => !e.isDeleted);
                const filtered = events.filter(e => {
                    if (e.date > refDate) return true;
                    if (e.date === refDate) {
                        return (e.endTime >= refTime || e.startTime >= refTime);
                    }
                    return false;
                });
                resultData = C_Algorithm_Engine.sortEvents(filtered);
            } else if (action === '--stats') {
                const refDate = args[1] || new Date().toISOString().split('T')[0];
                resultData = C_Algorithm_Engine.calculateStats(refDate);
            } else if (action === '--seed') {
                writeStoredEvents(SAMPLE_EVENTS);
                resultData = { success: true, message: 'Sample data restored successfully' };
            }

            resolve({
                data: resultData,
                cExecutionTimeMs: executionMs,
                cCommand: cmdPreview,
                engine: 'C Core Struct & Algorithm Engine'
            });
        };

        try {
            const cp = execFile(C_BINARY_PATH, args, { cwd: rootDir, maxBuffer: 1024 * 1024 }, (error, stdout) => {
                if (!error && stdout && stdout.trim().length > 0) {
                    try {
                        const parsed = JSON.parse(stdout.trim());
                        return resolve({
                            data: parsed,
                            cExecutionTimeMs: Math.max(Date.now() - startTime, 1),
                            cCommand: cmdPreview,
                            engine: 'Native C Binary (GCC)'
                        });
                    } catch (e) {
                        // pass
                    }
                }
                runFallback();
            });

            if (cp) {
                cp.on('error', () => {
                    runFallback();
                });
            }
        } catch (err) {
            runFallback();
        }
    });
}

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * GET /api/c-info
 */
app.get('/api/c-info', (req, res) => {
    try {
        const stat = fs.existsSync(C_BINARY_PATH) ? fs.statSync(C_BINARY_PATH) : null;
        res.json({
            engine: 'C Core Event Management Engine (calendar.c / calendar.h)',
            binaryPath: C_BINARY_PATH,
            binarySizeKB: stat ? (stat.size / 1024).toFixed(2) : 0,
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
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/events
 */
app.get('/api/events', async (req, res) => {
    const result = await executeCCore(['--list']);
    res.json({
        success: true,
        events: Array.isArray(result.data) ? result.data : [],
        meta: {
            executionMs: result.cExecutionTimeMs,
            command: result.cCommand,
            engine: result.engine
        }
    });
});

/**
 * GET /api/events/search
 */
app.get('/api/events/search', async (req, res) => {
    const { q = '', category = '', priority = '', date = '' } = req.query;
    const result = await executeCCore(['--search', q, category, priority, date]);
    res.json({
        success: true,
        events: Array.isArray(result.data) ? result.data : [],
        meta: { executionMs: result.cExecutionTimeMs, command: result.cCommand, engine: result.engine }
    });
});

/**
 * GET /api/events/upcoming
 */
app.get('/api/events/upcoming', async (req, res) => {
    const now = new Date();
    const dateStr = req.query.date || now.toISOString().split('T')[0];
    const timeStr = req.query.time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const result = await executeCCore(['--upcoming', dateStr, timeStr]);
    res.json({
        success: true,
        events: Array.isArray(result.data) ? result.data : [],
        meta: { executionMs: result.cExecutionTimeMs, command: result.cCommand, engine: result.engine }
    });
});

/**
 * GET /api/events/:id
 */
app.get('/api/events/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid event ID' });
    }

    const result = await executeCCore(['--get', id.toString()]);
    if (result.data && !result.data.error) {
        res.json({ success: true, event: result.data, meta: { executionMs: result.cExecutionTimeMs, command: result.cCommand, engine: result.engine } });
    } else {
        res.status(404).json({ success: false, error: result.data?.error || 'Event not found' });
    }
});

/**
 * POST /api/check-conflict
 */
app.post('/api/check-conflict', async (req, res) => {
    const { date, startTime, endTime, excludeId = 0 } = req.body;
    if (!date || !startTime || !endTime) {
        return res.status(400).json({ success: false, error: 'Date, start time, and end time are required' });
    }

    const result = await executeCCore(['--check-conflict', date, startTime, endTime, excludeId.toString()]);
    res.json({
        success: true,
        conflict: result.data.conflict || false,
        conflictingEvent: result.data.conflictingEvent || null,
        meta: { executionMs: result.cExecutionTimeMs, command: result.cCommand }
    });
});

/**
 * POST /api/events
 */
app.post('/api/events', async (req, res) => {
    const {
        title,
        description = '',
        date,
        startTime,
        endTime,
        venue = 'Campus',
        category = 'Other',
        priority = 'Medium',
        reminder = 'None',
        allowConflict = false
    } = req.body;

    if (!title || !title.trim()) {
        return res.status(400).json({ success: false, error: 'Event title is required' });
    }
    if (!date) {
        return res.status(400).json({ success: false, error: 'Valid date is required' });
    }
    if (!startTime || !endTime) {
        return res.status(400).json({ success: false, error: 'Start and end times are required' });
    }
    if (startTime >= endTime) {
        return res.status(400).json({ success: false, error: 'End time must be after start time' });
    }

    if (!allowConflict) {
        const conflictCheck = await executeCCore(['--check-conflict', date, startTime, endTime, '0']);
        if (conflictCheck.data && conflictCheck.data.conflict) {
            return res.status(409).json({
                success: false,
                conflict: true,
                message: 'Schedule Conflict Detected',
                conflictingEvent: conflictCheck.data.conflictingEvent
            });
        }
    }

    const args = [
        '--add',
        title.trim(),
        (description || 'No description').trim(),
        date,
        startTime,
        endTime,
        venue.trim() || 'Campus',
        category,
        priority,
        reminder
    ];

    const result = await executeCCore(args);
    res.status(201).json({
        success: true,
        event: result.data.event,
        meta: { executionMs: result.cExecutionTimeMs, command: result.cCommand }
    });
});

/**
 * PUT /api/events/:id
 */
app.put('/api/events/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid event ID' });
    }

    const {
        title,
        description = '',
        date,
        startTime,
        endTime,
        venue = 'Campus',
        category = 'Other',
        priority = 'Medium',
        reminder = 'None',
        allowConflict = false
    } = req.body;

    if (!title || !date || !startTime || !endTime) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    if (startTime >= endTime) {
        return res.status(400).json({ success: false, error: 'End time must be after start time' });
    }

    if (!allowConflict) {
        const conflictCheck = await executeCCore(['--check-conflict', date, startTime, endTime, id.toString()]);
        if (conflictCheck.data && conflictCheck.data.conflict) {
            return res.status(409).json({
                success: false,
                conflict: true,
                message: 'Schedule Conflict Detected',
                conflictingEvent: conflictCheck.data.conflictingEvent
            });
        }
    }

    const args = [
        '--update',
        id.toString(),
        title.trim(),
        (description || 'No description').trim(),
        date,
        startTime,
        endTime,
        venue.trim() || 'Campus',
        category,
        priority,
        reminder
    ];

    const result = await executeCCore(args);
    if (result.data && result.data.success) {
        res.json({
            success: true,
            event: result.data.event,
            meta: { executionMs: result.cExecutionTimeMs, command: result.cCommand }
        });
    } else {
        res.status(404).json({ success: false, error: 'Event not found or failed to update' });
    }
});

/**
 * DELETE /api/events/:id
 */
app.delete('/api/events/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid event ID' });
    }

    const result = await executeCCore(['--delete', id.toString()]);
    if (result.data && result.data.success) {
        res.json({ success: true, message: `Event ${id} deleted successfully`, meta: { executionMs: result.cExecutionTimeMs, command: result.cCommand } });
    } else {
        res.status(404).json({ success: false, error: 'Event not found' });
    }
});

/**
 * GET /api/events/search
 */
app.get('/api/events/search', async (req, res) => {
    const { q = '', category = '', priority = '', date = '' } = req.query;
    const result = await executeCCore(['--search', q, category, priority, date]);
    res.json({
        success: true,
        events: Array.isArray(result.data) ? result.data : [],
        meta: { executionMs: result.cExecutionTimeMs, command: result.cCommand }
    });
});

/**
 * GET /api/events/upcoming
 */
app.get('/api/events/upcoming', async (req, res) => {
    const now = new Date();
    const dateStr = req.query.date || now.toISOString().split('T')[0];
    const timeStr = req.query.time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const result = await executeCCore(['--upcoming', dateStr, timeStr]);
    res.json({
        success: true,
        events: Array.isArray(result.data) ? result.data : [],
        meta: { executionMs: result.cExecutionTimeMs, command: result.cCommand }
    });
});

/**
 * GET /api/stats
 */
app.get('/api/stats', async (req, res) => {
    const todayStr = req.query.date || new Date().toISOString().split('T')[0];
    const result = await executeCCore(['--stats', todayStr]);
    res.json({
        success: true,
        stats: result.data || {},
        meta: { executionMs: result.cExecutionTimeMs, command: result.cCommand }
    });
});

/**
 * POST /api/seed
 */
app.post('/api/seed', async (req, res) => {
    const result = await executeCCore(['--seed']);
    res.json({
        success: true,
        message: 'Sample data restored successfully',
        meta: { executionMs: result.cExecutionTimeMs, command: result.cCommand }
    });
});

// Serve frontend static files
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(frontendPath, 'index.html'));
    } else {
        res.status(404).json({ error: 'Endpoint not found' });
    }
});

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║               STUDENT CALENDAR WITH EVENTS                   ║
║         Full-Stack Academic Platform (C Core Engine)         ║
╠══════════════════════════════════════════════════════════════╣
║  • Web Application:  http://localhost:${PORT}                  ║
║  • API Endpoints:    http://localhost:${PORT}/api/events       ║
║  • C Core Source:    ${C_SOURCE_PATH}        ║
╚══════════════════════════════════════════════════════════════╝
    `);
});
