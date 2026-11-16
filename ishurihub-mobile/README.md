# IshuriHUB Mobile — Android UI Prototype

A dedicated, native-feeling mobile application for **IshuriHUB Mobile**, faithfully reproducing the visual design and mobile user interface from the `IshuriHUB Mobile Design.html` specification.

> **Design-Only Implementation Notice**:
> This phase is design-only. No backend functionality, Supabase integration, production authentication, databases, or physical NFC hardware are connected. All screens navigate seamlessly with realistic Rwandan sample data and interactive prototype state.

---

## 📱 Technology Stack

- **Framework**: React Native 0.88 + Expo SDK 58
- **Routing**: Expo Router (file-based navigation with tabs and nested stacks)
- **Language**: TypeScript (strict type safety)
- **Icons**: Lucide React Native
- **Design Tokens**: Custom theme tokens extracted directly from design CSS variables

---

## 🎨 Visual Identity & Design Tokens

- **Brand Colors**:
  - Forest Green (Attendance / Gate Hero): `#14532D`
  - Primary Green (Buttons / Active indicators): `#15803D`
  - Secondary Green (Present / Balance positive): `#166534`
  - Active Tab Tint / Badges: `#E3F5E9`
  - Light Accent Text: `#D8F3E1`
  - Admin Avatar (AU): `#0F766E`
  - Student Avatar (TJ): `#A21CAF`
  - Background: `#F5F8F6`
  - Card Surface: `#FFFFFF`
  - Borders: `#DFE7E3` / `#C9D6D0` / `#E8EEEB`
- **Typography**:
  - Primary interface: Plus Jakarta Sans hierarchy (800 / 700 / 600 / 500)
  - Technical identifiers (Cards, IDs, Codes): JetBrains Mono (`ADM-2026-RLIB7`, `ISH-001`, `KNT-XXX-2026-00001`, `STF-F3H9M`)

---

## 🗺️ 18 Screens Implemented

### A. Main Application
1. **Home (`/(tabs)`)** — School identity (`IshuriHUB Academy · ISH-001`), User avatar (`AU`), Today's date, Attendance hero card with `Start scanning`, 4-grid stats summary (Present, Absent, Late, Excused), School totals (Students, Workers), Bottom Navigation.
2. **Students (`/(tabs)/students`)** — Title and count (`2 total`), Search bar (`Search by name or ID`), Class filter pills (`All 2`, `Senior 1 · Class A 1`), Student card list (`TJ - Tumukunde Josiane`), Floating `Add student` action button.
3. **Student Profile (`/student/[id]`)** — Back arrow, `Student` title, `Edit` button; Large student avatar (`TJ`, `#A21CAF`), Full name, admission number, `Senior 1 · Class A · 25y · M`; Status & Balance cards; Navigation to Attendance, Library, Discipline, and Health.
4. **Attendance (`/(tabs)/attendance`)** — `Tap card` vs `Bulk mark` tabs; Scan modes (`Auto`, `Tap in`, `Tap out`) + helper descriptions; Big `Start scanner` action; Manual card lookup input + `Use Virtual Tap`; Today's 4-stat summary; `Download attendance PDF`; Class roster list with individual status toggles; Attendance settings sheet modal.
5. **Workers (`/(tabs)/workers`)** — Active worker count (`2 active`), Role filter pills (`All 2`, `Teacher`, `Cantinier`, `Bursar`, `School Nurse`, `Discipline Master`, `Librarian`, `Administrator`), Worker cards (`Ganza Karambizi`, `GATETE BOD`), Floating `Add worker` button; Interactive bottom sheet modal with `Show QR code`, `Edit details`, `Deactivate`, `Delete worker`.
6. **More (`/(tabs)/more`)** — Current user profile card (`AU - Admin User`, `Administrator`), School switcher button (`IshuriHUB Academy · ISH-001 Switch`), Operational grid (`Canteen`, `Schools Hub`, `Library`, `Discipline`, `Health`), Quick role portals preview menu, App settings (`Settings`, `Dark mode` toggle, `System Tests`, `Log out`), `Built by GACONDO LABS` footer.

### B. Operational Modules
7. **Canteen (`/canteen`)** — `Verify photo` and `Add product` actions; Search menu items; Category pills (`All`, `Snacks`, `Drinks`, `Meals`, `Fruits`, `Bread`, `Other`); 2-column product grid with prices, add/stepper quantity controls; Today's sales counter; Floating cart bar; Full order summary bottom sheet modal with item breakdown and simulated `Student tap to pay`.
8. **Library (`/library`)** — `Overview` vs `Book catalog` tabs; 4 stat cards (`Total books`, `Active borrows`, `Overdue`, `Pending fines`); `Students holding books` section with `All (0)` and `Overdue (0)` filters; Empty catalog state with `Add book`; Footer actions (`Lend a book`, `Return`).
9. **Discipline (`/discipline`)** — `NFC not available` card with manual student card number entry, `Open` lookup, and `Use Virtual Tap`; `All records` section with search bar and empty state (`No discipline records`).

### C. Role-Based Portals
10. **School Admin Portal (`/portals/admin`)** — Administrator identity (`AU`), school name & code; Attendance today 4-stat grid; School totals (`Students`, `Workers`); `School overview` operational rows with quick links.
11. **Librarian Portal (`/portals/librarian`)** — Librarian identity; Quick actions (`Lend a book`, `Return a book`); 4-stat library overview; Overdue books empty state; Librarian bottom navigation (`Home`, `Catalog`, `Borrows`, `Fines`, `Profile`).
12. **Student Portal (`/portals/student`)** — Student profile header (`TJ - Tumukunde Josiane`, `Senior 1 · Class A`, `ADM-2026-RLIB7`); `Show my card` action; Canteen balance card & Attendance points card; `My school life` record summary; Student bottom navigation (`Home`, `Attendance`, `Wallet`, `Library`, `Profile`).
13. **Parent Portal (`/portals/parent`)** — Parent header with child selector (`TJ - Tumukunde Josiane`); Today at school card (`No tap-in yet`); Canteen balance hero card with `Top up` action; `Josiane's records` summary; Parent bottom navigation (`Home`, `Attendance`, `Payments`, `Messages`, `Profile`).
14. **Discipline Office Portal (`/portals/discipline`)** — Discipline office identity; `Add discipline record` button; Card search input; Records today and All records counters; Recent records empty state; Discipline bottom navigation.
15. **Nurse Portal (`/portals/nurse`)** — School nurse identity; `New health visit` button; Student card search input; Visits today and In sick bay now counters; Recent visits empty state; Nurse bottom navigation.
16. **Bursar Portal (`/portals/bursar`)** — Bursar identity; `Collected today` hero banner with `Record payment` action; `School money` breakdown; Recent payments empty state; Bursar bottom navigation.
17. **Gate Portal (`/portals/gate`)** — Direction switcher (`Coming in` / `Going out`); Tap scanner hero with `Start scanner` and `Use Virtual Tap`; Instant student identification result card (`TJ - Tumukunde Josiane`, `Inactive student. Check with the office`, `Allow in` / `Send to office`); Gate totals (`Came in`, `Went out`, `Inside now`).

### D. Permission Design
18. **Who Can See What (`/portals/permissions`)** — Complete permission visibility matrix; Interactive legend (`Manage` - Green, `View` - Light Green, `Own` - Blue, `Totals` - Amber, `—` - Muted); 9 functional areas across 8 school roles with horizontal scrolling optimized for Android screens.

---

## 🚀 Running the Application Locally

### Prerequisites
- Node.js (v18+)
- Android Studio / Android Emulator or Expo Go app on a physical Android device

### Steps to Run

```bash
# 1. Navigate to the mobile project directory
cd "C:\Users\user\Desktop\KNOTTY\ishurihub-mobile"

# 2. Start the Expo development server
npx expo start

# 3. Press 'a' to open directly in a running Android Emulator
# OR scan the terminal QR code with the Expo Go app on your Android device
```

---

## 🏗️ Project Structure

```
ishurihub-mobile/
├── app/
│   ├── _layout.tsx              # Root Stack navigation & Safe Area Provider
│   ├── (tabs)/
│   │   ├── _layout.tsx          # 5-tab Bottom Navigation layout
│   │   ├── index.tsx            # Screen 1: Home Dashboard
│   │   ├── students.tsx         # Screen 2: Students List
│   │   ├── attendance.tsx       # Screen 4: Attendance & Scanner
│   │   ├── workers.tsx          # Screen 5: Workers List
│   │   └── more.tsx             # Screen 6: More Menu & Portal Links
│   ├── student/
│   │   └── [id].tsx             # Screen 3: Student Profile
│   ├── canteen.tsx              # Screen 7: Canteen POS
│   ├── library.tsx              # Screen 8: Library
│   ├── discipline.tsx           # Screen 9: Discipline
│   └── portals/
│       ├── admin.tsx            # Screen 10: School Admin Portal
│       ├── librarian.tsx        # Screen 11: Librarian Portal
│       ├── student.tsx          # Screen 12: Student Portal
│       ├── parent.tsx           # Screen 13: Parent Portal
│       ├── discipline.tsx       # Screen 14: Discipline Office Portal
│       ├── nurse.tsx            # Screen 15: Nurse Portal
│       ├── bursar.tsx           # Screen 16: Bursar Portal
│       ├── gate.tsx             # Screen 17: Gate Portal
│       └── permissions.tsx      # Screen 18: Who Can See What Matrix
├── components/
│   ├── AppHeader.tsx            # School identity, notifications & avatar
│   ├── BottomNav.tsx            # Custom 5-tab bar matching design SVGs
│   ├── StatCard.tsx             # 4-stat summary and 2-card totals
│   ├── SearchInput.tsx          # Rounded search input with clear button
│   ├── FilterPills.tsx          # Horizontal scrollable category/role filter chips
│   ├── WorkerDetailSheet.tsx    # Bottom sheet for worker actions
│   ├── AttendanceSettingsSheet.tsx # Bottom sheet for attendance options
│   └── VirtualTapModal.tsx      # Simulated NFC card tap for prototype testing
├── constants/
│   └── theme.ts                 # Design tokens (Colors, Typography, Radii, Spacing)
├── data/
│   └── mockData.ts              # Authentic Rwandan fictional dataset
└── types/
    └── index.ts                 # Full TypeScript definitions
```
