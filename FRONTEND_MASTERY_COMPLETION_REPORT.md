# SYNCORA — Frontend Mastery Phase Completion Report

**Branch:** `feature/syncora-genai-enhancements`  
**Base commit:** `b936d2e` (Phase 2 README)  
**Date of work:** 20 November 2026  
**Scope:** React 18 + Vite + Tailwind frontend; two small data-integrity fixes in `backend/app/routes/reports.py`.

This report is written to be checked, not admired. Where something was not done or could not be verified, it says so.

---

## 1. Original frontend audit

I read the Phase 2 integration report, then inspected the code and ran the app (Flask on :5000, Vite on :5173, driven with Playwright + Microsoft Edge).

The Phase 2 report states that "frontend-backend API synchronization" was complete. That holds for the backend routes; it did not hold for the frontend. What I found before changing anything:

| # | Problem | Effect |
|---|---|---|
| 1 | Every Flask endpoint returns `{ success, data }`, but pages read the envelope directly (`Array.isArray(res) ? res : res.faculty`) | Faculty, timetable, substitutions, absences, attendance and notification lists rendered **empty** |
| 2 | `/auth/me` returns `{ success, data: user }`; `AuthContext` stored the envelope as the user | Any **hard refresh** lost the role and the route guard redirect-looped to a **blank page** (reproduced with a screenshot) |
| 3 | Because of #1, the dashboard fell back to hardcoded numbers (`?? 42`, `?? 38`, `?? 92%`), Reports to invented charts (e.g. "Dr. Sarah Jenkins", "Week 1–4") and a canned AI paragraph | **Fabricated institutional data** was shown as real |
| 4 | Other fabricated values: candidate scores `95 - idx*7`, "94% match", login times "08:45 AM", "12h / wk" workload, "98%" attendance, "Uptime 99.98%", "Gemini 1.5 Pro … Configured" | Misleading UI |
| 5 | Manual assign sent `substitute_faculty_id`/`reason`; API expects `faculty_id`/`notes` | Manual assignment always failed (400) |
| 6 | Timetable create/update sent `day`; API requires `day_of_week`. Time rows were hardcoded (`11:15–12:15`…) and did not match data (`11:00–12:00`) | Classes could not be created; some classes never appeared in the grid |
| 7 | Subject assignment POSTed a list to `/faculty/<id>/subjects`, which accepts one `subject_id` | Saving qualified subjects failed |
| 8 | Faculty pages queried with `user.id` and an ignored `substitute_id` param | "My substitutions" showed **everyone's** substitutions |
| 9 | Errors read `err.response.data.message`; the API uses `error` | Users saw generic messages instead of the real reason |
| 10 | The CSRF token was cached for the page lifetime; Flask rotates it on logout | Logout → login in the same tab caused 403s on every action |
| 11 | Faculty edit offered "Change password"; the API ignores it | A control that did nothing |
| 12 | README and Settings listed `admin123` / `faculty@syncora.edu` | Credentials that do not exist (seed uses `Admin@123`, `Faculty@123`) |
| 13 | Backend `/reports/analytics` returned a **hardcoded** `frequently_affected_slots` list; AI usage totals read keys the providers never write | Fabricated chart data; AI usage always reported 0 |

Inventory before the redesign: 9 admin pages, 4 faculty pages, 12 shared components (one 576-line lesson-plan modal), 2 layouts, 12 services, one CSS file with light-only hex values. No department/subject UI, no admin notification page, no faculty assistant, no theme system, no responsive navigation (the sidebar was a fixed 256 px column at every width).

---

## 2. Design system architecture

- **Tokens:** `frontend/src/index.css` defines one semantic vocabulary twice — under `[data-theme="light"]` and `[data-theme="dark"]` — as `R G B` triplets (canvas, chrome, surface 1–3, line, ink 1–3, accent family, brand, ok/warn/info/danger families, focus, radii, shadows, rule style, canvas pattern).
- **Tailwind** (`tailwind.config.js`) maps every colour to `rgb(var(--token) / <alpha-value>)`, so `bg-accent/10` works in both themes. No component contains theme conditionals for colour.
- **Component classes** (`@layer components`): `sheet`, `sheet-feature`, `panel`, `btn-*`, `input`, `field-*`, `chip-*`, `seg`, `tbl`, `nav-link`, `rule`, `ground-*` (data provenance), `md` (Markdown), `skeleton`.
- **Typography:** Nunito Sans (headings, 600–900) and Inter (body). Scale 11/12/13/14/16/18/22/28/36 px. Sentence-case labels; no all-caps eyebrows; tabular numerals for data.
- **Hierarchy instead of identical cards:** sheets (primary), inset panels (secondary), stickers/chips (tertiary), plus one "feature" sheet per page (ribbon band in light, stitched lining in dark).

## 3. Light theme — "Ribbon" (Hello Kitty-inspired)

| Role | Value |
|---|---|
| Canvas | `#FFF9EF` vanilla cream, faint cocoa dot grid (notebook paper) |
| Sheets | `#FFFFFF` |
| Ink | `#51413F` cocoa; secondary `#75635F` (5.4:1 on cream) |
| Primary action | `#C94653` — the brief's cherry `#D95763` deepened so white button text passes AA (4.7:1); `#D95763` is kept for bows and marks |
| Positive / warning / category | mint, butter, lavender families with darkened text inks (all ≥ 4.5:1) |

Pink appears only as the active-page ribbon, bows, small chips and the primary button. Large surfaces are cream and white.  
Motifs: cherry bow (brand mark, favicon), flowers and sparkles around empty states, dotted "perforation" rules, ribbon band on feature sheets.

## 4. Dark theme — "Midnight" (Kuromi-inspired)

| Role | Value |
|---|---|
| Canvas | `#17141F` with sparse lavender stars and moons (≈4.5% opacity) |
| Sheets / elevated | `#211C2B` / `#2A2437` / `#32293F` |
| Borders | `#443950` |
| Ink | `#F7F1FA`, `#C2B7D0`, `#968AA7` (5.2:1 on surface) |
| Primary action | **lavender** `#D8C9E8` with plum text — not an inverted cherry |
| Brand marks | coral-pink skull and bows, soft purple ribbon |

It differs from light mode by more than colour: smaller radii, dashed "stitched" rules and linings instead of soft shadows, skull/moon motifs instead of bows/flowers, lavender as the action colour, and the hooded mascot variant.

## 5. Theme switching

- `ThemeContext` stores `light | dark | system` under `localStorage['syncora-theme']` (visual preference only; wrapped in try/catch for private mode).
- An inline script in `index.html` applies the theme **before first paint** — verified by blocking `main.jsx` in Playwright: `data-theme` was already `dark` under a dark system preference.
- Toggle in the top bar and on the sign-in page; three-way choice (Ribbon / Midnight / Match device) in Settings and Profile.
- Switching is instant; transitions are suppressed for the frame in which the theme flips. System changes are followed live when "Match device" is chosen.
- Verified: toggle → `dark` stored → reload → still `dark`.

## 6. Components created

`ThemeContext`, `ThemeToggle` + `ThemePreference`, `Mascot` (Cora, two variants, four moods), `motifs` (Bow, Sparkle, Flower, Moon, Skull, SignatureMotif, StickerScatter), `ui` (PageHeader, SheetHeader, ErrorState, Segmented, Field, SearchInput, Avatar, Meta, Meter), `Markdown` (safe React renderer, collapsible tables), `ChartCard` (chart + table view + states), `AppShell`, `lib/chartTheme`, `lib/useLoad`, `lib/useMediaQuery`, `lib/format`, `lib/notifications`, `lib/facultyData`, `public/favicon.svg`.

New pages: `admin/Academics` (departments & subjects), `LessonPlanPage`, `NotificationsPage` (both roles), `AssistantPage` (both roles), `faculty/Profile`.

## 7. Components modified / removed

Rewritten: `Badge`, `Modal` (labelled, focus trap, Escape, focus restore, bottom sheet on phones), `ConfirmDialog`, `EmptyState`, `LoadingSpinner` (+ skeletons), `Toast`, `ToastContext` (memoised, live region), `Sidebar` (grouped nav, ribbon active state, drawer mode), `TopBar`, `NotificationBell`, `ProtectedRoute` (no redirect loop), `AuthContext`, `api.js`, all services, both layouts.

Removed after their features moved: `LessonPlanModal.jsx` → `LessonPlanPage`; `admin/AIAssistant.jsx` → `AssistantPage` (old `/admin/ai-assistant` redirects); `faculty/Notifications.jsx` → `NotificationsPage`; `StatCard.jsx` (unused).

## 8. Admin interface

- **Overview:** greeting, one ledger sheet (faculty on roll, present, absent, awaiting decision, cover arranged), decision queue with approve/reject (confirm on reject), live attendance donut (present/absent/logged out/not marked), operational alerts derived from records, today's timetable by hour with cover status and a "Now" marker, 7-day disruption chart, recent activity timeline.
- **Attendance:** every active faculty member, including those not marked; date stepper; mark or override with check-in/out and notes; explains that substitutes need a check-in time.
- **Absences:** form with live preview of the affected classes, reason presets, duplicate-absence warning + confirmation, "what happens next", generated requests with links, history with cover summary.
- **Substitutions:** status tabs with counts, search, master-detail on desktop / dialog on phones, class facts, decision box per status (approve, assign someone else, reject, suspend, re-run ranking, reassign), candidate ranking with the four score components as a segmented bar, reasons, non-expert warning, acknowledgment state, link to the lesson plan.
- **Timetable:** filters (department, faculty, class), week grid with rows taken from the data, department colours + legend, today's column, clash detection (same faculty or room overlapping — the seed data has three real clashes on Thursday 14:00), this week's cover overlay, day view on small screens, add/edit/remove with the backend's clash errors shown inline.
- **Faculty:** status/department/search filters, today's attendance, approved cover count, qualified subjects editor, profile with cover history, add (with optional initial password and subjects) / edit / deactivate (copy states what deactivation actually does).
- **Departments & subjects:** department sheets with faculty/subject/class counts and details; subject table with qualified faculty and weekly classes; create, edit, delete (disabled with an explanation when the API would refuse).
- **Reports, Settings:** see §13 and below.
- **Settings:** appearance, account, live system status (database, gateway, version, environment, faculty), AI gateway (§13).

## 9. Faculty interface

- **My day:** next class (or cover duty) with a countdown, attendance status and check-in time, counts, today's agenda merging own classes and cover duties, upcoming duties with **Acknowledge** and lesson-plan availability, own classes covered by colleagues with a handover link, latest notifications.
- **My timetable:** weekly grid of own classes + this week's cover duties (dashed) + classes being covered (muted), day tabs on phones, later duties listed.
- **Cover duties:** Upcoming / Proposed (ranked first, awaiting admin) / Past / My classes covered.
- **Profile:** record, today's status, qualified subjects, cover history, appearance.
- **Ask Cora** and **Notifications** (shared pages).

## 10. Lesson planner

A dedicated page at `/admin/lesson-plan/:id` and `/faculty/lesson-plan/:id`:

- **Header:** lesson title, subject + code, class + section, date, time + duration, room, department, semester (**shown as "Not recorded" — the data model has no semester**), original and substitute faculty, plan status ("Ready to read" … "Class taught"), provenance chip (AI-generated via provider/model **or** built from syllabus rules), acknowledgment state, and the sentence "The class counts as taught only once progress is recorded."
- **Continuity (live from `/academic-context`, falls back to the snapshot stored with the plan):** four visually distinct cards — *Verified as taught* (mint, seal, solid), *Recorded as in progress* (neutral, dashed circle), *Suggested next* (lavender dashed + sparkle if the source says AI, otherwise neutral "calculated"), *Unverified information* (butter with stripes). Empty cards say exactly what is missing. Provisional-plan warning, handover note, syllabus.
- **Plan:** objectives, topics (marked when recorded as taught), prerequisites, **visual schedule** parsed from the stored teaching sequence (`0–9 min`…) or `time_allocation`, with a check that it fits the scheduled minutes, numbered sequence, examples, activities, engagement questions, assessment, homework, materials. Falls back to the stored Markdown if no structured plan exists.
- **After the class:** record a topic as fully taught or partly covered (POST `/progress`; completed topics also update `topics_completed`), notes/feedback/status (PUT), handover note (POST `/handover`, prefilled).
- **Access:** mirrors the API — admin, substitute and original faculty; others see "This lesson plan is private". Generation/regeneration only for admin or the assigned substitute.
- **Print:** navigation and actions hidden, sheets flattened.

## 11. Notification experience

Stored title and message are shown verbatim. Categories (assignments, approvals, changes/rejections, lesson plans, timetable, cancellations, handover, attendance, announcements, reminders) are read from the stable title prefixes written by `communication_service`. Priority comes from the stored type and the "[Short Notice]" marker. Unread dot and tint, All/Unread tabs, category filter chips, day groups, "Read full message", mark read / mark all read, links to the lesson plan or request. The bell polls every 30 s and wiggles once when the unread count rises (disabled under reduced motion). **Notification preferences are not offered: the backend has no preference model.**

## 12. AI assistant — Cora

Original mascot: a round white cat with a cherry bow and pink nose by day; the same cat in a plum hood with bat-point ears, a crescent-moon pin, a wink and a fang after dark. Drawn as inline SVG for SYNCORA; no licensed artwork used.

Flow is unchanged: **React → Flask `/api/ai/chat` → FreeLLMAPI**. The page adds role-aware suggested questions (phrased to reach the backend's grounding tools), Markdown answers, typing indicator with the thinking mascot, error state with "Ask again", timestamps, copy, and a provenance row on every answer:

- *AI-written from the records below* vs *Rule-based answer (AI gateway offline)* (detected from the backend's fallback header) vs *AI-written suggestion, no institutional records used*;
- "Based on" chips for each record set the backend attached (`context`), styled as institutional record or calculated, expandable to show the actual rows, with a bar chart for cover workload and collapsible tables;
- a warning chip when progress records include unverified entries.

Faculty now have the assistant too (the endpoint already supported faculty scoping).

## 13. Visual reporting

All charts use Recharts (no second library). Categorical palettes per theme were checked with the dataviz palette validator against each theme's sheet colour (light `#C94653 #7A5CC0 #2B9370 #C08A12` passes every check; dark `#9B7FD6 #D8606E #B8891E #3E9C78` passes, one adjacent pair at CVD ΔE 7.7, so legends are always shown). Status colours (present/absent) are separate from the categorical order.

Charts: daily attendance (area), present vs absent (donut), attendance by department (bars), available faculty today (segmented bar), faculty workload (stacked: timetabled + cover hours), requests by month, requests by subject, most affected hours, classes by department, plus continuity metrics, AI usage and the operational briefing (today's counts as records, narrative labelled as generated). Filters: date range (presets + custom), department (server-side), subject and faculty (applied to substitution/workload data client-side). Every chart has loading, error, empty states and a **table view**. Print layout included.

**AI configuration** (Settings): gateway status and message, base URL, server-masked key, models discovered, last latency, connectivity test with latency, primary/fallback provider, default model from `/v1/models`, timeout and retries, per-provider test, calls/successes/failures/tokens, recent errors. No key ever reaches the browser or localStorage.

## 14. Responsive design

Sidebar becomes a slide-over drawer below 1024 px. Tables switch to stacked lists on phones (attendance, faculty, absences); wide grids scroll inside their own container. Substitution detail becomes a bottom-sheet dialog on phones; timetables switch to day tabs; the assistant puts the conversation first on phones. Checked at **390, 820, 1280 and 1440 px** in both themes: no horizontal overflow of the page or the main region (one overflow found on Settings at 390 px — an absolutely positioned screen-reader label escaping a scroll container — and fixed).

## 15. Accessibility

Visible focus on every control (`:focus-visible` outline / focus ring), skip link, landmark labels, one H1 per page, labelled dialogs with focus trap and restore, `role="switch"`/`radiogroup`/`tablist` where appropriate, live regions for toasts and chat, `aria-current`/`aria-expanded`, form errors linked with `aria-describedby`, status never conveyed by colour alone (text labels, icons, shape: dashed vs solid vs striped provenance), chart table views, reduced-motion respected, contrast computed for text tokens (≥ 4.5:1 for body text in both themes). Not done: a screen-reader walkthrough with NVDA/VoiceOver.

## 16. Frontend–backend integration verification

`flows.mjs` (Playwright, real UI, then reads the result back through the API with the same session) — **20/20 passed**:

1. Hard refresh keeps the admin session  
2. Create department (code uppercased) 3. Delete empty department  
4. Edit subject description 5. Assign qualified subjects  
6. Timetable clash rejected with the backend's message 7. Class created with `day_of_week` 8. Class removed  
9. Attendance marked with check-in time  
10. Manual assignment saved (`ASSIGNED`, notes stored)  
11. AI settings saved  
12. No page errors (admin)  
13. Faculty acknowledges a duty  
14. Partial progress recorded (appears under in-progress) 15. Completed topic recorded and marked on the plan  
16. Teaching notes saved 17. Notifications marked read  
18. No page errors (faculty) 19. Unrelated faculty sees the private-plan message  
20. Original faculty saves a handover note

Also exercised through the UI: reporting an absence (two requests ranked), approving a recommendation (lesson plan + two notifications generated), assistant questions as admin and faculty (rule-based mode). Every route was loaded in both themes with console and network capture: **no console errors and no failed API calls** (expected `401` on `/auth/me` before sign-in excluded).

The FreeLLMAPI gateway was **not reachable** in this environment, so AI paths were verified in their fallback mode only.

## 17. Routes tested

Admin: `/admin/dashboard`, `/attendance`, `/absences`, `/substitutions` (+ `?id=`, `?status=`), `/timetable`, `/faculty`, `/academics`, `/reports`, `/assistant`, `/ai-assistant` (redirect), `/notifications`, `/settings`, `/lesson-plan/:id`.  
Faculty: `/faculty/dashboard`, `/timetable`, `/substitutions`, `/lesson-plan/:id`, `/assistant`, `/notifications`, `/profile`.  
Public: `/login`, `/` and unknown routes (redirect).  
Roles: admin, substitute faculty (Vikram Iyer), original faculty (Rahul Verma), unrelated faculty (Priya Sharma).

## 18. Production build

```
cd frontend && npm run build
vite v5.4.21 — 2,277 modules — built in ~9 s, exit code 0
dist/assets/index-*.css    65.5 kB │ gzip 11.8 kB
dist/assets/index-*.js    288.4 kB │ gzip 93.5 kB   (was one 967 kB bundle)
dist/assets/generateCategoricalChart-*.js 387.9 kB │ gzip 106.8 kB (Recharts, loaded with chart pages)
+ one lazily loaded chunk per page (2–35 kB)
```

## 19. Regression tests

```
python -m pytest backend/tests
78 passed (75 baseline + 3 new in test_reports_data_integrity.py), 0 failed
```

There is no frontend unit-test runner in this project; frontend verification is the Playwright flows and screenshots described above. Those scripts were kept in a temporary folder, not committed.

## 20. Git

Commits on `feature/syncora-genai-enhancements` (no force-push, nothing merged into `main`):

1. `feat: introduce dual hello kitty and kuromi theme system`
2. `fix: synchronize frontend data layer with flask response envelopes`
3. `feat: establish reusable design components and app shell`
4. `style: redesign admin dashboard, operations and planning pages`
5. `style: implement responsive analytics, reporting and AI configuration`
6. `feat: lesson planner workspace, notification centre and SYNCORA assistant`
7. `docs: frontend mastery completion report and corrected demo credentials`

Testing mutated the tracked SQLite database and tracked `__pycache__` files; both were restored to the committed versions before committing (database checksum matches the original).

## 21. Remaining limitations

- **AI gateway offline here.** AI-generated lesson plans, chat replies and briefings were seen only in rule-based fallback. With the gateway configured but unreachable, reporting an absence or approving cover takes roughly 15–40 s because the backend retries each AI call; the UI shows progress but the delay is backend behaviour.
- **Exposed credential.** `.env.example` (and the Phase 2 report) contain a full FreeLLMAPI key. It should be rotated and replaced with a placeholder. I did not change it.
- **Saved AI settings are not durable.** `/api/ai/config` writes the `AIConfig` table, but nothing reads it at start-up; the UI states that the environment file applies after a restart.
- **Not supported by the API, so not built:** notification preferences, semesters, editing the structured lesson-plan fields (only notes, feedback, status and completed topics are editable), changing a faculty member's email or password, reactivating a deactivated faculty account (the update route does not re-enable the user login).
- **Assistant:** the backend ignores `history`, so there is no multi-turn memory; "rule-based" detection relies on the backend's fallback heading; "What am I teaching?" returns tomorrow's schedule (backend default), so the prompt is phrased "next day of classes".
- **Analytics:** the backend reports a 100% rate for days without any check-ins; the frontend shows those days as "no records" and computes the headline rate only from recorded days.
- **Security observations (unchanged):** several read endpoints (`/substitutions`, `/faculty`, `/timetable`) do not require authentication.
- **Testing breadth:** Chromium (Edge) only; no Firefox/Safari, no screen-reader pass, no landscape-phone pass. The Playwright scripts are not part of the repository.
- **Repository hygiene:** compiled `__pycache__` files are tracked in git and change on every test run.
