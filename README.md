# Break It Down — Project Specification

## 0) Goal (MVP)
Build a to-do list web app where a logged-in user can create tasks, and for any task the app can generate exactly 3 actionable steps using an AI service. The app must remember tasks per user across sessions.

This project is intentionally scoped to encourage simple, predictable AI behavior and clean system boundaries.

---

## 1) High-level Architecture
This project consists of two services plus a hosted database/auth provider:

- Web App (Next.js + TypeScript)
  - Frontend UI
  - Backend-for-Frontend using Next.js Route Handlers
  - Handles auth, task CRUD, and calling the AI service

- AI Service (Python FastAPI)
  - Generates exactly 3 steps for a task
  - No direct database access
  - No auth logic beyond basic request validation

- Database/Auth (Supabase)
  - User authentication
  - PostgreSQL database
  - Row Level Security (RLS)

The web app communicates with the AI service over HTTP.

---

## 2) Repo / Folder Structure
The repository is a single monorepo with two isolated services.

break-it-down/
├── break-it-down-web/        # Next.js app (frontend + API routes)
├── break-it-down-ai/         # FastAPI AI service
└── README.md

Notes:
- Do not mix Python and Node code in the same folder.
- Folder names must not contain spaces.

---

## 3) Tech Stack Requirements

### Web App
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase JS client
- ShadCN
- Next.js Route Handlers for backend logic

### AI Service
- Python 3.x
- FastAPI
- Uvicorn
- Single responsibility: step generation only

### Database/Auth
- Supabase Auth (Email/Password for MVP)
- Supabase Postgres
- Row Level Security enabled on all user data

---

## 4) Task Decomposition Rules (Strict)
Task decomposition is a one-time, non-recursive action.

- Only top-level tasks may be broken down by the AI.
- Once a task has been broken down into steps, it cannot be broken down again.
- Subtasks (steps) are terminal and can never be decomposed.
- The AI must never be called on a task that already has steps.
- Recursive or multi-level task decomposition is explicitly disallowed.

These rules must be enforced at:
- the UI level
- the backend level
- the API contract level

---

## 5) MVP User Stories
1. User can sign up and log in.
2. User can access a protected /app page after logging in.
3. User can create a top-level task.
4. User can archive (strike-through), edit, or delete a task.
5. User can click “Break it down” on a main task once to generate exactly 3 steps.
6. After steps are generated:
   - the task cannot be broken down again
   - the “Break it down” action is disabled or hidden
7. Steps are displayed under the task as checkboxes.
8. User can check steps off (strike through).
9. User can mark a task as completed.
10. User can log out.

---

## 6) UI Requirements

### Routes
- /login — public (sign in / sign up)
- /app — protected (main task list)

### /app Layout
- Header: app title + Logout button
- Task input row: text input + Add button
- Task list:
  - Task title
  - Status indicator (active / completed / archived)
  - Actions:
    - “Break it down” (only if task has no steps)
    - Complete
    - Archive/Delete
  - Steps (if generated):
    - Exactly 3 checkboxes
    - No AI actions on steps

### UI Rules
- The “Break it down” button is shown only if the task has zero steps.
- After steps are generated, the button must be permanently disabled or hidden.
- Subtasks must never show AI-related actions.

---

## 7) Data Model (Supabase)

### tasks
- id (uuid, primary key, default gen_random_uuid())
- user_id (uuid, references auth.users(id))
- title (text, not null)
- status (text, not null)
  - active | completed | archived
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

### steps
- id (uuid, primary key, default gen_random_uuid())
- task_id (uuid, references tasks(id) on delete cascade)
- user_id (uuid, references auth.users(id))
- step_index (int, values 1–3)
- text (text, not null)
- done (boolean, default false)
- created_at (timestamptz, default now())

Optional (post-MVP):

### ai_generations
- id
- task_id
- user_id
- prompt
- response_raw
- model
- latency_ms
- created_at

---

## 8) Security (Row Level Security)
Enable RLS on all user-owned tables.

Policies:
- Users may only SELECT, INSERT, UPDATE, or DELETE rows where user_id = auth.uid()

RLS must be enforced even when requests come from server-side code.

---

## 9) API Contract Between Web and AI

### AI Service Endpoint
POST /generate-steps

Request:
{
  "task": "string"
}

Response:
{
  "steps": ["string", "string", "string"]
}

Hard requirements:
- Always return exactly 3 steps
- Steps must be short, actionable, and non-overlapping
- The AI must assume the input is a top-level task
- Subtasks must never be passed to the AI

---

### Web App Server Endpoint
POST /api/tasks/:id/generate-steps

Behavior:
1. Verify user session.
2. Verify task ownership.
3. Check that the task has no existing steps.
4. Call the AI service.
5. Persist exactly 3 steps.
6. Return the steps.

Backend validation rules:
- If a task already has steps, the request must be rejected.
- This rule must be enforced server-side, not just in the UI.

---

## 10) Environment Variables

### Web App (.env.local)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- AI_SERVICE_URL=http://localhost:8000

### AI Service (.env)
- LLM_API_KEY
- ALLOWED_ORIGINS=http://localhost:3000 (optional)

---

## 11) Local Development Ports
- Next.js: http://localhost:3000
- FastAPI: http://localhost:8000

---

## 12) Development Milestones

### Milestone 1 — Web scaffolding + Auth
- Create Next.js app
- Configure Supabase
- Login/logout
- Protected /app route

### Milestone 2 — Tasks + RLS
- Create tables
- Enable RLS
- Task CRUD UI

### Milestone 3 — AI service + Step generation
- Create FastAPI app
- Implement /generate-steps
- Wire web app to AI service
- Persist and display steps

### Milestone 4 — Polish
- Loading states
- Error handling
- Validation

---

## 13) Definition of Done (MVP)
- Authenticated users can manage their own tasks.
- Each task can be broken down once into exactly 3 steps.
- Steps are final and cannot be decomposed.
- All user data is protected by RLS.
- The system behaves predictably and consistently.
