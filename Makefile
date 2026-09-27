CC = gcc
CFLAGS = -Wall -Wextra -O2
SRC = c-core/calendar.c
HDR = c-core/calendar.h
TARGET = c-core/calendar_core

ifeq ($(OS),Windows_NT)
    TARGET := $(TARGET).exe
    MKDIR = if not exist data mkdir data
    RM = del /Q
else
    MKDIR = mkdir -p data
    RM = rm -f
endif

all: $(TARGET)

$(TARGET): $(SRC) $(HDR)
	$(MKDIR)
	$(CC) $(CFLAGS) $(SRC) -o $(TARGET)

clean:
	$(RM) $(TARGET)

run-cli: $(TARGET)
	./$(TARGET) --interactive

.PHONY: all clean run-cli
