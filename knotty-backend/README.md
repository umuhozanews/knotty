# KNOTTY Card — Backend API

Smart school management system for Rwanda. Node.js + Express + PostgreSQL + Prisma.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, etc.

# 3. Generate Prisma client
npm run db:generate

# 4. Run migrations
npm run db:migrate

# 5. Seed sample data
npm run db:seed

# 6. Start dev server
npm run dev
# → http://localhost:5000
```

---

## Architecture

```
src/
├── config/        Prisma, Redis, Cloudinary
├── middleware/    Auth (JWT), RBAC, Error handler, Validator
├── modules/       Feature modules (auth, students, cards, ...)
├── integrations/  MTN MoMo, Africa's Talking SMS, Cloudinary
├── utils/         QR code, PDF, helpers
└── app.js         Express app entry
```

Each module has: `controller.js` · `service.js` · `routes.js` · `validation.js`

---

## Roles & Access

| Role     | Access                                      |
|----------|---------------------------------------------|
| ADMIN    | Everything                                  |
| TEACHER  | Attendance, grades, discipline (own class)  |
| CANTEEN  | Canteen purchases only                      |
| NURSE    | Health records only                         |
| PARENT   | Read-only own child + wallet top-up         |
| STUDENT  | Read-only own records                       |

---

## API Reference

Base URL: `http://localhost:5000/api/v1`

All protected endpoints require: `Authorization: Bearer <access_token>`

---

### AUTH

| Method | Endpoint               | Access | Description              |
|--------|------------------------|--------|--------------------------|
| POST   | /auth/login            | Public | Get access + refresh token |
| POST   | /auth/refresh-token    | Public | Rotate tokens             |
| POST   | /auth/logout           | Auth   | Revoke refresh token      |
| GET    | /auth/me               | Auth   | Get current user          |

**Login body:**
```json
{ "email": "admin@knottyschool.rw", "password": "Admin@2024" }
```

**Login response:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { "id": "...", "role": "ADMIN", "first_name": "School", ... }
}
```

---

### SCHOOLS

| Method | Endpoint                     | Access | Description          |
|--------|------------------------------|--------|----------------------|
| POST   | /schools                     | Public | Create school        |
| GET    | /schools/:id                 | Auth   | Get school info      |
| PUT    | /schools/:id                 | ADMIN  | Update school        |
| GET    | /schools/:id/dashboard-stats | Auth   | Dashboard stats      |

**Dashboard stats response:**
```json
{
  "total_students": 120,
  "total_teachers": 15,
  "present_today": 98,
  "fee_collected": 5000000,
  "canteen_revenue_today": 45000,
  "low_balance_cards": 3
}
```

---

### STUDENTS

| Method | Endpoint                     | Access          | Description              |
|--------|------------------------------|-----------------|--------------------------|
| POST   | /students                    | ADMIN           | Create student + user    |
| GET    | /students?page=&limit=&search= | ADMIN, TEACHER | List all students        |
| GET    | /students/:id                | ADMIN, TEACHER  | Get student              |
| GET    | /students/:id/full-profile   | ADMIN, TEACHER  | Full profile (all records) |
| PUT    | /students/:id                | ADMIN           | Update student           |
| DELETE | /students/:id                | ADMIN           | Soft deactivate          |

**Create student body:**
```json
{
  "first_name": "Hirwa", "last_name": "Jean",
  "email": "hirwa@school.rw", "phone": "+250788000000",
  "level_id": "uuid", "class_id": "uuid",
  "gender": "M", "nationality": "Rwandan",
  "date_of_birth": "2007-01-15"
}
```

---

### KNOTTY CARD

| Method | Endpoint                    | Access         | Description           |
|--------|-----------------------------|----------------|-----------------------|
| POST   | /cards/issue/:studentId     | ADMIN          | Issue card + QR       |
| GET    | /cards/:cardNumber          | Auth           | Scan card             |
| PUT    | /cards/:id/freeze           | ADMIN          | Freeze card           |
| PUT    | /cards/:id/unfreeze         | ADMIN          | Unfreeze card         |
| POST   | /cards/:id/top-up           | ADMIN, PARENT  | Initiate MoMo top-up |
| GET    | /cards/:id/transactions     | ADMIN, PARENT  | Wallet history        |
| POST   | /cards/webhook/momo/:refId  | Public (MTN)   | MoMo payment callback |

**Scan response:**
```json
{
  "card_number": "KNT-KMS-2026-00001",
  "wallet_balance": 5000,
  "student": { "name": "Hirwa Jean", "class": "Senior 5 A", ... },
  "today_attendance": "PRESENT"
}
```

**Top-up body:**
```json
{ "amount": 5000, "phone": "0788000000" }
```

---

### ATTENDANCE

| Method | Endpoint                              | Access          | Description         |
|--------|---------------------------------------|-----------------|---------------------|
| POST   | /attendance/scan                      | Auth            | Card scan → attend  |
| POST   | /attendance/bulk                      | ADMIN, TEACHER  | Mark whole class    |
| GET    | /attendance/student/:studentId        | Auth            | Student attendance  |
| GET    | /attendance/class/:classId?date=      | ADMIN, TEACHER  | Class attendance    |
| GET    | /attendance/report/:studentId?from=&to= | Auth          | Report with summary |

**Scan body:** `{ "card_number": "KNT-KMS-2026-00001" }`

**Bulk body:**
```json
{
  "class_id": "uuid",
  "records": [
    { "student_id": "uuid", "status": "PRESENT", "note": "" },
    { "student_id": "uuid", "status": "ABSENT" }
  ]
}
```

---

### FEES

| Method | Endpoint                         | Access         | Description        |
|--------|----------------------------------|----------------|--------------------|
| POST   | /fees/pay                        | ADMIN          | Initiate payment   |
| GET    | /fees/verify/:momoReference      | Public (webhook) | Verify MoMo     |
| GET    | /fees/student/:studentId         | ADMIN, PARENT  | Student fee history |
| GET    | /fees/report                     | ADMIN          | School fee summary |

---

### CANTEEN

| Method | Endpoint                          | Access          | Description       |
|--------|-----------------------------------|-----------------|-------------------|
| POST   | /canteen/purchase                 | ADMIN, CANTEEN  | Deduct from wallet |
| GET    | /canteen/transactions/:studentId  | ADMIN, PARENT   | Student history   |
| GET    | /canteen/report?date=             | ADMIN, CANTEEN  | Daily report      |

**Purchase body:**
```json
{
  "card_number": "KNT-KMS-2026-00001",
  "items": [
    { "name": "Rice + Beans", "price": 500, "quantity": 1 },
    { "name": "Water", "price": 200, "quantity": 1 }
  ]
}
```

---

### HEALTH RECORDS

| Method | Endpoint                       | Access             | Description   |
|--------|--------------------------------|--------------------|---------------|
| POST   | /health                        | ADMIN, NURSE       | Add record    |
| GET    | /health/student/:studentId     | ADMIN, NURSE, PARENT | List records |
| PUT    | /health/:id                    | ADMIN, NURSE       | Update        |
| DELETE | /health/:id                    | ADMIN, NURSE       | Delete        |

---

### DISCIPLINE

| Method | Endpoint                          | Access            | Description |
|--------|-----------------------------------|-------------------|-------------|
| POST   | /discipline                       | ADMIN, TEACHER    | Add record  |
| GET    | /discipline/student/:studentId    | ADMIN, TEACHER, PARENT | List |
| PUT    | /discipline/:id                   | ADMIN, TEACHER    | Update      |

---

### ACHIEVEMENTS

| Method | Endpoint                            | Access         | Description |
|--------|-------------------------------------|----------------|-------------|
| POST   | /achievements                       | ADMIN, TEACHER | Add record  |
| GET    | /achievements/student/:studentId    | Auth           | List        |

---

### ACADEMIC REPORTS

| Method | Endpoint                      | Access          | Description      |
|--------|-------------------------------|-----------------|------------------|
| POST   | /reports                      | ADMIN, TEACHER  | Create report    |
| GET    | /reports/student/:studentId   | Auth            | Student reports  |
| GET    | /reports/:id                  | Auth            | Single report    |
| PUT    | /reports/:id                  | ADMIN, TEACHER  | Update           |
| POST   | /reports/:id/publish          | ADMIN           | Publish          |
| GET    | /reports/:id/pdf              | Auth            | Download PDF     |

---

### TEACHERS

| Method | Endpoint        | Access | Description  |
|--------|-----------------|--------|--------------|
| POST   | /teachers       | ADMIN  | Create       |
| GET    | /teachers       | ADMIN  | List all     |
| GET    | /teachers/:id   | ADMIN  | Get one      |
| PUT    | /teachers/:id   | ADMIN  | Update       |

---

### LEVELS & CLASSES

| Method | Endpoint                       | Access | Description       |
|--------|--------------------------------|--------|-------------------|
| POST   | /structure/levels              | ADMIN  | Create level      |
| GET    | /structure/levels              | Auth   | List levels       |
| POST   | /structure/classes             | ADMIN  | Create class      |
| GET    | /structure/classes             | Auth   | List classes      |
| GET    | /structure/classes/:id/students | Auth  | Students in class |

---

### NOTIFICATIONS

| Method | Endpoint                     | Access | Description       |
|--------|------------------------------|--------|-------------------|
| GET    | /notifications               | Auth   | My notifications  |
| PUT    | /notifications/:id/read      | Auth   | Mark as read      |
| POST   | /notifications/send          | ADMIN  | Broadcast         |

---

## Error Responses

All errors follow this shape:
```json
{ "success": false, "message": "Human-readable error", "details": ["..."] }
```

HTTP codes: `400` validation · `401` unauth · `403` forbidden · `404` not found · `409` conflict · `500` server error

---

## Pagination

All list endpoints support `?page=1&limit=20`. Response shape:
```json
{
  "data": [...],
  "pagination": { "total": 120, "page": 1, "limit": 20, "pages": 6 }
}
```

---

## Money

All amounts in **RWF as integers** (no decimals). `5000` = 5,000 RWF.
