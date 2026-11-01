# 🏛️ Civic Triage AI (v2.0)

> **Snap a pothole. AI verifies it. The city is on the clock.**
> AI-powered civic grievance triage, PostGIS spatial clustering and automated SLA escalation.

*Built by Team **TokenSmiths** for **Forge '26***

---

## 📌 The Problem

Cities receive thousands of complaints about potholes, burst pipes, garbage, open manholes and exposed wiring. Most reporting systems fail in the same three ways:

- **Duplicates:** hundreds of people report the same pothole, and officers drown in redundant tickets.
- **Fakes:** spam, unrelated photos and AI-generated images clog the verification pipeline.
- **No accountability:** complaints sit unattended with no deadline, no escalation and no proof that anything was fixed.

## 💡 Our Solution

Civic Triage AI turns a citizen's photo into a **verified, prioritised, deadline-bound ticket**:

1. **Report:** a citizen uploads a wide shot and a close-up with GPS. No paperwork.
2. **Verify:** Gemini Vision checks that the photos are real and show public infrastructure, matches them to the chosen category and rates the danger from 1 to 5. A forensic metadata scan adds a second check for AI-generated images.
3. **Cluster:** PostGIS merges reports within ~50 m into one master issue, so ten complaints become one louder signal.
4. **Escalate:** each ticket gets a department, an SLA deadline based on severity, and automatic escalation when it is missed.
5. **Resolve with proof:** officers must attach a field photo to close an issue. Citizens can track progress and reopen a ticket within 5 days if the fix was incomplete.

---

## 🧭 App Structure & Routes

The app uses lightweight hash routing, so there is no extra router dependency.

| Route | Audience | Description |
| :--- | :--- | :--- |
| `/#/` | Public | **Landing page** with the live "issues resolved" counter, project pitch and entry points |
| `/#/app` | Citizens | Main app: **Report Issue**, **Track Ticket**, **Live Map** (`/#/app/report`, `/#/app/track`, `/#/app/map`) |
| `/#/admin` | Officers | **Officer Console** behind a login: issues board, AI verification queue, configuration |

The admin portal is deliberately **not linked anywhere in the public UI**. Officers go straight to `/#/admin`.

---

## 🔐 Authentication & Access

### Citizens: Google OAuth
Citizens can sign in with **Google OAuth** through Supabase Auth (`supabase.auth.signInWithOAuth({ provider: 'google' })`), implemented in `src/services/auth.ts`. This links profiles and ticket history to a verified identity, and includes a local demo fallback for offline testing.

### Municipal Officers: Admin Portal (hardcoded for the hackathon)

The Officer Console at `/#/admin` is protected by a login form. For the hackathon, the officer login is **hardcoded through environment variables** rather than using Google sign-in, because a single officer account runs the command room.

| Field | Demo credential | Where it is configured |
| :--- | :--- | :--- |
| **Username** | `admin` | `VITE_ADMIN_USERNAME` in `.env` |
| **Password** | `admin123` | `VITE_ADMIN_PASSWORD` in `.env` |

How it works:

- The credentials are read from `.env` by `src/config/adminAuth.ts`. There is **no fallback default**: if the variables are missing, the login page shows a warning and sign-in is disabled.
- A successful login creates an 8-hour session stored in `sessionStorage`, so it ends when the tab closes. A **Logout** button clears it.
- Restart the dev server after changing `.env`, since Vite only reads it at startup.

> ⚠️ **Security note.** `VITE_*` variables are compiled into the client bundle, so this keeps casual visitors out of the admin panel but is **not production-grade security**. It is a deliberate demo trade-off.

#### 🔄 Upgrade path: Google authorization for officers

The officer portal can move to **Google OAuth**, exactly like the citizen flow, with no change to the dashboard UI. In production:

1. Municipal staff sign in with official Google accounts (`@city.gov` or an organisational Google Workspace domain) via `supabase.auth.signInWithOAuth({ provider: 'google' })`.
2. Supabase Auth completes the OAuth handshake. Officer roles are verified with an allow-list or a `role` claim.
3. **Row Level Security (RLS)** policies on PostgreSQL restrict updates to `clusters`, `tickets` and `timeline_events` to verified officers only. This moves enforcement from the browser to the database.
4. Role-based access control limits severity overrides, verification decisions and ticket closures to authorised officers.

Only `adminLogin()` and `isAdminAuthenticated()` in `adminAuth.ts` would be replaced. The rest of the app is unaffected.

---

## 🚀 Key Features

```
  ┌────────────────────────────────────────────────────────────┐
  │                    Citizen Web Portal                      │
  │   [Report Issue]      [Live Incident Map]   [Track Ticket] │
  └─────────────────────────────┬──────────────────────────────┘
                                │ Photos + GPS
                                ▼
  ┌────────────────────────────────────────────────────────────┐
  │               Verification & Triage Engine                 │
  │  • Forensic metadata scan for AI-generator signatures      │
  │  • Gemini Vision: authenticity, category match, severity   │
  │  • Context boost: schools/hospitals nearby, rain forecast  │
  └─────────────────────────────┬──────────────────────────────┘
                                │ Verified findings
                                ▼
  ┌────────────────────────────────────────────────────────────┐
  │             Supabase + PostGIS Spatial Clustering          │
  │  • Geofenced duplicate merging (~50 m)                     │
  │  • Community flag counting per issue                       │
  └─────────────────────────────┬──────────────────────────────┘
                                │ Clusters
                                ▼
  ┌────────────────────────────────────────────────────────────┐
  │               Officer Console (/#/admin)                   │
  │  • Issues board: reassign, override severity, update       │
  │  • Verification queue for AI-flagged submissions           │
  │  • Close issues with proof-of-resolution photo             │
  └────────────────────────────────────────────────────────────┘
```

- **Landing page:** live count of resolved issues, active and critical issues, and a pothole-focused pitch.
- **AI authenticity checks:** two layers. A binary metadata scan catches known generator signatures and canvas sizes, and Gemini Vision inspects watermarks, textures and lighting. Synthetic or non-civic images are rejected.
- **Context-aware severity:** severity rises near schools and hospitals (OpenStreetMap Overpass) and for water or sewage issues when rain is forecast (Open-Meteo).
- **Spatial auto-clustering:** nearby duplicate reports merge into one ticket and increase its flag count without resetting its status.
- **SLA tiers:** deadlines scale with severity (for example Level 5 = 6 hours), with an escalation watcher and a demo time-acceleration mode.
- **Live map:** Leaflet map with severity-coloured markers sized by report count, and category filters.
- **Ticket tracking and reopen:** citizens look up a ticket with its code and the last 4 digits of their mobile number. Closed tickets can be reopened within 5 days.
- **PDF receipts:** downloadable acknowledgement for every accepted ticket.
- **Health diagnostics:** the admin config panel tests Supabase DB, the Storage bucket and the Gemini API live.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, Lucide React |
| Database & spatial | Supabase (PostgreSQL + PostGIS) |
| Storage | Supabase Storage (`reports` bucket) |
| AI vision | Google Gemini Flash (multimodal) |
| Context data | Open-Meteo (weather), OpenStreetMap Overpass (schools/hospitals) |
| Maps | Leaflet + OpenStreetMap tiles |
| PDF | jsPDF |

---

## 📦 Getting Started

### 1. Prerequisites
- Node.js 18+ and npm or pnpm
- A Supabase project with the **PostGIS** extension enabled and a public `reports` storage bucket
- A Google Gemini API key (free at [aistudio.google.com](https://aistudio.google.com))

### 2. Install
```bash
git clone https://github.com/SB-entropy25/TokenSmiths_Forge26.git
cd TokenSmiths_Forge26/civic-ui
npm install
```

### 3. Configure environment
Create a `.env` file in `civic-ui/`:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Google Gemini Vision
VITE_GEMINI_API_KEY=your-gemini-api-key

# Officer / Admin login (REQUIRED for /#/admin)
VITE_ADMIN_USERNAME=admin
VITE_ADMIN_PASSWORD=admin123

# Direct Supabase mode (no n8n required)
VITE_USE_DIRECT_MODE=true
VITE_DISABLE_EMAIL=true
```

### 4. Database policies
The app uses the Supabase anon key. For the officer actions to persist, your tables need RLS policies that allow:

- anon `insert` and `select` on `clusters`, `tickets` and `timeline_events`,
- anon `update` on `clusters` and `tickets` (used by officer actions and citizen reopen),
- anon upload and read on the `reports` storage bucket.

If officer updates seem to "not save", the browser console will show a message pointing at the missing update policy. This is the hackathon-mode setup. In production, restrict updates to authenticated officers (see the Google upgrade path above).

### 5. Run
```bash
npm run dev
```
Open the URL shown in your terminal (Vite's default is `http://localhost:5173`):

| Page | URL |
| :--- | :--- |
| Landing page | `http://localhost:5173/#/` |
| Citizen app | `http://localhost:5173/#/app` |
| Officer Console | `http://localhost:5173/#/admin` |

### 6. Production build
```bash
npm run build
```

---

## 📁 Project Structure

```
src/
├── main.tsx                 # Entry point (Leaflet CSS imported here)
├── App.tsx                  # Hash router: landing / citizen app / admin
├── index.css                # Tailwind + animations
├── types.ts
├── config/
│   ├── env.ts               # App configuration (.env + overrides)
│   └── adminAuth.ts         # Officer login (credentials from .env)
├── services/
│   ├── api.ts               # Submission, AI triage, clustering, admin actions
│   ├── auth.ts              # Citizen Google OAuth
│   ├── healthCheck.ts
│   ├── mockData.ts
│   └── supabaseClient.ts
└── components/
    ├── LandingPage.tsx
    ├── Header.tsx           # Citizen header
    ├── ReportForm.tsx
    ├── TrackTicketView.tsx
    ├── PublicMapView.tsx
    ├── TicketSuccessModal.tsx
    ├── AiDiagnosticCard.tsx
    ├── AdminLogin.tsx
    ├── AdminPanel.tsx       # Officer Console shell
    ├── AdminDashboard.tsx   # Issues board + verification queue
    └── ConfigModal.tsx
```

---

## ⚠️ Known Limitations (Hackathon Scope)

- **Client-side officer login.** Environment-based credentials are visible in the built JavaScript. Production should use Supabase Auth with Google SSO plus RLS (see above).
- **API keys in the browser.** The Gemini key is used client-side for the demo. In production it should be proxied through a server or Supabase Edge Function.
- **Heuristic fallback.** Without a Gemini key, the app falls back to a rule-based check, which is far less accurate than live vision verification.
- **Email notifications are disabled.** Updates are recorded in the ticket timeline instead.

---

## 👥 Team TokenSmiths

Built by **TokenSmiths** for **Forge '26**.
*Crafting smarter cities, one report at a time.*