# Kanban App — Foundation, Auth, Boards, Cards, Real-Time Sync & Deploy (Weeks 1-4)

Real-time collaborative Kanban board. Through Week 4 this covers: project
foundation, full JWT authentication, complete board/column/card CRUD with
drag-and-drop, live multi-user sync over Socket.io, input validation, and
deployment configs — backed by a real PostgreSQL database throughout.

**Want to deploy it?** See [`DEPLOY.md`](./DEPLOY.md) for the full Render +
Vercel walkthrough.

## What's built so far

**Week 1:**
- Express server with a clean folder structure (routes/controllers/middleware/db)
- PostgreSQL schema for users, boards, board members, columns, and cards
- JWT-based auth: signup, login, and a protected `/me` route
- Auth middleware to protect any future route
- React (Vite) frontend with a working signup/login flow, session persistence,
  and a placeholder "logged in" screen

**Week 2:**
- Board CRUD: create (auto-generates To Do / In Progress / Done columns),
  list, view, delete (owner-only)
- Collaborator invites by email, with role-based access control
  (owner vs collaborator) enforced via middleware on every board-scoped route
- Column CRUD with position-based ordering
- Card CRUD, including a `move` endpoint that handles both same-column
  reordering and cross-column moves, keeping `position` values contiguous
  via a SQL transaction
- React board view with real drag-and-drop (`@dnd-kit`), optimistic UI
  updates during drag, and a server re-sync on drop
- Fully tested against a real local Postgres instance: 22 assertions
  covering board/column/card creation, cross-column moves, same-column
  reordering, and access control (non-members blocked with 403, collaborators
  blocked from owner-only actions) — all passing

**Week 3:**
- Authenticated Socket.io connections: the same JWT used for REST calls is
  verified during the socket handshake (`socketAuth` middleware), so an
  unauthenticated client can't open a socket at all
- Per-board "rooms": clients join `board:<id>` when viewing a board, and every
  card/column mutation broadcasts to everyone else in that room
- Events: `card:created`, `card:updated`, `card:moved`, `card:deleted`,
  `column:created`, `column:updated`, `column:deleted`
- Presence: `presence:list` (who's here when you join), `presence:joined`,
  `presence:left` — powers the "N others here" indicator in the board header
- The acting client's own socket is excluded from its own broadcast (it
  already has the result from the REST response), avoiding a double-apply/flicker
- React board view merges incoming events directly into local state — no
  refetch needed, so updates from other users appear instantly
- Fully tested with real Socket.io client connections (two simulated browser
  tabs, two real users): 12 assertions covering presence accuracy, event
  broadcasting for every mutation type, and the no-echo-to-sender guarantee
  — all passing. Two real bugs were caught and fixed during this testing:
  a presence self-inclusion bug (a joining client briefly saw itself in its
  own "who else is here" list) and a type mismatch where a deleted card's ID
  was broadcast as a string instead of a number, silently breaking any
  strict-equality check on the client

**Week 4:**
- Server-side validation with length limits matching the DB schema (board
  names, column names, card titles, user names), returning clear 400 errors
  instead of letting a Postgres "value too long" error leak through
- Frontend: `maxLength` on every relevant input, disabled-while-submitting
  buttons, and inline error messages surfaced next to the form that caused
  them (not just a generic top-level banner)
- New "Add column" UI on the board view — the backend supported this since
  Week 2, but there was no way to trigger it from the frontend until now
- Loading skeletons on the board list (instead of plain "Loading..." text)
  and a proper empty state for boards with no cards yet
- Fail-fast startup checks: the server refuses to start with a clear error
  if `JWT_SECRET` or `DATABASE_URL` is missing, instead of failing confusingly
  on the first request
- A global error handler as a safety net for anything a route didn't already
  catch, so the client always gets clean JSON instead of a hung connection
- Deployment configs for Render (backend + Postgres, via `render.yaml`) and
  Vercel (frontend, via `client/vercel.json`) — see `DEPLOY.md` for the full
  walkthrough
- 12 new validation assertions (length limits, empty/whitespace rejection,
  update-path validation) — all passing, no regressions in the existing
  22 CRUD + 12 real-time assertions from Weeks 2-3

## Project structure

```
kanban-app/
  server/
    src/
      controllers/
        authController.js     # signup, login, me
        boardController.js    # board CRUD, member invites
        columnController.js   # column CRUD + reordering + broadcasts
        cardController.js     # card CRUD + move (same/cross column) + broadcasts
      middleware/
        auth.js                # JWT verification (REST requests)
        socketAuth.js           # JWT verification (Socket.io handshake)
        boardAccess.js          # membership/ownership checks, incl. by columnId/cardId
      db/schema.sql            # full DB schema
      db/migrate.js            # runs schema.sql against DATABASE_URL
      db/pool.js               # shared pg connection pool
      utils/validation.js      # shared length-limit validation helpers
      routes/
        auth.js
        boards.js               # /api/boards/*, nested columns/cards under a board
        columns.js               # /api/columns/:id (update/delete by id)
        cards.js                 # /api/cards/:id (update/move/delete by id)
      realtime.js               # owns the io instance, presence tracking, emitToBoard()
      index.js                 # server entry point, wires up Express + realtime
  client/
    src/
      api/client.js             # fetch wrapper, all API methods (pass socketId to avoid echo)
      context/AuthContext.jsx   # global auth state, session persistence
      hooks/useSocket.js         # manages the authenticated socket connection lifecycle
      components/
        Card.jsx                 # draggable card
        Column.jsx                # droppable column with sortable card list
      pages/
        Login.jsx
        Signup.jsx
        BoardList.jsx            # list + create boards
        Board.jsx                # DnD board view, socket listeners, presence UI
      App.jsx                   # view routing: auth -> board list -> board; owns the socket
```

## Setup

### 1. Database

You need a PostgreSQL instance. Options:
- Local: `brew install postgresql` (Mac) or use Docker: `docker run --name kanban-db -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres`
- Hosted (recommended for deploying later): a free Postgres instance on
  [Render](https://render.com) or [Railway](https://railway.app)

Create a database called `kanban`, then run the migration:

```bash
cd server
cp .env.example .env
# edit .env: set DATABASE_URL to your actual connection string,
# and JWT_SECRET to a long random string
npm install
npm run migrate
```

### 2. Server

```bash
cd server
npm run dev
# server runs on http://localhost:4000
```

Verify it's up: `curl http://localhost:4000/api/health`

### 3. Client

```bash
cd client
cp .env.example .env
npm install
npm run dev
# opens on http://localhost:5173
```

## Try it

### Auth (Week 1)
1. Open the client, sign up with a name/email/password (8+ chars)
2. You land on the board list — confirms your JWT was issued and validated
3. Refresh the page — you stay logged in (session persists until the tab closes)

### Boards & cards (Week 2)
1. Create a board — three default columns appear immediately
2. Add a few cards to "To Do"
3. Drag a card between columns, or reorder within a column — the move
   persists to the database and survives a page refresh

### Real-time sync (Week 3 — open two browser windows to see it live)
1. Log in as two different users who are both members of a board (invite the
   second user by email from the board owner's account first)
2. Open the same board in both windows — each header shows "N others here"
3. In window A, add/move/delete a card — it updates in window B instantly,
   no refresh needed
4. Close window B — window A's presence indicator updates to reflect they left

## Design decisions worth knowing for interviews

**Auth & data model**
- **Password hashing**: bcrypt with 10 salt rounds — standard, safe default
- **JWT over sessions**: no server-side session store, keeps the backend
  stateless and easier to scale horizontally
- **Vague login errors**: "Invalid email or password" (not "user not found")
  to avoid leaking which emails are registered
- **sessionStorage over localStorage**: simpler starting point; token clears
  when the tab closes. Documented tradeoff: no "remember me" persistence
  across browser restarts

**Boards, columns, cards**
- **Position management via transactions**: moving a card shifts the
  `position` values of every other affected card so there are never gaps or
  duplicates, wrapped in `BEGIN`/`COMMIT`/`ROLLBACK` so a failure partway
  through can't leave positions corrupted
- **Optimistic UI + server reconciliation**: the board updates instantly as
  you drag, then calls the server on drop and re-fetches authoritative state,
  reverting on failure rather than trusting local state
- **Access control as middleware**: `boardAccess.js` resolves the owning
  board whether the URL has a `boardId`, `columnId`, or `cardId`, and checks
  membership once, before the handler runs

**Real-time sync**
- **JWT reused for sockets, not sessions**: the same login token authenticates
  the Socket.io handshake — no separate socket-auth system to maintain
- **Exclude-sender broadcasting**: the acting client is excluded from its own
  broadcast (`socket.except()`) since it already has the result from its REST
  response — avoids double-applying the same change
- **Presence stored in memory (a Map), not the database**: who's viewing a
  board is ephemeral state that doesn't need durability. Documented tradeoff:
  resets on server restart, and won't scale past one server instance without
  a shared store like Redis — worth naming if asked "how would this scale?"
- **REST is still the source of truth; sockets only broadcast**: every
  mutation goes through the same validated, transaction-safe REST endpoint.
  Socket.io never writes to the database — it only notifies other clients
  that a write already happened, so the real-time layer could be removed or
  replaced without touching the data layer
- **Testing caught real integration bugs**: a presence self-inclusion bug and
  a string/number ID mismatch on `card:deleted` were both the kind a manual
  click-through easily misses, but an automated test with two real connected
  clients caught immediately. Good example of why integration tests matter,
  not just unit tests

## What's left (nice-to-haves, not required for a strong portfolio piece)

- Full test suite runner (currently: throwaway Node scripts run manually
  against a live server — real, but not wired into `npm test` or CI)
- Conflict resolution beyond last-write-wins (CRDTs or operational
  transforms) — worth naming as a known limitation if asked, not worth
  building for a project like this
- Column drag-and-drop reordering in the UI (the backend endpoint already
  supports it via `updateColumn`'s `position` field; only card drag-and-drop
  is wired up in the frontend)
- Card detail view (currently cards only show title; description exists in
  the schema and API but has no UI)
