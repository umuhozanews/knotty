# KNOTTY Card — Smart School Management System
### Complete System Documentation

---

## Table of Contents

1. [What Is KNOTTY?](#1-what-is-knotty)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema](#4-database-schema)
5. [Backend Modules & API](#5-backend-modules--api)
6. [Frontend Pages & Components](#6-frontend-pages--components)
7. [The KNOTTY Card (NFC/QR)](#7-the-knotty-card-nfcqr)
8. [Attendance System (Tap-In / Tap-Out)](#8-attendance-system-tap-in--tap-out)
9. [Academic Reports & PDF Generator](#9-academic-reports--pdf-generator)
10. [Wallet & Canteen (Cashless POS)](#10-wallet--canteen-cashless-pos)
11. [Fee Management](#11-fee-management)
12. [Notifications](#12-notifications)
13. [Authentication & Authorization](#13-authentication--authorization)
14. [Third-Party Integrations](#14-third-party-integrations)
15. [Project File Structure](#15-project-file-structure)
16. [Environment Variables](#16-environment-variables)

---

## 1. What Is KNOTTY?

**KNOTTY** is a full-stack smart school management platform built for Rwandan schools. Its core idea is a **physical NFC + QR smart card** issued to every student — one card that replaces manual registers, cash at the canteen, and paper reports.

### Core Problems It Solves

| Problem | KNOTTY Solution |
|---|---|
| Manual attendance registers (late, lossy) | NFC card tap-in / tap-out — instant, timestamped |
| Cash at the canteen (theft, miscounting) | Card wallet — top-up via MTN MoMo or cash, deduct at POS |
| Paper report cards | Digital reports with PDF export matching the official Rwandan format |
| No student health tracking | Nurse portal for health records with severity flags |
| Parents have no visibility | SMS notifications via Africa's Talking on every event |
| Fee collection chaos | Structured fee payments with MoMo integration + term/year tracking |

### Who Uses It

| Role | What they do |
|---|---|
| `ADMIN` | School setup, staff management, all reports, settings |
| `TEACHER` | Bulk attendance marking, discipline records, achievements |
| `CANTEEN` | Process card payments at the canteen POS |
| `NURSE` | Log health incidents, medications, checkups |
| `PARENT` | (Notification recipient — SMS/in-app) |
| `STUDENT` | Card holder — taps in/out, canteen purchases |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER / APP                        │
│                                                             │
│   Next.js 16 (React 19)  ·  TypeScript  ·  Tailwind v4     │
│   Port 3001 (dev)                                           │
│         │                                                   │
│         │  fetch() → /api/v1/*   (same-origin proxy)        │
└─────────┼───────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND (REST API)                     │
│                                                             │
│   Node.js  ·  Express 5  ·  Port 5000 (dev)                 │
│                                                             │
│   ┌────────────┐  ┌───────────┐  ┌──────────────────────┐  │
│   │ JWT Auth   │  │ RBAC      │  │  Joi Validation      │  │
│   │ middleware │  │ middleware│  │  middleware           │  │
│   └────────────┘  └───────────┘  └──────────────────────┘  │
│                                                             │
│   Modules: auth · schools · students · attendance ·         │
│   cards · canteen · fees · reports · health ·               │
│   discipline · achievements · notifications · teachers      │
└─────────────────────────────────────────────────────────────┘
          │                    │                   │
          ▼                    ▼                   ▼
┌──────────────┐   ┌──────────────────┐   ┌───────────────┐
│  PostgreSQL  │   │  Redis (cache /  │   │  Cloudinary   │
│  (Prisma 7)  │   │  rate limiting)  │   │  (photos)     │
└──────────────┘   └──────────────────┘   └───────────────┘
          │
          ▼
┌──────────────────────────────────────┐
│  Third-Party Integrations            │
│  MTN MoMo API  ·  Africa's Talking   │
└──────────────────────────────────────┘
```

The frontend calls `/api/v1/*` which Next.js proxies to the Express backend. Both run separately in development; in production they can be co-located or deployed to separate hosts.

---

## 3. Technology Stack

### Frontend — `knotty-app/`

| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 16.2.7 | React framework, App Router, file-based routing |
| **React** | 19.2.4 | UI library |
| **TypeScript** | 5.x | Type safety across all components and API calls |
| **Tailwind CSS** | v4 | Utility-first styling, dark gradients, responsive layout |
| **Lucide React** | 1.17.0 | Icon library (300+ icons) |
| **Recharts** | 3.8.1 | Dashboard charts (attendance trends, bar charts) |
| **Web NFC API** | Browser API | Reading physical NFC cards on Chrome for Android |

### Backend — `knotty-backend/`

| Technology | Version | Purpose |
|---|---|---|
| **Node.js** | 18+ | JavaScript runtime |
| **Express** | 5.2.1 | HTTP server, routing, middleware |
| **Prisma** | 7.8.0 | ORM + type-safe DB client + migrations |
| **PostgreSQL** | 14+ | Primary relational database |
| **Redis** (ioredis) | 5.x | Caching, rate-limit store |
| **JWT** (jsonwebtoken) | 9.x | Stateless authentication tokens |
| **bcryptjs** | 3.x | Password hashing |
| **PDFKit** | 0.18.0 | PDF generation (Rwandan official report cards) |
| **QRCode** | 1.5.4 | QR code generation for student cards |
| **Multer** | 2.x | File upload handling (profile photos) |
| **Cloudinary** | 2.x | Cloud photo storage and CDN |
| **Joi** | 18.x | Request body validation schemas |
| **Helmet** | 8.x | HTTP security headers |
| **CORS** | 2.x | Cross-origin request handling |
| **Morgan** | 1.x | HTTP request logging |
| **express-rate-limit** | 8.x | API rate limiting per IP |
| **UUID** | 14.x | Unique ID generation |
| **Nodemon** | 3.x | Dev auto-restart |

### Third-Party Services

| Service | SDK | Purpose |
|---|---|---|
| **MTN MoMo API** | Custom wrapper | Wallet top-up, fee payment via mobile money |
| **Africa's Talking** | `africastalking` 0.7.9 | SMS notifications to parents |
| **Cloudinary** | `cloudinary` 2.x | Profile photo upload and hosting |

---

## 4. Database Schema

The database has **16 models** in PostgreSQL, managed through Prisma migrations.

### Core Models

#### `School`
The top-level tenant. Every other record belongs to a school.
```
id · name · logo · address · phone · email · code
subscription_plan (BASIC | PREMIUM)
tap_out_after_minutes (Int, default 180)   ← configurable attendance window
school_start_time (String, default "08:30") ← late-arrival threshold
```

#### `User`
All system users share one table, differentiated by `role`.
```
id · school_id · role (ADMIN|TEACHER|STUDENT|PARENT|CANTEEN|NURSE)
first_name · last_name · email · phone
password_hash · profile_photo · is_active · last_login
```

#### `Student`
Extended profile attached to a User.
```
id · user_id (1:1 User) · school_id · student_code
date_of_birth · gender · nationality
level_id · class_id · parent_id (→ User)
enrollment_date · is_active
```

#### `KnottyCard`
The physical smart card issued to each student. One card per student.
```
id · student_id (unique) · school_id · card_number (unique)
qr_code (base64 image) · nfc_uid (linked after physical card is tapped)
wallet_balance (Int, RWF) · is_active · is_frozen
issued_at · expires_at (2 years from issue)
```

#### `Attendance`
One record per student per day. Unique constraint on `(student_id, date)`.
```
id · student_id · class_id · school_id · date
check_in_time · check_out_time
status (PRESENT|ABSENT|LATE|EXCUSED)
recorded_by · note
```

#### `FeePayment`
Fee collection with term and academic year tracking.
```
id · student_id · school_id · amount · currency (default RWF)
payment_type (TUITION|ACTIVITY|UNIFORM|OTHER)
payment_method (MOMO|CASH|BANK_TRANSFER)
momo_transaction_id · status (PENDING|COMPLETED|FAILED)
term (TERM1|TERM2|TERM3) · academic_year · paid_at
```

#### `CanteenTransaction`
Cashless canteen purchases deducted from the card wallet.
```
id · student_id · school_id · card_id
items_purchased (JSON array of {name, price, qty})
total_amount · wallet_balance_before · wallet_balance_after
served_by · transaction_time
```

#### `WalletTransaction`
Audit trail for every wallet movement (top-up, deduction, refund).
```
id · card_id · student_id · school_id
type (TOP_UP|DEDUCTION|REFUND)
amount · balance_before · balance_after
source (MOMO|CASH|ADMIN)
momo_reference · description
```

#### `AcademicReport`
Term report card. Grades stored as JSON to support any subject structure.
```
id · student_id · school_id · class_id
term (TERM1|TERM2|TERM3) · academic_year
grades (JSON):
  {
    "Mathematics": {
      cat, exam, total, max_cat, max_exam, max_total,
      percentage, grade, remarks
    },
    "_meta": { decision: "PROMOTED"|"REPEAT"|"SECOND_SITTING" }
  }
total_marks · average · position_in_class
teacher_remarks · principal_remarks · conduct_grade
is_published · published_at
Unique: (student_id, term, academic_year)
```

#### `HealthRecord`
Nurse-logged medical incidents.
```
id · student_id · school_id · recorded_by
type (ILLNESS|INJURY|MEDICATION|CHECKUP|ALLERGY)
title · description · treatment_given
severity (LOW|MEDIUM|HIGH)
follow_up_required · recorded_at
```

#### `DisciplineRecord`
Behavioral incidents logged by teachers/admin.
```
id · student_id · school_id · recorded_by
type (WARNING|SUSPENSION|MISCONDUCT|RULE_VIOLATION|OTHER)
title · description · action_taken
severity (MINOR|MODERATE|SERIOUS)
parent_notified · recorded_at
```

#### Other Models
- **`Achievement`** — Academic, sports, arts, leadership awards
- **`Subject`** — Subjects per level (linked to teachers)
- **`Level`** — School grade levels (e.g., "Senior 1", "Primary 5")
- **`Class`** — Class within a level (e.g., "A", "B") with academic year
- **`Teacher`** — Extended teacher profile with qualifications
- **`Notification`** — In-app and SMS notification log

---

## 5. Backend Modules & API

Base URL: `/api/v1`

All protected routes require: `Authorization: Bearer <JWT>`

### Auth — `/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | Public | Email + password → JWT access + refresh tokens |
| POST | `/auth/logout` | Required | Invalidate refresh token |
| GET | `/auth/me` | Required | Get current user profile |
| POST | `/auth/refresh` | Public | Exchange refresh token for new access token |

### Schools — `/schools`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/schools` | Public | Register new school |
| GET | `/schools/:id` | Any | Get school profile |
| PUT | `/schools/:id` | ADMIN | Update school info |
| GET | `/schools/:id/dashboard-stats` | Any | KPI stats (students, attendance, fees, canteen) |
| GET | `/schools/:id/attendance-trend` | Any | Attendance trend for last N days |
| GET | `/schools/settings/attendance` | Any | Get tap-out delay + school start time |
| PUT | `/schools/settings/attendance` | ADMIN | Update tap-out delay + school start time |

### Structure (Levels & Classes) — `/structure`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/structure/levels` | Any | List all levels |
| POST | `/structure/levels` | ADMIN | Create level |
| DELETE | `/structure/levels/:id` | ADMIN | Delete level |
| GET | `/structure/classes` | Any | List all classes |
| POST | `/structure/classes` | ADMIN | Create class |
| DELETE | `/structure/classes/:id` | ADMIN | Delete class |
| GET | `/structure/classes/:id/students` | Any | Students in a class |
| GET | `/structure/staff` | ADMIN | List all staff users |
| POST | `/structure/staff` | ADMIN | Create staff account |
| PUT | `/structure/staff/:id/toggle` | ADMIN | Activate / deactivate staff |

### Students — `/students`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/students` | Any | Paginated + filterable student list |
| POST | `/students` | ADMIN | Create student + auto-create User account |
| GET | `/students/:id` | Any | Student profile |
| PUT | `/students/:id` | ADMIN | Update student |
| DELETE | `/students/:id` | ADMIN | Remove student |
| GET | `/students/:id/full-profile` | Any | Full profile with attendance, reports, health, discipline, achievements |

### Attendance — `/attendance`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/attendance/scan` | Any | Card tap — TAP_IN or TAP_OUT with timing logic |
| POST | `/attendance/scan-nfc` | Any | Same as scan but via NFC UID |
| POST | `/attendance/bulk` | TEACHER/ADMIN | Mark whole class at once |
| GET | `/attendance/today-summary` | Any | Today's PRESENT/ABSENT/LATE/EXCUSED counts + recent records |
| GET | `/attendance/student/:id` | Any | Paginated history for one student |
| GET | `/attendance/class/:id` | Any | All students' attendance for a class on a given date |
| GET | `/attendance/report/:id` | Any | Date-range report with summary stats |

#### Tap-In / Tap-Out Logic
```
First scan of the day  → TAP_IN  (creates Attendance, status=PRESENT or LATE)
Second scan            → check if (now - check_in_time) >= tap_out_after_minutes
  ✓ Yes               → TAP_OUT (records check_out_time)
  ✗ No                → Error 400 with tap_out_available_at timestamp
Already tapped out     → ALREADY_OUT (idempotent, no DB write)
```

### Cards — `/cards`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/cards` | Any | Paginated card list with search |
| POST | `/cards/issue/:studentId` | ADMIN | Issue new card to student (generates card_number + QR) |
| GET | `/cards/:cardNumber/scan` | Any | Look up card — returns full student + today's attendance info |
| PUT | `/cards/:id/freeze` | ADMIN | Freeze card (blocks tap + canteen) |
| PUT | `/cards/:id/unfreeze` | ADMIN | Unfreeze card |
| POST | `/cards/:id/topup` | ADMIN | Request MTN MoMo wallet top-up |
| POST | `/cards/:id/topup/confirm` | ADMIN | Confirm MoMo top-up after USSD |
| POST | `/cards/:id/cash-topup` | ADMIN | Direct cash top-up |
| GET | `/cards/:id/transactions` | Any | Wallet transaction history |
| PUT | `/cards/:id/nfc` | ADMIN | Link physical NFC UID to card |
| GET | `/cards/nfc/:uid` | Any | Look up card by NFC UID |

### Canteen — `/canteen`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/canteen/purchase` | CANTEEN/ADMIN | Process purchase → deduct from wallet |
| GET | `/canteen/transactions` | Any | School-wide transaction list |
| GET | `/canteen/student/:id` | Any | Transaction history for a student |
| GET | `/canteen/stats` | Any | Revenue stats (daily, weekly, top items) |

### Fees — `/fees`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/fees/pay` | ADMIN | Record fee payment |
| GET | `/fees` | Any | All fee payments (filterable by student/term/status) |
| GET | `/fees/student/:id` | Any | Fee history for a student |
| GET | `/fees/summary` | Any | Collection summary by term/type |

### Academic Reports — `/reports`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/reports` | TEACHER/ADMIN | Create/update report (CAT + Exam marks + decision) |
| GET | `/reports/student/:id` | Any | All reports for a student |
| GET | `/reports/:id` | Any | Single report |
| GET | `/reports/:id/pdf` | Any | Stream PDF of the official Rwandan report card |
| PUT | `/reports/:id/publish` | ADMIN | Publish report (makes it visible to parents) |

### Health — `/health`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/health` | NURSE/ADMIN | Log health record |
| GET | `/health/student/:id` | Any | Student health history |
| PUT | `/health/:id` | NURSE/ADMIN | Update record |
| DELETE | `/health/:id` | ADMIN | Remove record |

### Discipline — `/discipline`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/discipline` | TEACHER/ADMIN | Log discipline incident |
| GET | `/discipline/student/:id` | Any | Student discipline history |
| PUT | `/discipline/:id` | TEACHER/ADMIN | Update incident |

### Achievements — `/achievements`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/achievements` | TEACHER/ADMIN | Award achievement |
| GET | `/achievements/student/:id` | Any | Student achievements |
| DELETE | `/achievements/:id` | ADMIN | Remove award |

### Notifications — `/notifications`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/notifications` | Any | Current user's notifications |
| PUT | `/notifications/:id/read` | Any | Mark as read |
| PUT | `/notifications/read-all` | Any | Mark all as read |
| POST | `/notifications/send` | ADMIN | Send notification (in-app + optional SMS) |

---

## 6. Frontend Pages & Components

### Pages — `knotty-app/app/`

#### `/` — Dashboard
- KPI stats cards: total students, teachers, present today, fees collected, canteen revenue
- Attendance trend bar chart (Recharts) — last 9 days present vs absent
- Quick summary widgets
- Uses `schools.stats()` + `schools.trend()`

#### `/login` — Authentication
- Email + password form
- JWT stored in `localStorage` as `knotty_token` + `knotty_refresh`
- Redirects to dashboard on success

#### `/students` — Student Directory
- Searchable, paginated table
- Filter by level and class
- Issue card button per row
- Links to individual student profile

#### `/students/[id]` — Student Profile
Full student detail with 7 tabs:
- **Profile** — personal info, photo, parent contact, class assignment
- **Attendance** — monthly calendar view + status badges
- **Reports** — list of term reports with CAT/Exam/Total/Grade columns + PDF download
  - **Create Report Modal** — enter subject rows with CAT and Exam marks (text inputs, no spinners), max marks, decision (PROMOTED/REPEAT/SECOND SITTING), principal remarks
  - Grade computed per Rwanda scale: A ≥80%, B ≥75%, C ≥70%, D ≥65%, E ≥50%, F <50%
  - Percentage = subject_total / max_total × 100
- **Health** — nurse-logged records with severity chips
- **Discipline** — incidents with type and severity
- **Achievements** — awards by category
- **Card** — wallet balance, card status, top-up, freeze/unfreeze

#### `/attendance` — Attendance Management
Two tabs:

**Tap Card Tab (main mode)**
1. Enter card number → `cards.scan()` → KnottyCard virtual card appears
2. Card shows: student photo/initials, name, class, card number, issued/expiry, tap times, school logo
3. Glow animation: green = tapped in, blue = ready for tap-out, orange = too early
4. TAP IN button (orange) or TAP OUT button (blue) → calls `attendance.scan()`
5. Result banner: action label + time details + countdown to tap-out
6. NFC continuous listen mode (Chrome on Android only)
7. Settings panel: tap-out delay (minutes) + school start time

**Bulk Mark Tab**
- Select class + date
- PRESENT / ABSENT / LATE / EXCUSED buttons per student
- Submit all at once

Right sidebar: today's PRESENT/ABSENT/LATE/EXCUSED summary + recent tap log (IN/OUT badges)

#### `/cards` — Card Management
- List all issued cards with student info, balance, status
- Issue card to student
- Freeze / unfreeze card
- Cash top-up or MoMo top-up
- View wallet transaction history

#### `/canteen` — Canteen Operations
- Scan card → show student + balance
- Add items to cart (name + price)
- Process purchase → deduct from wallet
- Transaction log with revenue stats

#### `/fees` — Fee Collection
- Record payment (type, method, amount, term)
- Filter by student/term/status
- Summary of collected vs expected fees

#### `/reports` — School-wide Reports
- List all published reports by class/term
- Bulk PDF download option

#### `/discipline` — Discipline Log
- School-wide incident feed
- Filter by student, type, severity

#### `/settings` — School Settings
- School profile (name, logo, address, phone)
- Staff management (create, activate/deactivate)
- Level and class structure management
- Attendance timing configuration

### Reusable Components — `knotty-app/components/`

| Component | Description |
|---|---|
| `DashboardShell` | Layout wrapper — Sidebar + Header + auth guard (redirects to `/login` if no token) |
| `Sidebar` | Navigation links with icons, active state, role-aware items |
| `Header` | Top bar with school name, user avatar, notifications bell |
| `KnottyCard` | Virtual physical school ID card — dark gradient, NFC icon, student photo, glow animations, tap ripple |
| `StatsCards` | KPI tiles for the dashboard (icon + number + label) |
| `AttendanceChart` | Bar chart of 9-day attendance trend using Recharts |
| `RightPanelStats` | Right sidebar stats widget |
| `StudentTable` | Paginated, searchable student rows with card status chips |
| `VirtualCardTap` | Legacy manual tap helper (replaced by KnottyCard + attendance page) |

### Context Providers — `knotty-app/context/`

| Provider | Purpose |
|---|---|
| `AuthContext` | Stores `user` + JWT, exposes `loading` flag used to guard all data-fetch `useEffect`s |
| `ToastContext` | Global toast notifications (success / error / info) with auto-dismiss |
| `ThemeContext` | Light/dark theme preference |

### Custom Hooks — `knotty-app/hooks/`

| Hook | Purpose |
|---|---|
| `useNFC` | Wraps Web NFC API — `scan()` (one-shot), `startListen()` (continuous), `stopListen()`, `listening`, `error`, `isSupported` |

### API Client — `knotty-app/lib/api.ts`

Single file exporting all typed API modules:
```
auth · schools · structure · students · attendance
cards · fees · canteen · reports · health · discipline
achievements · notifications
```
All calls go through a shared `request<T>()` helper that injects the JWT header and throws typed errors on non-2xx responses.

---

## 7. The KNOTTY Card (NFC/QR)

Each student gets **one physical card** — a standard CR80 PVC card with an embedded NFC chip (ISO 14443-A, NTAG216 recommended).

### Card Number Format
```
KNT-{SCHOOL_CODE}-{YEAR}-{5-DIGIT-SEQUENCE}
Example: KNT-KMS-2026-00042
```

### Card Lifecycle

```
1. ADMIN issues card via dashboard
   → Backend generates card_number + QR code (base64 PNG)
   → expires_at = now + 2 years
   → KnottyCard record created, wallet_balance = 0

2. Physical card is printed with card_number + QR code
   (Optionally: NFC UID is linked via /cards/:id/nfc after first tap)

3. Student uses card daily:
   → Morning: tap phone / reader → TAP_IN
   → After 3 hours (configurable): TAP_OUT
   → Canteen: tap → balance shown → purchase deducted

4. Card can be:
   → Frozen (lost/stolen) — all taps and purchases blocked
   → Renewed (new card_number issued after expiry)
```

### How NFC Works (Physical Layer)

```
Card chip (passive, no battery)
    ↕  13.56 MHz radio field
Android phone / ACR122U reader
    ↓
Web NFC API (Chrome for Android) reads NDEF text record
    → card_number extracted
    → POST /attendance/scan  or  POST /canteen/purchase
```

The NDEF memory on the chip stores the `card_number` string. The phone reads it in < 200ms without any app installation — just Chrome.

For desktop/tablet POS terminals without NFC, the QR code (printed on card back) is scanned via camera.

### Virtual Card Display (`KnottyCard` component)
The UI renders a photorealistic school ID card:
- Dark navy gradient background (`#0f172a → #1e293b`)
- Orange accent stripe at top
- School logo (or "K" placeholder)
- Student photo (or initials avatar with deterministic hue)
- ACTIVE / FROZEN / EXPIRED status badge
- Card number in monospace font
- Issued / Expiry dates
- Live tap-in / tap-out times
- NFC contactless waves icon
- Glow ring on tap result (green / blue / orange / red)
- Scale + ripple animation on tap

---

## 8. Attendance System (Tap-In / Tap-Out)

### Settings (per school, configurable)

| Setting | Default | Meaning |
|---|---|---|
| `tap_out_after_minutes` | 180 (3 hours) | Student cannot tap out before this many minutes after tap-in |
| `school_start_time` | "08:30" | Arrivals after this time are marked LATE |

### State Machine

```
No record today
    → TAP_IN
    → Creates Attendance record
    → status = PRESENT (arrived before school_start_time)
              LATE    (arrived after school_start_time)
    → Returns: action=TAP_IN, check_in_time, tap_out_available_at

Has record, check_out_time is NULL
    → Check: now >= check_in_time + tap_out_after_minutes?
        Yes → TAP_OUT
              → Sets check_out_time = now
              → Returns: action=TAP_OUT
        No  → Error 400: "Tap-out not available yet. Come back at HH:MM"
              → Returns: tap_out_available_at

Has record, check_out_time is NOT NULL
    → ALREADY_OUT (idempotent, no DB write)
```

### Frontend TAP Flow
```
User types/scans card number
    → cards.scan(cardNumber) → CardScanFull
    → KnottyCard renders with current state

User presses TAP button
    → 120ms scale animation
    → attendance.scan(cardNumber) → AttendanceRecord
    → Result banner (green/blue/orange)
    → cards.scan() again to refresh displayed times on card
    → Scan log updated, today's summary refreshed
```

---

## 9. Academic Reports & PDF Generator

### Report Data Structure (stored as JSON in `grades` column)

```json
{
  "Mathematics": {
    "cat": 18, "exam": 62, "total": 80,
    "max_cat": 20, "max_exam": 80, "max_total": 100,
    "percentage": 80.0, "grade": "A", "remarks": ""
  },
  "English": { ... },
  "_meta": {
    "decision": "PROMOTED"
  }
}
```

### Rwanda Grading Scale

| Grade | Percentage |
|---|---|
| A | ≥ 80% |
| B | ≥ 75% |
| C | ≥ 70% |
| D | ≥ 65% |
| E | ≥ 50% |
| F | < 50% |

### PDF Layout (matches official Rwandan report card format)

Generated with **PDFKit** using a custom `drawCell()` helper for bordered table cells:

```
┌─────────────────────────────────────────────────────────────┐
│  [School Logo]  School Name          STUDENT REPORT CARD    │
│  Address, Phone                      Term · Year            │
├─────────────────────────────────────────────────────────────┤
│  Student: ___  Class: ___  Student Code: ___  Photo         │
├──────────────┬───────────────────────────────┬──────────────┤
│  SUBJECT     │  MAX  CAT  EXAM  TOTAL  %  GR │  REMARKS     │
├──────────────┼───────────────────────────────┼──────────────┤
│  WEIGHT      │  20   20    80   100          │              │
│  Mathematics │       18    62    80  80%  A  │              │
│  English     │       ...                     │              │
│  ...         │                               │              │
├──────────────┼───────────────────────────────┼──────────────┤
│  Conduct     │  A    Excellent               │              │
│  All Subjects│       Total                   │              │
├──────────────┴───────────────────────────────┴──────────────┤
│  Percentage: 78%   Final Grade: B   Position: 3/45          │
│  Decision: PROMOTED                                         │
├─────────────────────────────────────────────────────────────┤
│  Teacher's Comment: ___________________________________     │
├─────────────────────────────────────────────────────────────┤
│  Teacher: ___________    Parent/Guardian: ___________       │
├────────────────────────────────────┬────────────────────────┤
│  Grading Scale Table               │  KEY:                  │
│  A≥80 B≥75 C≥70 D≥65 E≥50 F<50   │  CAT=Continuous Assess │
└────────────────────────────────────┴────────────────────────┘
```

Downloaded as `{StudentName}-Report-{Term}-{Year}.pdf`

---

## 10. Wallet & Canteen (Cashless POS)

### Wallet Top-Up Methods

**1. MTN MoMo (Mobile Money)**
```
Admin initiates top-up → Backend calls MTN MoMo Collections API
    → Student receives USSD prompt on phone
    → Student approves
    → Webhook (or manual confirm) → wallet_balance += amount
    → WalletTransaction logged (source=MOMO)
```

**2. Cash**
```
Admin selects Cash top-up → Direct wallet_balance += amount
    → WalletTransaction logged (source=CASH)
    → No external API call
```

### Canteen Purchase Flow
```
Cashier scans student card
    → GET /cards/:cardNumber/scan → shows name + balance
    → Cashier adds items (name + price)
    → POST /canteen/purchase
        → Validate balance >= total_amount
        → Deduct wallet_balance (atomic Prisma transaction)
        → Log CanteenTransaction with items_purchased JSON
        → Log WalletTransaction (type=DEDUCTION, source=ADMIN)
```

All wallet operations use **Prisma transactions** to prevent race conditions (balance can never go negative).

---

## 11. Fee Management

Fee payments support three payment methods:
- **MTN MoMo** — reference ID stored, status tracked (PENDING → COMPLETED)
- **Cash** — recorded manually by admin
- **Bank Transfer** — recorded manually with reference

Payments are tagged by:
- `term` (TERM1 / TERM2 / TERM3)
- `academic_year` (e.g. "2026")
- `payment_type` (TUITION / ACTIVITY / UNIFORM / OTHER)

The fees summary endpoint groups collections by these dimensions for reporting.

---

## 12. Notifications

Events that trigger notifications:
- Attendance tap-in (SMS to parent: "Your child arrived at 07:45")
- Fee payment recorded
- Health record created (severity HIGH → immediate SMS)
- Discipline incident (parent_notified flag triggers SMS)
- Report published

Notification channels:
- **IN_APP** — stored in `Notification` table, read from `/notifications`
- **SMS** — sent via **Africa's Talking** SMS gateway

---

## 13. Authentication & Authorization

### JWT Strategy
- **Access token**: 1h expiry, signed with `JWT_SECRET`
- **Refresh token**: 7d expiry, stored in DB, rotated on use
- Token carried as `Authorization: Bearer <token>` header
- Frontend stores both in `localStorage`

### Middleware Chain
```
Request
  → helmet() + cors() + morgan() + rate-limit
  → authenticate()  ← verifies JWT, attaches req.user
  → authorize(role) ← checks req.user.role against allowed roles
  → validator(schema) ← Joi schema validation
  → controller()
```

### Role-Based Access Control (RBAC)

| Action | ADMIN | TEACHER | CANTEEN | NURSE | PARENT | STUDENT |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Create school | ✓ | | | | | |
| Manage students | ✓ | | | | | |
| Bulk attendance | ✓ | ✓ | | | | |
| Card tap (scan) | ✓ | ✓ | ✓ | ✓ | | |
| Canteen purchase | ✓ | | ✓ | | | |
| Log health | ✓ | | | ✓ | | |
| Log discipline | ✓ | ✓ | | | | |
| Create report | ✓ | ✓ | | | | |
| Publish report | ✓ | | | | | |
| Manage settings | ✓ | | | | | |
| View own data | | | | | ✓ | ✓ |

---

## 14. Third-Party Integrations

### MTN MoMo (`src/integrations/mtn-momo.js`)
- Collections API for wallet top-up and fee payment
- `requestTopUp(amount, phone, description)` → returns `referenceId`
- `getTransactionStatus(referenceId)` → checks SUCCESSFUL / FAILED / PENDING
- Configured via `MOMO_SUBSCRIPTION_KEY`, `MOMO_API_USER`, `MOMO_API_KEY`, `MOMO_TARGET_ENVIRONMENT`

### Africa's Talking (`src/integrations/africas-talking.js`)
- SMS gateway for parent notifications
- `sendSMS(to, message)` → delivers to Rwandan mobile numbers (+250...)
- Configured via `AT_API_KEY`, `AT_USERNAME`

### Cloudinary (`src/integrations/cloudinary.js`)
- Profile photo upload for students and staff
- Upload via Multer buffer → Cloudinary `upload_stream`
- Returns secure HTTPS URL stored in `User.profile_photo`
- Configured via `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### Redis (`src/config/redis.js`)
- Session caching
- Rate limit counter storage
- Token blacklisting on logout

---

## 15. Project File Structure

```
KNOTTY/
├── knotty-app/                    ← Next.js 16 frontend
│   ├── app/
│   │   ├── layout.tsx             ← Root layout, global providers
│   │   ├── page.tsx               ← Dashboard
│   │   ├── login/page.tsx
│   │   ├── students/
│   │   │   ├── page.tsx           ← Student list
│   │   │   └── [id]/page.tsx      ← Student profile (7 tabs)
│   │   ├── attendance/page.tsx    ← Tap-in/out + bulk mark
│   │   ├── cards/page.tsx         ← Card management
│   │   ├── canteen/page.tsx       ← Canteen POS
│   │   ├── fees/page.tsx          ← Fee collection
│   │   ├── reports/page.tsx       ← School-wide reports
│   │   ├── discipline/page.tsx    ← Discipline log
│   │   └── settings/page.tsx      ← School settings
│   ├── components/
│   │   ├── DashboardShell.tsx     ← Auth guard + layout
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── KnottyCard.tsx         ← Virtual NFC card component
│   │   ├── AttendanceChart.tsx    ← Recharts bar chart
│   │   ├── StatsCards.tsx
│   │   ├── StudentTable.tsx
│   │   └── ...
│   ├── context/
│   │   ├── AuthContext.tsx        ← JWT + user state
│   │   ├── ToastContext.tsx       ← Global toast system
│   │   └── ThemeContext.tsx
│   ├── hooks/
│   │   └── useNFC.ts              ← Web NFC API wrapper
│   └── lib/
│       └── api.ts                 ← Typed API client (all modules)
│
└── knotty-backend/                ← Node.js / Express API
    ├── prisma/
    │   ├── schema.prisma          ← 16-model database schema
    │   ├── seed.js                ← Demo data seeder
    │   └── migrations/            ← Prisma migration history
    └── src/
        ├── app.js                 ← Express app + middleware setup
        ├── config/
        │   ├── database.js        ← Prisma client singleton
        │   ├── cloudinary.js
        │   └── redis.js
        ├── middleware/
        │   ├── auth.js            ← JWT verify
        │   ├── rbac.js            ← Role check
        │   ├── validator.js       ← Joi schema middleware
        │   └── errorHandler.js    ← Global error formatter
        ├── modules/
        │   ├── auth/              ← login, logout, refresh, me
        │   ├── schools/           ← school CRUD + dashboard stats + settings
        │   ├── students/          ← student CRUD + full profile
        │   ├── attendance/        ← scan, bulk, today-summary, history
        │   ├── cards/             ← issue, scan, freeze, topup, NFC
        │   ├── canteen/           ← purchase, stats, history
        │   ├── fees/              ← payment recording + summary
        │   ├── reports/           ← create, PDF, publish
        │   ├── health/            ← health records
        │   ├── discipline/        ← discipline records
        │   ├── achievements/      ← student awards
        │   ├── notifications/     ← in-app + SMS dispatch
        │   ├── levels/            ← school levels
        │   └── teachers/          ← teacher profiles
        ├── integrations/
        │   ├── mtn-momo.js        ← MTN MoMo Collections API
        │   ├── africas-talking.js ← SMS gateway
        │   └── cloudinary.js      ← Photo upload
        └── utils/
            ├── pdfGenerator.js    ← PDFKit Rwandan report card
            ├── qrGenerator.js     ← QR code for cards
            ├── cardNumberGenerator.js ← KNT-XXX-YYYY-NNNNN format
            └── helpers.js         ← Pagination, response helpers
```

---

## 16. Environment Variables

### Backend (`knotty-backend/.env`)

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/knotty

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_REFRESH_EXPIRES_IN=7d

# Redis
REDIS_URL=redis://localhost:6379

# MTN MoMo
MOMO_SUBSCRIPTION_KEY=
MOMO_API_USER=
MOMO_API_KEY=
MOMO_TARGET_ENVIRONMENT=sandbox

# Africa's Talking
AT_API_KEY=
AT_USERNAME=sandbox

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### Frontend (`knotty-app/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

---

## Summary

KNOTTY is a complete school ERP system purpose-built for Rwanda with:

- **1 physical card** per student → handles attendance, canteen, and ID
- **16-table PostgreSQL schema** covering every aspect of school life
- **14 backend API modules** with role-based access control
- **10 frontend pages** with real-time data
- **Tap-in / Tap-out** with configurable timing rules enforced server-side
- **Official Rwandan PDF report cards** generated on-demand
- **MTN MoMo** for cashless wallet and fee collection
- **Africa's Talking** for parent SMS alerts
- **Web NFC** for physical card tap on Android phones — no app install needed

---

*KNOTTY Card — Built for Rwandan Schools*
*Stack: Next.js 16 · React 19 · TypeScript · Tailwind v4 · Node.js · Express 5 · Prisma 7 · PostgreSQL · Redis · PDFKit · MTN MoMo · Africa's Talking*
