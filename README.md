# Balance

A personal productivity app for time and energy management across study,
business, socialization, and relaxation. You define long-term goals; the app
breaks them into steps and schedules them into a built-in calendar, adjusting
the load automatically based on how you've actually been keeping up — not on
a mood check-in.

## How it works

- **Goals & steps** — create a goal in a domain (study/business/social/relax),
  get a rule-based suggested breakdown into steps, or add your own. Steps can
  be one-off or recurring (daily/weekly/monthly).
- **Built-in scheduler** — no external calendar sync. Recurring steps expand
  into dated task instances and get packed into daily per-domain capacity.
  When a day is full, the overflow slides to the next day with room.
- **Energy-adaptive capacity** — nothing is self-reported. A day's capacity is
  scaled by an inferred energy score derived from your recent completion
  history (7/14-day completion rate, missed/completed streaks, overdue load).
  A rough patch lightens the next few days automatically; a strong streak
  opens up more room.
- **Study module** — give it topics/material, a difficulty per topic, and an
  exam date; it builds a day-by-day study plan (harder topics first, a review
  pass just before the exam) and schedules it through the *same* engine as
  everything else — it isn't a separate calendar.
- **Priority/balance view** — a rolling window shows scheduled vs. completed
  minutes per domain and flags domains that are being neglected.

Explicitly out of scope (per the spec this was built against): Google
Calendar sync, audio/podcast summaries, custom soundscapes, manual mood
check-ins.

## Architecture

```
packages/core     Framework-free domain logic shared by every app:
                     domain/       types (Goal, Step, TaskInstance, EnergyState, ...)
                     energy/       EnergyInferenceEngine — swappable, see below
                     scheduler/    recurrence expansion + capacity-aware placement
                     study/        material -> day-by-day plan
                     priority/     cross-domain balance report
                     suggestions/  rule-based goal -> step breakdown

apps/server       Fastify + Prisma (SQLite) REST API. Thin: it maps HTTP <-> DB
                  <-> the pure functions in packages/core. JWT auth.

apps/web          Vite + React + Tailwind. Full UI: auth, dashboard, goals,
                  calendar, study plan builder.

apps/mobile       Expo React Native app hitting the same API. Auth, dashboard,
                  goals, calendar, study — a lighter-weight but functional
                  parallel to the web UI, sharing packages/core's types.
```

Everything routes through `packages/core`, so the scheduling/energy/study
logic is identical no matter which client calls it.

### Multi-tenancy

Every domain table (`Goal`, `Step`, `TaskInstance`) is scoped by
`workspaceId`, not `userId`. A `Workspace` is the tenant boundary, and `User`
joins to it through a `Membership` row. Today every signup gets exactly one
workspace with one `OWNER` membership, but a workspace gaining more members
later (a team/SaaS plan) needs zero migration of the domain tables — they
already only know about `workspaceId`.

### The energy engine is swappable by design

`packages/core/src/energy/engine.ts` exports an `EnergyInferenceEngine`
interface and one implementation, `HeuristicEnergyEngine`. Every caller
(the scheduler, the API routes) only ever touches the interface and the
`EnergyState` it returns. The current heuristic (weighted completion rate +
streak detection) is a first pass and will need iteration — swap in a new
implementation there without touching the scheduler, the API, or either
frontend.

One known limitation worth noting: the "today" reading can look worse than
it should mid-day, because a task scheduled for today that isn't completed
*yet* currently reads the same as a task that was missed. It self-corrects
once the day rolls over into history. A cleaner fix (excluding the
in-progress day from the streak calculation, or weighting it separately) is
a natural next iteration.

## Running it

Requires Node 20+ and pnpm (`corepack enable` if you don't have it).

```bash
pnpm install

# 1. Core engine tests
pnpm --filter @productivityapp/core test

# 2. API server (SQLite, zero external setup)
cd apps/server
cp .env.example .env
pnpm exec prisma db push      # creates dev.db from the schema
pnpm dev                      # http://localhost:4000

# 3. Web app (in another terminal)
cd apps/web
pnpm dev                      # http://localhost:5173, proxies /api -> :4000

# 4. Mobile app (in another terminal, requires Expo Go or a simulator)
cd apps/mobile
pnpm start
```

The mobile app reads its API base URL from `app.json`'s `expo.extra.apiUrl`
(defaults to `http://localhost:4000` — point it at your machine's LAN IP if
testing on a physical device via Expo Go, since `localhost` on the phone
means the phone itself).

### Tests

`packages/core` has the real test suite (26 tests) covering the energy
engine, recurrence expansion, the scheduler's capacity/overflow behavior,
the study planner, and the priority tracker — the parts of the system worth
unit testing in isolation. The server and web app were verified by running
them end-to-end in a headless browser (registration → goal → AI-style
suggestions → accept step → generate schedule → mark complete, and the
study-plan flow).

The mobile app was verified the same way via Expo's web target
(`pnpm --filter mobile exec expo start --web`), since no iOS/Android
simulator is available in every environment this was built in. That
confirmed auth, the dashboard (real energy/balance data), and goal
creation/listing all work end-to-end against the live API. One thing it
could **not** confirm: `@react-navigation/native-stack` (used for the
goal-detail screen) doesn't run under react-native-web — it depends on
native screen primitives — so pushing into goal detail crashes in the web
preview specifically. That's a known limitation of that library on web, not
a bug in this app's code, and native-stack is the right choice to keep for
real iOS/Android use (better performance/feel than the JS-based
alternative). **Recommendation:** do a pass with Expo Go or a simulator on
your machine before shipping, especially for in-app navigation.

## Notable API endpoints

All routes below live under an `/api` prefix (e.g. `POST /api/auth/login`).

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | Auth, returns a JWT |
| GET/POST | `/goals` | List/create goals |
| GET | `/goals/:id/suggest-steps` | Rule-based breakdown suggestions |
| GET/POST | `/steps` | List/create steps |
| GET | `/calendar?start&end` | List scheduled task instances |
| POST | `/calendar/generate` | Run the scheduler for a date range |
| PATCH | `/calendar/instances/:id` | Mark a task completed/missed/skipped |
| GET | `/energy?date=` | Inferred energy state for a date |
| GET | `/priority?windowDays=` | Cross-domain balance report |
| POST | `/study/plans` | Build + schedule a study plan from materials + exam date |

## Deploying as a single process

`apps/server` can also serve the built web app directly: everything under
`/api/*` is the REST API, and every other path falls back to `apps/web`'s
built `index.html` (a standard SPA fallback), so React Router handles
client-side routes like `/goals` or `/calendar`. This is meant for hosting
setups that proxy an entire domain to one Node process rather than splitting
static files and an API across separate config.

```bash
pnpm --filter @productivityapp/core build
pnpm --filter web build             # produces apps/web/dist
cd apps/server
cp .env.example .env                # set JWT_SECRET, CORS_ORIGIN, PORT for real
pnpm exec prisma generate
pnpm exec prisma db push            # must happen before the build below —
                                     # tsc needs Prisma's generated client types
cd ..
pnpm --filter server build
cd apps/server
node dist/index.js                  # or run under pm2/systemd
```

By default it looks for the web build at the sibling `apps/web/dist`; set
`WEB_DIST_PATH` in `.env` to point elsewhere if you publish the built site
separately.
