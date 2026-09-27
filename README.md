# 📅 Student Calendar with Events

> A Modern Full-Stack Academic & Personal Event Management System powered by a **C Core Engine**.

![Project Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Language](https://img.shields.io/badge/C-C17%20Standard-blue)
![Frontend](https://img.shields.io/badge/Frontend-HTML5%20%2F%20CSS3%20%2F%20JavaScript-orange)
![Backend](https://img.shields.io/badge/Backend-Node.js%20Express%20Bridge-green)
![License](https://img.shields.io/badge/License-MIT-purple)

---

## 1. Project Description

**Student Calendar with Events** is a college academic productivity and scheduling platform. It combines a sleek, modern, responsive web application with structured **C-based calendar and event processing logic**. 

The system allows students to manage coursework, internal exams, lab assignments, project milestones, workshops, and extracurricular activities. The project is specifically engineered to be **viva-friendly**, clearly showcasing foundational C concepts like data structures (`struct`), sorting (`qsort`), date math, interval conflict detection, and file persistence (`fread`/`fwrite`).

---

## 2. Problem Statement

College students often struggle with juggling overlapping assignments, lab submissions, exam dates, and extracurricular events across different platforms. Most commercial calendar apps are overly generic or cluttered. This project solves this problem by providing a streamlined, student-centric academic planner with automated schedule conflict detection and timely reminders.

---

## 3. Objectives

- Develop a responsive web frontend for seamless student event management.
- Implement core data manipulation, sorting, and collision detection in standard **C**.
- Provide a robust API bridge between the browser UI and the C execution logic.
- Prevent double-booking with real-time schedule conflict warnings.
- Deliver an interactive terminal mode and architecture inspector for effortless college viva demonstrations.

---

## 4. Key Features

- 📅 **Interactive Calendar Grid**: Switch between Monthly, Weekly, and Daily views with today highlighting and quick date jumping.
- ⚡ **Schedule Conflict Detection**: Identifies overlapping event times on identical dates using standard interval algebra: `S1 < E2 && S2 < E1`.
- 📊 **Academic Dashboard**: Visualizes today's events, urgent deadlines, total workload counts, and day-by-day weekly distribution bars.
- 🏷️ **Color-Coded Categories**: Distinct visual badges for *Exams, Assignments, Workshops, Projects, College Events, and Personal Tasks*.
- ⏰ **Event Reminders**: Timed reminders (10m, 30m, 1h, 1d) with browser notifications and toast banners.
- 🔍 **Multi-Field Search & Filtering**: Real-time filtering by keyword, category, priority, and date.
- 💾 **Persistent Storage**: Retains events across restarts using binary (`events.dat`) and structured (`events.json`) storage.
- 🎓 **Viva Architecture Inspector**: Live in-app panel displaying C binary execution paths, struct layouts, and latency logs.
- 🌓 **Dark & Light Mode**: Accessible, modern themes with glassmorphic cards and fluid typography.

---

## 5. Technology Used

| Layer | Technologies |
|---|---|
| **Frontend** | HTML5 (Semantic), CSS3 (Modern Glassmorphic Design, Responsive Grid/Flexbox), Vanilla JavaScript (ES6+) |
| **Core Logic Engine** | C Programming (C17 Standard, GCC Compiler, Structs, File I/O, `qsort`) |
| **Backend / API Bridge** | Node.js, Express.js, Child Process Execution |
| **Data Storage** | Binary Struct File (`data/events.dat`) and JSON (`data/events.json`) |

---

## 6. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    STUDENT BROWSER CLIENT                   │
│  [ Dashboard ]  [ Calendar Views ]  [ Search ]  [ Viva UI ] │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP Fetch Requests (JSON)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                NODE.JS EXPRESS BRIDGE (server.js)            │
│  • REST Endpoints (/api/events, /api/check-conflict, etc.)   │
│  • JSON Serialization & Error Handling                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ CLI Execution / IPC Bridge
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 CORE C ENGINE (calendar_core.exe)            │
│  • struct Event { id, title, date, time, venue, ... }       │
│  • addEvent(), updateEvent(), deleteEvent()                 │
│  • checkConflict() [O(N) Overlap Detection]                 │
│  • sortEventsByDateTime() [qsort]                           │
│  • File Persistence (events.dat / events.json)              │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Folder Structure

```
Student Calendar with Events/
├── frontend/
│   ├── index.html          # Main responsive SPA containing all views & modals
│   ├── css/
│   │   └── style.css       # Complete modern design system (Light/Dark themes)
│   └── js/
│       ├── app.js          # Router, controllers, modal logic, reminders, viva inspector
│       ├── calendar.js     # Calendar grid renderer (Month/Week/Day)
│       └── events.js       # Client API module connecting to backend
│
├── backend/
│   └── server.js           # Express API bridge communicating with C engine
│
├── c-core/
│   ├── calendar.h          # C Header defining Event struct and function prototypes
│   ├── calendar.c          # C Implementation (CRUD, sorting, conflict detection, CLI)
│   └── calendar_core.exe   # Compiled C binary
│
├── data/
│   ├── events.json         # Persistent JSON dataset
│   └── events.dat          # Binary struct storage
│
├── build.bat               # Windows GCC compile script
├── Makefile                # Cross-platform compilation makefile
├── test_api.js             # Automated API verification test suite
├── package.json            # Node.js project manifest
└── README.md               # Complete documentation
```

---

## 8. How C is Used

The core event data structures and algorithms are implemented in `c-core/calendar.c` and `c-core/calendar.h`:

### The `Event` Structure:
```c
typedef struct {
    int id;                         /* Unique identifier */
    char title[100];                /* Event name */
    char description[300];          /* Detailed description */
    char date[20];                  /* Format: YYYY-MM-DD */
    char startTime[10];             /* Format: HH:MM */
    char endTime[10];               /* Format: HH:MM */
    char venue[100];                /* Location / Room */
    char category[50];              /* Exam, Assignment, Workshop, etc. */
    char priority[20];              /* High, Medium, Low */
    char reminder[30];              /* Notification lead time */
    int isDeleted;                  /* Soft delete flag */
} Event;
```

### Core C Functions:
1. `addEvent()`: Generates unique sequential IDs and appends new `struct Event` to storage.
2. `checkConflict()`: Evaluates time overlaps on identical dates:
   $$\text{Conflict} \iff (\text{newStart} < \text{curEnd}) \land (\text{curStart} < \text{newEnd})$$
3. `sortEventsByDateTime()`: Sorts active events chronologically using standard library `qsort()`.
4. `searchEvents()`: Performs case-insensitive substring search across titles, descriptions, venues, and categories.
5. `loadEvents()` & `saveEvents()`: Handles binary file persistence using `fread()` and `fwrite()`.
6. `runInteractiveCli()`: Standalone interactive terminal menu for project viva presentations.

---

## 9. How Frontend Communicates with Backend

1. When a user creates or edits an event, JavaScript sends a `POST /api/events` or `POST /api/check-conflict` request.
2. `server.js` processes the request and invokes `calendar_core.exe` with structured CLI flags (e.g. `--check-conflict "2026-09-28" "10:30" "11:30" 0`).
3. The C engine executes the conflict detection or CRUD logic and writes standard JSON formatted data to `stdout`.
4. Express parses the output, records execution metrics, and returns the response to the browser.
5. The frontend updates the DOM, calendar badges, statistics, and live Viva architecture logs without full-page reloads.

---

## 10. How to Install

### Prerequisites:
- **Node.js** (v16 or higher)
- **GCC Compiler** (MinGW / MSYS2 on Windows, or standard `gcc` on Linux/macOS)

### Installation Steps:
```bash
# 1. Clone or navigate to the project directory
cd "Student Calendar with Events"

# 2. Install Node.js dependencies
npm install

# 3. Compile the C-Core Module (optional; server auto-compiles if missing)
npm run build:c
# or run: gcc -Wall -Wextra -O2 c-core/calendar.c -o c-core/calendar_core.exe
```

---

## 11. How to Run

### Option A: Run the Complete Web Application (Recommended)
```bash
npm start
```
Open your browser and navigate to: **`http://localhost:3000`**

### Option B: Run the Pure C Interactive CLI Mode (For Viva Demonstration)
```bash
npm run c:cli
# or directly execute:
.\c-core\calendar_core.exe --interactive
```

### Option C: Run the Automated Integration Test Suite
```bash
node test_api.js
```

---

## 12. College Viva Presentation Guide

When demonstrating this project to professors/examiners:

1. **Architecture Explanation**: Open the web application and navigate to the **Settings & Viva Info** tab to show the live child process execution stream and C memory struct layout.
2. **Terminal C Demonstration**: Open a separate terminal and run `.\c-core\calendar_core.exe --interactive` to show that the C program works completely independently from the web layer.
3. **Conflict Detection Demo**: In the web UI, click **Add Event**, pick `2026-09-28` between `10:00` and `12:00` (which conflicts with the Data Structures Assignment), and show the real-time **Schedule Conflict Detected** warning banner.
4. **Code Walkthrough**: Highlight `c-core/calendar.c` functions (`checkConflict`, `sortEventsByDateTime`, `loadEvents`, `saveEvents`).

---

## 13. Future Enhancements

- 🔄 Two-way Google Calendar & Outlook ICS sync.
- 👥 Multi-user student account authentication and role-based access.
- 📱 Progressive Web App (PWA) offline support with service workers.
- 📊 Semester GPA and study hours correlation analytics.
