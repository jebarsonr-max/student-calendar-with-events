/**
 * ============================================================================
 * Student Calendar with Events - Core C Module Implementation
 * ============================================================================
 * Course/Project: Student Academic & Personal Event Management System
 * Author: Antigravity Student Calendar Engineering Team
 * Description: Core C logic managing calendar events, conflict detection,
 *              date comparison, chronological sorting, binary/file persistence,
 *              and bridging with the web application via JSON interface.
 * ============================================================================
 */

#include "calendar.h"
#include <ctype.h>

#ifdef _WIN32
#include <direct.h>
#define MKDIR(dir) _mkdir(dir)
#else
#include <sys/stat.h>
#define MKDIR(dir) mkdir(dir, 0755)
#endif

/* Helper to convert string to lowercase for case-insensitive search */
static void toLowerCase(char *dest, const char *src, size_t maxLen) {
    size_t i = 0;
    while (src[i] != '\0' && i < maxLen - 1) {
        dest[i] = (char)tolower((unsigned char)src[i]);
        i++;
    }
    dest[i] = '\0';
}

/* Helper to escape quotes for JSON string output */
static void printEscapedJsonString(const char *str) {
    if (!str) {
        printf("\"\"");
        return;
    }
    putchar('\"');
    for (size_t i = 0; str[i] != '\0'; i++) {
        if (str[i] == '\"') {
            printf("\\\"");
        } else if (str[i] == '\\') {
            printf("\\\\");
        } else if (str[i] == '\n') {
            printf("\\n");
        } else if (str[i] == '\r') {
            printf("\\r");
        } else if (str[i] == '\t') {
            printf("\\t");
        } else {
            putchar(str[i]);
        }
    }
    putchar('\"');
}

/**
 * Ensures data directory exists
 */
static void ensureDataDirectory(void) {
    MKDIR("data");
}

/**
 * Initializes data storage file if it does not already exist.
 * Seeds with initial academic sample data.
 */
int initStorage(void) {
    ensureDataDirectory();
    FILE *fp = fopen(DATA_FILE, "rb");
    if (!fp) {
        /* File does not exist, seed initial sample data */
        seedSampleData();
        return 1;
    }
    fclose(fp);
    return 0;
}

/**
 * Loads all events from the binary storage file into an array.
 */
int loadEvents(Event events[], int *count) {
    ensureDataDirectory();
    *count = 0;
    FILE *fp = fopen(DATA_FILE, "rb");
    if (!fp) {
        return -1;
    }

    int readCount = (int)fread(events, sizeof(Event), MAX_EVENTS, fp);
    fclose(fp);

    *count = readCount;
    return 0;
}

/**
 * Saves all events from the array into the binary storage file.
 */
int saveEvents(const Event events[], int count) {
    ensureDataDirectory();
    FILE *fp = fopen(DATA_FILE, "wb");
    if (!fp) {
        return -1;
    }

    size_t written = fwrite(events, sizeof(Event), count, fp);
    fclose(fp);

    return (written == (size_t)count) ? 0 : -1;
}

/**
 * Convert HH:MM time string to total minutes from midnight for easy math
 */
int timeToMinutes(const char *timeStr) {
    if (!timeStr || strlen(timeStr) < 4) return -1;
    int h = 0, m = 0;
    if (sscanf(timeStr, "%d:%d", &h, &m) == 2) {
        return h * 60 + m;
    }
    return -1;
}

/**
 * Simple format validator for YYYY-MM-DD
 */
int isValidDate(const char *date) {
    if (!date || strlen(date) != 10) return 0;
    if (date[4] != '-' || date[7] != '-') return 0;
    for (int i = 0; i < 10; i++) {
        if (i == 4 || i == 7) continue;
        if (!isdigit((unsigned char)date[i])) return 0;
    }
    int y, m, d;
    if (sscanf(date, "%d-%d-%d", &y, &m, &d) == 3) {
        if (m < 1 || m > 12) return 0;
        if (d < 1 || d > 31) return 0;
        return 1;
    }
    return 0;
}

/**
 * Simple format validator for HH:MM
 */
int isValidTime(const char *timeStr) {
    if (!timeStr || strlen(timeStr) < 4 || strlen(timeStr) > 5) return 0;
    int h, m;
    if (sscanf(timeStr, "%d:%d", &h, &m) == 2) {
        if (h >= 0 && h < 24 && m >= 0 && m < 60) return 1;
    }
    return 0;
}

/**
 * Detects time conflict for an event on a given date.
 * Two intervals [S1, E1] and [S2, E2] overlap if: S1 < E2 && S2 < E1.
 * Returns 1 if conflict found, 0 if no conflict.
 */
int checkConflict(const char *date, const char *startTime, const char *endTime, int excludeId, Event *conflictingEvent) {
    if (!date || !startTime || !endTime) return 0;

    int newStart = timeToMinutes(startTime);
    int newEnd = timeToMinutes(endTime);
    if (newStart < 0 || newEnd <= newStart) return 0;

    Event events[MAX_EVENTS];
    int count = 0;
    if (loadEvents(events, &count) != 0) return 0;

    for (int i = 0; i < count; i++) {
        if (events[i].isDeleted) continue;
        if (excludeId > 0 && events[i].id == excludeId) continue;

        if (strcmp(events[i].date, date) == 0) {
            int curStart = timeToMinutes(events[i].startTime);
            int curEnd = timeToMinutes(events[i].endTime);

            if (curStart >= 0 && curEnd > curStart) {
                /* Overlap condition */
                if (newStart < curEnd && curStart < newEnd) {
                    if (conflictingEvent) {
                        *conflictingEvent = events[i];
                    }
                    return 1; /* Conflict detected */
                }
            }
        }
    }
    return 0; /* No conflict */
}

/**
 * Chronological comparison function for sorting events
 */
static int compareEventsChronological(const void *a, const void *b) {
    const Event *ea = (const Event *)a;
    const Event *eb = (const Event *)b;

    int dateCmp = strcmp(ea->date, eb->date);
    if (dateCmp != 0) return dateCmp;

    return strcmp(ea->startTime, eb->startTime);
}

/**
 * Sorts array of events in ascending chronological order (Date then StartTime)
 */
void sortEventsByDateTime(Event events[], int count) {
    if (count > 1) {
        qsort(events, count, sizeof(Event), compareEventsChronological);
    }
}

/**
 * Adds a new event to the storage
 */
int addEvent(const Event *newEvent, int *generatedId) {
    Event events[MAX_EVENTS];
    int count = 0;
    loadEvents(events, &count);

    if (count >= MAX_EVENTS) {
        return -1; /* Storage limit reached */
    }

    /* Generate new unique ID */
    int maxId = 0;
    for (int i = 0; i < count; i++) {
        if (events[i].id > maxId) {
            maxId = events[i].id;
        }
    }
    int newId = maxId + 1;

    Event toStore = *newEvent;
    toStore.id = newId;
    toStore.isDeleted = 0;

    events[count] = toStore;
    count++;

    if (saveEvents(events, count) != 0) {
        return -2;
    }

    if (generatedId) {
        *generatedId = newId;
    }
    return 0;
}

/**
 * Updates an existing event
 */
int updateEvent(int id, const Event *updatedData) {
    Event events[MAX_EVENTS];
    int count = 0;
    if (loadEvents(events, &count) != 0) return -1;

    int foundIdx = -1;
    for (int i = 0; i < count; i++) {
        if (events[i].id == id && !events[i].isDeleted) {
            foundIdx = i;
            break;
        }
    }

    if (foundIdx == -1) {
        return -2; /* Event not found */
    }

    /* Preserve original ID and deleted state */
    Event target = *updatedData;
    target.id = id;
    target.isDeleted = 0;

    events[foundIdx] = target;
    return saveEvents(events, count);
}

/**
 * Soft-deletes an event by ID
 */
int deleteEvent(int id) {
    Event events[MAX_EVENTS];
    int count = 0;
    if (loadEvents(events, &count) != 0) return -1;

    int found = 0;
    for (int i = 0; i < count; i++) {
        if (events[i].id == id && !events[i].isDeleted) {
            events[i].isDeleted = 1;
            found = 1;
            break;
        }
    }

    if (!found) return -2;
    return saveEvents(events, count);
}

/**
 * Gets a single event by ID
 */
int getEventById(int id, Event *result) {
    Event events[MAX_EVENTS];
    int count = 0;
    if (loadEvents(events, &count) != 0) return -1;

    for (int i = 0; i < count; i++) {
        if (events[i].id == id && !events[i].isDeleted) {
            if (result) *result = events[i];
            return 0;
        }
    }
    return -2;
}

/**
 * Retrieves all active non-deleted events, sorted chronologically
 */
int getAllActiveEvents(Event results[], int *resultCount) {
    Event events[MAX_EVENTS];
    int count = 0;
    *resultCount = 0;
    if (loadEvents(events, &count) != 0) return -1;

    int activeCount = 0;
    for (int i = 0; i < count; i++) {
        if (!events[i].isDeleted) {
            results[activeCount++] = events[i];
        }
    }

    sortEventsByDateTime(results, activeCount);
    *resultCount = activeCount;
    return 0;
}

/**
 * Searches events by keyword (in title, desc, venue, category), category, priority, and date
 */
int searchEvents(const char *keyword, const char *category, const char *priority, const char *date, Event results[], int *resultCount) {
    Event events[MAX_EVENTS];
    int count = 0;
    *resultCount = 0;
    if (loadEvents(events, &count) != 0) return -1;

    char keyLow[128] = "";
    if (keyword && strlen(keyword) > 0) {
        toLowerCase(keyLow, keyword, sizeof(keyLow));
    }

    int matchCount = 0;
    for (int i = 0; i < count; i++) {
        if (events[i].isDeleted) continue;

        /* Filter by category if specified */
        if (category && strlen(category) > 0 && strcmp(category, "All") != 0 && strcmp(category, "all") != 0) {
            if (strcasecmp(events[i].category, category) != 0) continue;
        }

        /* Filter by priority if specified */
        if (priority && strlen(priority) > 0 && strcmp(priority, "All") != 0 && strcmp(priority, "all") != 0) {
            if (strcasecmp(events[i].priority, priority) != 0) continue;
        }

        /* Filter by exact date if specified */
        if (date && strlen(date) > 0) {
            if (strcmp(events[i].date, date) != 0) continue;
        }

        /* Filter by text keyword */
        if (strlen(keyLow) > 0) {
            char titleLow[TITLE_LEN], descLow[DESC_LEN], venueLow[VENUE_LEN], catLow[CAT_LEN];
            toLowerCase(titleLow, events[i].title, sizeof(titleLow));
            toLowerCase(descLow, events[i].description, sizeof(descLow));
            toLowerCase(venueLow, events[i].venue, sizeof(venueLow));
            toLowerCase(catLow, events[i].category, sizeof(catLow));

            if (!strstr(titleLow, keyLow) && !strstr(descLow, keyLow) &&
                !strstr(venueLow, keyLow) && !strstr(catLow, keyLow)) {
                continue;
            }
        }

        results[matchCount++] = events[i];
    }

    sortEventsByDateTime(results, matchCount);
    *resultCount = matchCount;
    return 0;
}

/**
 * Retrieves upcoming events starting on or after currentDate
 */
int getUpcomingEvents(const char *currentDate, const char *currentTime, Event results[], int *resultCount) {
    Event events[MAX_EVENTS];
    int count = 0;
    *resultCount = 0;
    if (loadEvents(events, &count) != 0) return -1;

    char curDate[20] = "";
    if (currentDate && strlen(currentDate) >= 10) {
        strncpy(curDate, currentDate, 10);
        curDate[10] = '\0';
    } else {
        time_t t = time(NULL);
        struct tm *tm = localtime(&t);
        strftime(curDate, sizeof(curDate), "%Y-%m-%d", tm);
    }

    int matchCount = 0;
    for (int i = 0; i < count; i++) {
        if (events[i].isDeleted) continue;

        int dateCmp = strcmp(events[i].date, curDate);
        if (dateCmp > 0) {
            results[matchCount++] = events[i];
        } else if (dateCmp == 0) {
            /* Same date: check start time if provided */
            if (currentTime && strlen(currentTime) >= 4) {
                if (strcmp(events[i].endTime, currentTime) >= 0 || strcmp(events[i].startTime, currentTime) >= 0) {
                    results[matchCount++] = events[i];
                }
            } else {
                results[matchCount++] = events[i];
            }
        }
    }

    sortEventsByDateTime(results, matchCount);
    *resultCount = matchCount;
    return 0;
}

/**
 * Helper to get day of week (0=Sun, 1=Mon, ..., 6=Sat) from YYYY-MM-DD
 */
static int getDayOfWeek(const char *dateStr) {
    int y, m, d;
    if (sscanf(dateStr, "%d-%d-%d", &y, &m, &d) != 3) return 0;
    struct tm t = {0};
    t.tm_year = y - 1900;
    t.tm_mon = m - 1;
    t.tm_mday = d;
    t.tm_isdst = -1;
    mktime(&t);
    return t.tm_wday;
}

/**
 * Calculates dashboard statistics
 */
void calculateStats(const char *todayDate, CalendarStats *stats) {
    memset(stats, 0, sizeof(CalendarStats));

    char refDate[20] = "";
    if (todayDate && strlen(todayDate) >= 10) {
        strncpy(refDate, todayDate, 10);
        refDate[10] = '\0';
    } else {
        time_t t = time(NULL);
        struct tm *tm = localtime(&t);
        strftime(refDate, sizeof(refDate), "%Y-%m-%d", tm);
    }

    Event events[MAX_EVENTS];
    int count = 0;
    loadEvents(events, &count);

    for (int i = 0; i < count; i++) {
        if (events[i].isDeleted) continue;

        stats->totalEvents++;

        int dateCmp = strcmp(events[i].date, refDate);
        if (dateCmp == 0) {
            stats->todayEvents++;
        }
        if (dateCmp >= 0) {
            stats->upcomingEvents++;
        }

        /* Category counters */
        if (strcasecmp(events[i].category, "Exam") == 0) stats->examCount++;
        else if (strcasecmp(events[i].category, "Assignment") == 0) stats->assignmentCount++;
        else if (strcasecmp(events[i].category, "Workshop") == 0) stats->workshopCount++;
        else if (strcasecmp(events[i].category, "Project") == 0) stats->projectCount++;
        else if (strcasecmp(events[i].category, "College Event") == 0) stats->collegeEventCount++;
        else if (strcasecmp(events[i].category, "Personal") == 0) stats->personalCount++;

        /* Weekday distribution */
        int wday = getDayOfWeek(events[i].date);
        if (wday >= 0 && wday < 7) {
            stats->weekdayDistribution[wday]++;
        }
    }
}

/**
 * Seeds sample college events
 */
void seedSampleData(void) {
    Event samples[] = {
        {
            .id = 1,
            .title = "Data Structures Assignment",
            .description = "Implement Binary Search Trees and AVL balance rotations in C. Submit via college portal.",
            .date = "2026-09-28",
            .startTime = "10:00",
            .endTime = "12:00",
            .venue = "CS Lab 3 / Online Submission",
            .category = "Assignment",
            .priority = "High",
            .reminder = "1 hour before",
            .isDeleted = 0
        },
        {
            .id = 2,
            .title = "AI & Machine Learning Workshop",
            .description = "Hands-on session on Neural Networks and Transformer Architectures with industry experts.",
            .date = "2026-09-29",
            .startTime = "14:00",
            .endTime = "16:30",
            .venue = "Auditorium Hall B",
            .category = "Workshop",
            .priority = "Medium",
            .reminder = "30 minutes before",
            .isDeleted = 0
        },
        {
            .id = 3,
            .title = "Mathematics Internal Exam",
            .description = "Semester Midterm covering Linear Algebra, Eigenvalues, and Fourier Series.",
            .date = "2026-10-02",
            .startTime = "09:00",
            .endTime = "11:00",
            .venue = "Examination Hall 104",
            .category = "Exam",
            .priority = "High",
            .reminder = "1 day before",
            .isDeleted = 0
        },
        {
            .id = 4,
            .title = "Capstone Project Review",
            .description = "Demonstrate working prototype of Full-Stack Student Calendar with C Backend.",
            .date = "2026-10-05",
            .startTime = "16:00",
            .endTime = "17:30",
            .venue = "Faculty Conference Room",
            .category = "Project",
            .priority = "High",
            .reminder = "1 hour before",
            .isDeleted = 0
        },
        {
            .id = 5,
            .title = "Annual Tech Fest Inception",
            .description = "Inauguration ceremony for annual inter-college hackathon and technical symposium.",
            .date = "2026-10-10",
            .startTime = "09:30",
            .endTime = "13:00",
            .venue = "Main Campus Arena",
            .category = "College Event",
            .priority = "Medium",
            .reminder = "1 day before",
            .isDeleted = 0
        },
        {
            .id = 6,
            .title = "Library Study Group",
            .description = "Review Operating System concepts and Process Scheduling algorithms.",
            .date = "2026-09-28",
            .startTime = "15:00",
            .endTime = "17:00",
            .venue = "Central Library Floor 2",
            .category = "Personal",
            .priority = "Low",
            .reminder = "10 minutes before",
            .isDeleted = 0
        }
    };

    int sampleCount = sizeof(samples) / sizeof(samples[0]);
    saveEvents(samples, sampleCount);
}

/**
 * JSON Formatting Functions
 */

void printEventJson(const Event *e) {
    if (!e) {
        printf("null");
        return;
    }
    printf("{\n");
    printf("  \"id\": %d,\n", e->id);
    printf("  \"title\": "); printEscapedJsonString(e->title); printf(",\n");
    printf("  \"description\": "); printEscapedJsonString(e->description); printf(",\n");
    printf("  \"date\": "); printEscapedJsonString(e->date); printf(",\n");
    printf("  \"startTime\": "); printEscapedJsonString(e->startTime); printf(",\n");
    printf("  \"endTime\": "); printEscapedJsonString(e->endTime); printf(",\n");
    printf("  \"venue\": "); printEscapedJsonString(e->venue); printf(",\n");
    printf("  \"category\": "); printEscapedJsonString(e->category); printf(",\n");
    printf("  \"priority\": "); printEscapedJsonString(e->priority); printf(",\n");
    printf("  \"reminder\": "); printEscapedJsonString(e->reminder); printf(",\n");
    printf("  \"isDeleted\": %d\n", e->isDeleted);
    printf("}");
}

void printEventsArrayJson(const Event events[], int count) {
    printf("[\n");
    for (int i = 0; i < count; i++) {
        printEventJson(&events[i]);
        if (i < count - 1) printf(",\n");
        else printf("\n");
    }
    printf("]\n");
}

void printStatsJson(const CalendarStats *stats) {
    printf("{\n");
    printf("  \"totalEvents\": %d,\n", stats->totalEvents);
    printf("  \"todayEvents\": %d,\n", stats->todayEvents);
    printf("  \"upcomingEvents\": %d,\n", stats->upcomingEvents);
    printf("  \"examCount\": %d,\n", stats->examCount);
    printf("  \"assignmentCount\": %d,\n", stats->assignmentCount);
    printf("  \"workshopCount\": %d,\n", stats->workshopCount);
    printf("  \"projectCount\": %d,\n", stats->projectCount);
    printf("  \"collegeEventCount\": %d,\n", stats->collegeEventCount);
    printf("  \"personalCount\": %d,\n", stats->personalCount);
    printf("  \"weekdayDistribution\": [%d, %d, %d, %d, %d, %d, %d]\n",
           stats->weekdayDistribution[0], stats->weekdayDistribution[1],
           stats->weekdayDistribution[2], stats->weekdayDistribution[3],
           stats->weekdayDistribution[4], stats->weekdayDistribution[5],
           stats->weekdayDistribution[6]);
    printf("}\n");
}

/**
 * Interactive Terminal CLI for College Viva Demonstration
 */
void runInteractiveCli(void) {
    initStorage();
    int choice = 0;
    while (1) {
        printf("\n======================================================\n");
        printf("       STUDENT CALENDAR & EVENT MANAGEMENT (C CORE)   \n");
        printf("======================================================\n");
        printf("1. View All Active Events\n");
        printf("2. Add New Event\n");
        printf("3. Update Event\n");
        printf("4. Delete Event\n");
        printf("5. Search Events\n");
        printf("6. Check Conflict for a Time Slot\n");
        printf("7. View Calendar Statistics\n");
        printf("8. Reset / Seed Sample Data\n");
        printf("9. Exit Interactive Mode\n");
        printf("Enter your choice (1-9): ");
        if (scanf("%d", &choice) != 1) {
            while (getchar() != '\n');
            continue;
        }
        while (getchar() != '\n'); /* Flush newline */

        if (choice == 1) {
            Event events[MAX_EVENTS];
            int count = 0;
            getAllActiveEvents(events, &count);
            printf("\n--- TOTAL ACTIVE EVENTS: %d ---\n", count);
            for (int i = 0; i < count; i++) {
                printf("[%d] %s (%s %s-%s) | %s | %s | %s\n",
                       events[i].id, events[i].title, events[i].date,
                       events[i].startTime, events[i].endTime,
                       events[i].category, events[i].priority, events[i].venue);
            }
        } else if (choice == 2) {
            Event e = {0};
            printf("Enter Event Title: ");
            fgets(e.title, sizeof(e.title), stdin);
            e.title[strcspn(e.title, "\r\n")] = 0;

            printf("Enter Description: ");
            fgets(e.description, sizeof(e.description), stdin);
            e.description[strcspn(e.description, "\r\n")] = 0;

            printf("Enter Date (YYYY-MM-DD): ");
            fgets(e.date, sizeof(e.date), stdin);
            e.date[strcspn(e.date, "\r\n")] = 0;

            printf("Enter Start Time (HH:MM): ");
            fgets(e.startTime, sizeof(e.startTime), stdin);
            e.startTime[strcspn(e.startTime, "\r\n")] = 0;

            printf("Enter End Time (HH:MM): ");
            fgets(e.endTime, sizeof(e.endTime), stdin);
            e.endTime[strcspn(e.endTime, "\r\n")] = 0;

            printf("Enter Venue: ");
            fgets(e.venue, sizeof(e.venue), stdin);
            e.venue[strcspn(e.venue, "\r\n")] = 0;

            printf("Enter Category (Exam/Assignment/College Event/Workshop/Project/Personal/Other): ");
            fgets(e.category, sizeof(e.category), stdin);
            e.category[strcspn(e.category, "\r\n")] = 0;

            printf("Enter Priority (High/Medium/Low): ");
            fgets(e.priority, sizeof(e.priority), stdin);
            e.priority[strcspn(e.priority, "\r\n")] = 0;

            printf("Enter Reminder (None/10 minutes before/30 minutes before/1 hour before/1 day before): ");
            fgets(e.reminder, sizeof(e.reminder), stdin);
            e.reminder[strcspn(e.reminder, "\r\n")] = 0;

            Event conflict;
            if (checkConflict(e.date, e.startTime, e.endTime, 0, &conflict)) {
                printf("\n[WARNING] Schedule Conflict Detected with Event #%d: '%s' (%s to %s)!\n",
                       conflict.id, conflict.title, conflict.startTime, conflict.endTime);
                printf("Do you still want to proceed? (y/n): ");
                char confirm = getchar();
                while (getchar() != '\n');
                if (confirm != 'y' && confirm != 'Y') {
                    printf("Cancelled.\n");
                    continue;
                }
            }

            int newId = 0;
            if (addEvent(&e, &newId) == 0) {
                printf("\n[SUCCESS] Event added successfully with ID #%d!\n", newId);
            } else {
                printf("\n[ERROR] Failed to save event.\n");
            }
        } else if (choice == 3) {
            int id = 0;
            printf("Enter Event ID to update: ");
            if (scanf("%d", &id) != 1) continue;
            while (getchar() != '\n');

            Event existing;
            if (getEventById(id, &existing) != 0) {
                printf("\n[ERROR] Event ID #%d not found!\n", id);
                continue;
            }

            Event e = existing;
            char buffer[300];

            printf("Title [%s]: ", existing.title);
            fgets(buffer, sizeof(buffer), stdin);
            buffer[strcspn(buffer, "\r\n")] = 0;
            if (strlen(buffer) > 0) strcpy(e.title, buffer);

            printf("Date [%s]: ", existing.date);
            fgets(buffer, sizeof(buffer), stdin);
            buffer[strcspn(buffer, "\r\n")] = 0;
            if (strlen(buffer) > 0) strcpy(e.date, buffer);

            printf("Start Time [%s]: ", existing.startTime);
            fgets(buffer, sizeof(buffer), stdin);
            buffer[strcspn(buffer, "\r\n")] = 0;
            if (strlen(buffer) > 0) strcpy(e.startTime, buffer);

            printf("End Time [%s]: ", existing.endTime);
            fgets(buffer, sizeof(buffer), stdin);
            buffer[strcspn(buffer, "\r\n")] = 0;
            if (strlen(buffer) > 0) strcpy(e.endTime, buffer);

            if (updateEvent(id, &e) == 0) {
                printf("\n[SUCCESS] Event #%d updated successfully!\n", id);
            } else {
                printf("\n[ERROR] Failed to update event.\n");
            }
        } else if (choice == 4) {
            int id = 0;
            printf("Enter Event ID to delete: ");
            if (scanf("%d", &id) != 1) continue;
            while (getchar() != '\n');

            if (deleteEvent(id) == 0) {
                printf("\n[SUCCESS] Event #%d deleted successfully.\n", id);
            } else {
                printf("\n[ERROR] Event ID #%d not found.\n", id);
            }
        } else if (choice == 5) {
            char kw[100];
            printf("Enter search keyword (or press Enter for all): ");
            fgets(kw, sizeof(kw), stdin);
            kw[strcspn(kw, "\r\n")] = 0;

            Event results[MAX_EVENTS];
            int resCount = 0;
            searchEvents(kw, NULL, NULL, NULL, results, &resCount);

            printf("\n--- %d MATCHES FOUND ---\n", resCount);
            for (int i = 0; i < resCount; i++) {
                printf("[%d] %s (%s %s-%s) | %s | %s\n",
                       results[i].id, results[i].title, results[i].date,
                       results[i].startTime, results[i].endTime,
                       results[i].category, results[i].venue);
            }
        } else if (choice == 6) {
            char date[20], start[10], end[10];
            printf("Enter Date (YYYY-MM-DD): ");
            fgets(date, sizeof(date), stdin);
            date[strcspn(date, "\r\n")] = 0;

            printf("Enter Start Time (HH:MM): ");
            fgets(start, sizeof(start), stdin);
            start[strcspn(start, "\r\n")] = 0;

            printf("Enter End Time (HH:MM): ");
            fgets(end, sizeof(end), stdin);
            end[strcspn(end, "\r\n")] = 0;

            Event conflict;
            if (checkConflict(date, start, end, 0, &conflict)) {
                printf("\n[!] CONFLICT DETECTED with: '%s' (%s to %s) [ID: %d]\n",
                       conflict.title, conflict.startTime, conflict.endTime, conflict.id);
            } else {
                printf("\n[OK] Slot is FREE. No schedule conflicts detected.\n");
            }
        } else if (choice == 7) {
            CalendarStats stats;
            calculateStats(NULL, &stats);
            printf("\n--- CALENDAR SUMMARY STATISTICS ---\n");
            printf("Total Events:      %d\n", stats.totalEvents);
            printf("Today's Events:    %d\n", stats.todayEvents);
            printf("Upcoming Events:   %d\n", stats.upcomingEvents);
            printf("Exams:             %d\n", stats.examCount);
            printf("Assignments:       %d\n", stats.assignmentCount);
            printf("Workshops:         %d\n", stats.workshopCount);
            printf("Projects:          %d\n", stats.projectCount);
            printf("College Events:    %d\n", stats.collegeEventCount);
            printf("Personal Tasks:    %d\n", stats.personalCount);
        } else if (choice == 8) {
            seedSampleData();
            printf("\n[SUCCESS] Sample event dataset restored.\n");
        } else if (choice == 9) {
            printf("Exiting interactive mode.\n");
            break;
        }
    }
}

/**
 * Main Entry Point for CLI & Bridge Operations
 */
int main(int argc, char *argv[]) {
    initStorage();

    if (argc <= 1 || strcmp(argv[1], "--help") == 0) {
        printf("Student Calendar Core C Engine v1.0\n");
        printf("Usage:\n");
        printf("  --interactive                       Launch terminal UI for Viva\n");
        printf("  --list                              Output all active events in JSON\n");
        printf("  --get <id>                          Output single event in JSON\n");
        printf("  --add <title> <desc> <date> <start> <end> <venue> <cat> <priority> <reminder>\n");
        printf("  --update <id> <title> <desc> <date> <start> <end> <venue> <cat> <priority> <reminder>\n");
        printf("  --delete <id>                       Delete event by ID\n");
        printf("  --search <keyword> [cat] [pri] [dt] Search events with filters\n");
        printf("  --upcoming [date] [time]            Get upcoming events from date/time\n");
        printf("  --stats [date]                      Get calendar stats JSON\n");
        printf("  --check-conflict <date> <start> <end> [excludeId]\n");
        printf("  --seed                              Reset to default sample data\n");
        return 0;
    }

    if (strcmp(argv[1], "--interactive") == 0) {
        runInteractiveCli();
        return 0;
    }

    if (strcmp(argv[1], "--list") == 0) {
        Event events[MAX_EVENTS];
        int count = 0;
        getAllActiveEvents(events, &count);
        printEventsArrayJson(events, count);
        return 0;
    }

    if (strcmp(argv[1], "--get") == 0 && argc >= 3) {
        int id = atoi(argv[2]);
        Event e;
        if (getEventById(id, &e) == 0) {
            printEventJson(&e);
            printf("\n");
            return 0;
        } else {
            printf("{\"error\": \"Event not found\", \"id\": %d}\n", id);
            return 1;
        }
    }

    if (strcmp(argv[1], "--add") == 0 && argc >= 11) {
        Event e = {0};
        strncpy(e.title, argv[2], sizeof(e.title) - 1);
        strncpy(e.description, argv[3], sizeof(e.description) - 1);
        strncpy(e.date, argv[4], sizeof(e.date) - 1);
        strncpy(e.startTime, argv[5], sizeof(e.startTime) - 1);
        strncpy(e.endTime, argv[6], sizeof(e.endTime) - 1);
        strncpy(e.venue, argv[7], sizeof(e.venue) - 1);
        strncpy(e.category, argv[8], sizeof(e.category) - 1);
        strncpy(e.priority, argv[9], sizeof(e.priority) - 1);
        strncpy(e.reminder, argv[10], sizeof(e.reminder) - 1);
        e.isDeleted = 0;

        int newId = 0;
        int status = addEvent(&e, &newId);
        if (status == 0) {
            e.id = newId;
            printf("{\"success\": true, \"message\": \"Event added\", \"event\": ");
            printEventJson(&e);
            printf("}\n");
            return 0;
        } else {
            printf("{\"success\": false, \"error\": \"Failed to add event\"}\n");
            return 1;
        }
    }

    if (strcmp(argv[1], "--update") == 0 && argc >= 12) {
        int id = atoi(argv[2]);
        Event e = {0};
        e.id = id;
        strncpy(e.title, argv[3], sizeof(e.title) - 1);
        strncpy(e.description, argv[4], sizeof(e.description) - 1);
        strncpy(e.date, argv[5], sizeof(e.date) - 1);
        strncpy(e.startTime, argv[6], sizeof(e.startTime) - 1);
        strncpy(e.endTime, argv[7], sizeof(e.endTime) - 1);
        strncpy(e.venue, argv[8], sizeof(e.venue) - 1);
        strncpy(e.category, argv[9], sizeof(e.category) - 1);
        strncpy(e.priority, argv[10], sizeof(e.priority) - 1);
        strncpy(e.reminder, argv[11], sizeof(e.reminder) - 1);
        e.isDeleted = 0;

        int status = updateEvent(id, &e);
        if (status == 0) {
            printf("{\"success\": true, \"message\": \"Event updated\", \"event\": ");
            printEventJson(&e);
            printf("}\n");
            return 0;
        } else {
            printf("{\"success\": false, \"error\": \"Event not found or failed to update\"}\n");
            return 1;
        }
    }

    if (strcmp(argv[1], "--delete") == 0 && argc >= 3) {
        int id = atoi(argv[2]);
        int status = deleteEvent(id);
        if (status == 0) {
            printf("{\"success\": true, \"message\": \"Event deleted\", \"id\": %d}\n", id);
            return 0;
        } else {
            printf("{\"success\": false, \"error\": \"Event not found\", \"id\": %d}\n", id);
            return 1;
        }
    }

    if (strcmp(argv[1], "--search") == 0) {
        const char *kw = (argc >= 3) ? argv[2] : "";
        const char *cat = (argc >= 4) ? argv[3] : "";
        const char *pri = (argc >= 5) ? argv[4] : "";
        const char *dt = (argc >= 6) ? argv[5] : "";

        Event results[MAX_EVENTS];
        int count = 0;
        searchEvents(kw, cat, pri, dt, results, &count);
        printEventsArrayJson(results, count);
        return 0;
    }

    if (strcmp(argv[1], "--upcoming") == 0) {
        const char *dt = (argc >= 3) ? argv[2] : NULL;
        const char *tm = (argc >= 4) ? argv[3] : NULL;

        Event results[MAX_EVENTS];
        int count = 0;
        getUpcomingEvents(dt, tm, results, &count);
        printEventsArrayJson(results, count);
        return 0;
    }

    if (strcmp(argv[1], "--stats") == 0) {
        const char *dt = (argc >= 3) ? argv[2] : NULL;
        CalendarStats stats;
        calculateStats(dt, &stats);
        printStatsJson(&stats);
        return 0;
    }

    if (strcmp(argv[1], "--check-conflict") == 0 && argc >= 5) {
        const char *dt = argv[2];
        const char *st = argv[3];
        const char *et = argv[4];
        int excludeId = (argc >= 6) ? atoi(argv[5]) : 0;

        Event conflict;
        int hasConflict = checkConflict(dt, st, et, excludeId, &conflict);
        if (hasConflict) {
            printf("{\"conflict\": true, \"conflictingEvent\": ");
            printEventJson(&conflict);
            printf("}\n");
        } else {
            printf("{\"conflict\": false, \"message\": \"No conflict detected\"}\n");
        }
        return 0;
    }

    if (strcmp(argv[1], "--seed") == 0) {
        seedSampleData();
        printf("{\"success\": true, \"message\": \"Sample data seeded successfully\"}\n");
        return 0;
    }

    printf("{\"error\": \"Unknown command\"}\n");
    return 1;
}
