/**
 * ============================================================================
 * Student Calendar with Events - Core C Module (Header)
 * ============================================================================
 * Course/Project: Student Academic & Personal Event Management System
 * Description: Header file defining Event structures, constants, error codes,
 *              and function prototypes for C-based event processing.
 * ============================================================================
 */

#ifndef CALENDAR_H
#define CALENDAR_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <time.h>

#define MAX_EVENTS 1000
#define TITLE_LEN 100
#define DESC_LEN 300
#define DATE_LEN 20
#define TIME_LEN 10
#define VENUE_LEN 100
#define CAT_LEN 50
#define PRIORITY_LEN 20
#define REMINDER_LEN 30
#define DATA_FILE "data/events.dat"

/**
 * Event Structure
 * Represents a single academic or personal event for a student.
 */
typedef struct {
    int id;                         /* Unique numeric event ID */
    char title[TITLE_LEN];          /* Name / Title of event */
    char description[DESC_LEN];    /* Detailed description / notes */
    char date[DATE_LEN];            /* Format: YYYY-MM-DD */
    char startTime[TIME_LEN];       /* Format: HH:MM (24-hour) */
    char endTime[TIME_LEN];         /* Format: HH:MM (24-hour) */
    char venue[VENUE_LEN];          /* Classroom / Lab / Online link / Location */
    char category[CAT_LEN];         /* Exam, Assignment, College Event, Workshop, Project, Personal, Other */
    char priority[PRIORITY_LEN];    /* High, Medium, Low */
    char reminder[REMINDER_LEN];    /* None, 10m, 30m, 1h, 1d */
    int isDeleted;                  /* 0 = Active, 1 = Soft Deleted */
} Event;

/**
 * Statistics Structure
 * Aggregated summary information for dashboard reporting.
 */
typedef struct {
    int totalEvents;
    int todayEvents;
    int upcomingEvents;
    int examCount;
    int assignmentCount;
    int workshopCount;
    int projectCount;
    int collegeEventCount;
    int personalCount;
    int weekdayDistribution[7];     /* Index 0=Sun, 1=Mon, ..., 6=Sat */
} CalendarStats;

/**
 * Core Event Management Function Prototypes
 */

/* Initialization and Persistence */
int initStorage(void);
int loadEvents(Event events[], int *count);
int saveEvents(const Event events[], int count);
void seedSampleData(void);

/* CRUD Operations */
int addEvent(const Event *newEvent, int *generatedId);
int updateEvent(int id, const Event *updatedData);
int deleteEvent(int id);
int getEventById(int id, Event *result);

/* Querying, Searching, and Sorting */
int getAllActiveEvents(Event results[], int *resultCount);
int searchEvents(const char *keyword, const char *category, const char *priority, const char *date, Event results[], int *resultCount);
int getUpcomingEvents(const char *currentDate, const char *currentTime, Event results[], int *resultCount);
void sortEventsByDateTime(Event events[], int count);

/* Conflict Detection & Validation */
int checkConflict(const char *date, const char *startTime, const char *endTime, int excludeId, Event *conflictingEvent);
int isValidDate(const char *date);
int isValidTime(const char *timeStr);
int timeToMinutes(const char *timeStr);

/* Statistics */
void calculateStats(const char *todayDate, CalendarStats *stats);

/* JSON Output Helpers for Web Backend API Bridge */
void printEventJson(const Event *e);
void printEventsArrayJson(const Event events[], int count);
void printStatsJson(const CalendarStats *stats);

/* CLI and Interactive Modes for Viva Demonstration */
void runInteractiveCli(void);

#endif /* CALENDAR_H */
