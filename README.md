# Kanban App

A real-time, multi-user Kanban board — React frontend, Node/Express backend, PostgreSQL for storage, and Socket.io for live collaboration. Multiple people can work on the same board at once and see each other's changes (and each other's presence) instantly.

## Features

- **Real-time collaboration** — card creates, edits, moves, and deletes broadcast instantly to everyone viewing the same board over Socket.io, with sender-exclusion so the client that made the change doesn't get a redundant echo of its own update
- **Live presence** — see who else is currently viewing the board, with join/leave events
- **Drag-and-drop** cards between columns (`@dnd-kit`), backed by a **position-based ordering scheme** in Postgres — moving a card shifts the positions of everything between its old and new slot in a single transaction, so the visual order always matches the database
- **Concurrency-safe reordering** — every move runs inside a Postgres transaction (`BEGIN` / `COMMIT` / `ROLLBACK`) so a card move either fully succeeds or leaves positions untouched; nothing is left half-shifted if a query fails mid-move
- **JWT authentication** with bcrypt password hashing
- **Role-based access control** — every board, column, and card route checks board membership (`owner` vs `collaborator`) before allowing reads/writes; destructive actions (deleting a board) are further restricted to owners only
- **Socket auth** — the WebSocket connection itself is authenticated (not just the REST API), so real-time events can't be spoofed by an unauthenticated client

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, `@dnd-kit` (drag-and-drop), Socket.io client |
| Backend | Node.js, Express, Socket.io |
| Database | PostgreSQL (`pg`), raw SQL with transactions |
| Auth | JWT, bcrypt |
| Deployment | Backend on Render (see `render.yaml`), frontend on Vercel |

## Architecture

```
├── server/
│   └── src/
│       ├── controllers/     # boardController, columnController, cardController, authController
│       ├── routes/          # Express route definitions
│       ├── middleware/
│       │   ├── auth.js            # JWT verification for REST routes
│       │   ├── boardAccess.js     # Board membership + owner-only checks
│       │   └── socketAuth.js      # Authenticates the Socket.io handshake
│       ├── db/
│       │   ├── schema.sql         # Table definitions (users, boards, board_members, columns, cards)
│       │   ├── migrate.js         # Runs schema.sql against DATABASE_URL
│       │   └── pool.js            # pg connection pool
│       └── realtime.js       # Owns the Socket.io server: rooms, presence tracking, broadcast helper
└── client/
    └── src/
        ├── pages/            # Board views
        ├── components/       # Card, column, board UI
        ├── hooks/            # Custom hooks
        └── api/               # REST client
```

### How card moves stay consistent

Each card has an integer `position` within its column. On drag-and-drop, `moveCard` opens a database transaction, shifts the `position` of every card between the source and destination slot (up or down depending on direction, and differently depending on whether the move is within one column or across columns), writes the moved card's new `column_id`/`position`, then commits — or rolls back entirely if any step fails. This keeps ordering consistent even if two people move cards on the same board at close to the same time.

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL (local install, or a hosted instance — e.g. the free tier on Render)

### Backend setup

```bash
cd server
npm install
```

Create a `.env` file in `server/`:

```
DATABASE_URL=postgres://<user>:<password>@localhost:5432/kanban
JWT_SECRET=<any-random-string>
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
PORT=4000
```

Run the schema migration, then start the server:

```bash
npm run migrate    # creates users, boards, board_members, columns, cards tables
npm run dev          # starts with nodemon on localhost:4000
```

### Frontend setup

```bash
cd client
npm install
npm run dev           # starts Vite dev server on localhost:5173
```

## Deployment

The included `render.yaml` is a Render Blueprint that provisions the backend web service and a managed Postgres database together — point Render at this repo (New → Blueprint) and both resources are created automatically. After the first deploy, run `npm run migrate` once from the Render Shell tab. The frontend is set up to deploy separately on Vercel (`client/vercel.json`); update the backend's `CLIENT_URL` env var to match the deployed frontend URL so CORS allows requests from it.

## License

This project was built for educational purposes as part of personal portfolio work.
