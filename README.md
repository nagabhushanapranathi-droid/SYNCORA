# SYNCORA — Intelligent University Scheduling & Academic Continuity Co-Pilot

[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue.svg)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0.3-black.svg)](https://palletsprojects.com/p/flask/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-purple.svg)](https://vitejs.dev/)
[![FreeLLMAPI](https://img.shields.io/badge/AI%20Gateway-FreeLLMAPI-emerald.svg)](https://freellmapi.com)
[![Tests Passing](https://img.shields.io/badge/Tests-75%20Passing-brightgreen.svg)]()

SYNCORA is a comprehensive academic operations and faculty substitution management platform designed for higher education institutions. It provides automated faculty absence handling, conflict-free intelligent candidate ranking, multi-model substitute lesson planning grounded in official course syllabi, structured academic continuity tracking, and real-time operational analytics.

---

## 🏛️ Core Capabilities

1. **Automated Absence & Substitution Allocation**:
   - Absence intake automatically generates class-by-class substitution requests.
   - Suitability scoring algorithm dynamically evaluates faculty attendance, active timetable conflicts, department alignment, and historical workload balance.
2. **Central FreeLLMAPI AI Gateway**:
   - All institutional generative AI operations route centrally and exclusively through **FreeLLMAPI** (`/v1/models`, `/v1/chat/completions`).
   - SYNCORA never makes direct runtime calls to upstream models (Gemini, Llama, Claude); FreeLLMAPI acts as the single application-facing gateway.
   - Task-aware `ModelRouter` dynamically maps operations to specialized models (`fast`, `reasoning`, `balanced`, `analytics`).
3. **12-Point Academic Continuity Lesson Planner**:
   - Automatic pedagogical lesson plan generation upon substitution confirmation.
   - Grounded strictly in verified lecture progress records, syllabus units, and original faculty handover notes.
   - Enforces duration fit (e.g. 50-60 min sequence breakdown) and displays provisional warnings if prior progress is unconfirmed.
4. **Institutional Conversational Assistant**:
   - Context-grounded AI assistant powered by academic query tools querying live SQLite state.
   - Answers faculty inquiries on personal schedules and assigned lesson plans; answers administrative queries on missing handovers and department workloads.
5. **Fail-Soft Reliability & Zero-Crash Resilience**:
   - Resilient bounded exponential backoff retries, connection timeouts, and automatic deterministic academic fallbacks.
   - If the AI gateway is offline, unavailable, or rate-limited, all core workflows (substitutions, notifications, schedules, reports) continue uninterrupted.
6. **Multi-Role Security & Isolation**:
   - Strict session-based authentication with CSRF protection on all mutating actions.
   - Granular role boundaries: substitute faculty can view and edit only their own lesson plans and teaching feedback; administrators possess institutional oversight.

---

## 🏗️ Architecture & AI Gateway Flow

```
┌────────────────────────────────────────────────────────┐
│               Frontend (React 18 + Vite)               │
│  - Admin & Faculty Dashboards                          │
│  - Conflict-Free Substitution Modals & Allocations     │
│  - 12-Point Lesson Plan Visualizer & Editor            │
│  - Live FreeLLMAPI Gateway Telemetry & Diagnostics     │
└───────────────────────────▲────────────────────────────┘
                            │ REST / JSON (Central Axios Client)
┌───────────────────────────▼────────────────────────────┐
│                Backend (Flask Application)             │
│  - Role Scoping & CSRF Protection                      │
│  - SQLAlchemy ACID Transactional Boundaries            │
│  - Academic Allocation & Continuity Engines            │
└───────────────────────────▲────────────────────────────┘
                            │ OpenAI-Compatible Standard Protocol
                            │ (POST /chat/completions, GET /models)
                            │ Headers: X-Routed-Via: freellmapi
┌───────────────────────────▼────────────────────────────┐
│                 FreeLLMAPI Central Gateway              │
│                 (http://127.0.0.1:3001/v1)              │
│  - Model Discovery & Capabilities Caching              │
│  - Upstream Routing (Gemini, Llama, Claude)            │
│  - Rate Limiting & Gateway Quota Management            │
└────────────────────────────────────────────────────────┘
```

---

## ⚙️ Configuration & Environment Variables

Copy `.env.example` to create your local `.env`:

```bash
cp .env.example .env
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `FLASK_SECRET_KEY` | Flask cryptographic session key | `change_this_to_a_random_key` |
| `SYNCORA_AI_ENABLED` | Global toggle for AI features | `true` |
| `FREELLMAPI_BASE_URL` | Base URL for FreeLLMAPI gateway | `http://127.0.0.1:3001/v1` |
| `FREELLMAPI_API_KEY` | Authentication bearer key | `freellmapi-...` |
| `FREELLMAPI_DEFAULT_MODEL` | Default model alias or `auto` | `auto` |
| `FREELLMAPI_TIMEOUT` | Request timeout in seconds | `60` |
| `FREELLMAPI_MAX_RETRIES` | Max retries for transient errors | `2` |
| `FREELLMAPI_MODEL_FAST` | Fast model override (optional) | `gemini-2.5-flash` |
| `FREELLMAPI_MODEL_REASONING` | Reasoning model override (optional) | `gemini-2.5-pro` |

---

## 🚀 Installation & Local Development

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create virtual environment and activate
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed development database
python run.py --seed

# Start backend development server (port 5000)
python run.py
```

### 2. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite dev server (port 5173, proxies /api to port 5000)
npm run dev
```

---

## 🧪 Comprehensive Verification Suite

SYNCORA includes a comprehensive suite of 75 automated tests verifying academic models, multi-factor allocation scoring, FreeLLMAPI gateway resilience, fail-soft fallbacks, role permissions, and full-stack end-to-end workflows.

### Run All Backend Tests
```bash
python -m pytest backend/tests
```

**Result:**
```text
======================= 75 passed across 10 test suites in 32s =======================
```

### Run Frontend Production Build
```bash
cd frontend
npm run build
```

**Result:**
```text
✓ 2262 modules transformed.
✓ built in 23s
```

---

## 🛡️ Default Demo Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Administrator** | `admin@syncora.edu` | `Admin@123` |
| **Faculty** (any seeded faculty, e.g.) | `priya.sharma@syncora.edu` | `Faculty@123` |

---

## 📄 License
This project is licensed under the MIT License.
