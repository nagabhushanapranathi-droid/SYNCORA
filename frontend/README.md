# SYNCORA Frontend

Production-quality React 18 + Vite frontend for **SYNCORA** — Intelligent Academic Timetable & Substitution Engine.

## Design System

Strictly adhering to the SYNCORA Design Specification:
- **Primary**: `#E8A0B4`
- **Secondary**: `#F7DCE5`
- **Background**: `#FFF9FA`
- **Card**: `#FFFFFF`
- **Accent**: `#B85C7A`
- **Text Primary**: `#393039`
- **Text Secondary**: `#827680`
- **Border**: `#F0DCE3`
- **Status Colors**: Success `#6B9E78`, Warning `#E8A07A`, Error `#C0616A`, Info `#8B84C4`
- **Typography**: Headings in *DM Sans*, body in *Inter*
- Solid card backgrounds with subtle borders and shadows (zero glassmorphism, zero neon)

## Directory Structure

```
frontend/
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
└── src/
    ├── index.css
    ├── main.jsx
    ├── App.jsx
    ├── context/
    │   ├── AuthContext.jsx
    │   └── ToastContext.jsx
    ├── services/
    │   ├── api.js
    │   ├── authService.js
    │   ├── facultyService.js
    │   ├── departmentService.js
    │   ├── subjectService.js
    │   ├── attendanceService.js
    │   ├── timetableService.js
    │   ├── absenceService.js
    │   ├── substitutionService.js
    │   ├── aiService.js
    │   ├── notificationService.js
    │   └── reportService.js
    ├── components/
    │   ├── ProtectedRoute.jsx
    │   ├── Sidebar.jsx
    │   ├── TopBar.jsx
    │   ├── StatCard.jsx
    │   ├── Modal.jsx
    │   ├── Badge.jsx
    │   ├── LoadingSpinner.jsx
    │   ├── EmptyState.jsx
    │   ├── ConfirmDialog.jsx
    │   ├── NotificationBell.jsx
    │   └── Toast.jsx
    ├── layouts/
    │   ├── AdminLayout.jsx
    │   └── FacultyLayout.jsx
    └── pages/
        ├── LoginPage.jsx
        ├── admin/
        │   ├── Dashboard.jsx
        │   ├── Faculty.jsx
        │   ├── Attendance.jsx
        │   ├── Timetable.jsx
        │   ├── Absences.jsx
        │   ├── Substitutions.jsx
        │   ├── AIAssistant.jsx
        │   ├── Reports.jsx
        │   └── Settings.jsx
        └── faculty/
            ├── Dashboard.jsx
            ├── Timetable.jsx
            ├── Substitutions.jsx
            └── Notifications.jsx
```

## Running the Application

### 1. Install Dependencies
From the `frontend/` directory:
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
The app will be available at `http://localhost:5173`.
All `/api/*` requests will be proxied to `http://localhost:5000`.

### 3. Build for Production
```bash
npm run build
```

## Demo Credentials
- **Admin**: `admin@syncora.edu` / `admin123`
- **Faculty**: `faculty@syncora.edu` / `faculty123`
*(Quick-fill buttons available directly on the login page)*
