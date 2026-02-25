# PMI EMS Scheduler - Product Roadmap

## Future Features - RFID Lab Station System

**Priority:** Medium-term (when hardware ready)
**Status:** Planned - infrastructure being built

### Concept

RFID readers at each station enable:

1. **Instructor Login** - Tap card to auto-open timer display for assigned station
2. **Student Attendance** - Students tap card at station to log presence automatically

### Student RFID Tracking Benefits

- Automatic station attendance (no manual check-in)
- Track which students were at which stations
- Time-in / time-out per station
- Verify student was present for skill completion
- Aggregate data: "Student X spent 45 min at IV station"
- Identify students who missed rotations
- Integration with lab_day_attendance table

### Prerequisites (in progress)

- Building access RFID system being implemented
- access_cards, access_devices, access_logs tables exist
- Students will also have RFID cards for building access
- Extra RFID readers available for stations

### Implementation Phases

**Phase 1: Database Prep**

- Add user_email (instructor OR student) to access_cards
- Link cards to lab_users and students tables
- UI to assign cards in admin
- New table: station_attendance_logs (student_id, station_id, lab_day_id, tap_in, tap_out)

**Phase 2: API Endpoints**

- POST /api/access/station-login (instructor login)
- POST /api/access/station-checkin (student tap)
- GET /api/access/station-status (who's currently at station)

**Phase 3: Pi Kiosk Setup (when hardware ready)**

- RFID reader at each station
- Python script detects card type (instructor vs student)
- Instructor tap -> login to timer
- Student tap -> log attendance + show confirmation

**Phase 4: Reporting**

- Station attendance reports
- Student rotation completion verification
- Time tracking analytics
- Integration with skills completion (student was present = eligible for sign-off)

### Hardware Per Station

- Raspberry Pi (or similar)
- RFID reader (RC522/PN532)
- Small display (optional for student confirmation)
- Network connection

### Bonus Features (later)

- Live dashboard: see all students currently at stations
- Alert if student hasn't rotated in X minutes
- Auto-complete attendance when all stations scanned
- Student app showing their rotation history
