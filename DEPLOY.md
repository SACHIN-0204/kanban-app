# Deploying the Kanban App

Two pieces to deploy: the Express + Socket.io backend (with Postgres) on
Render, and the React frontend on Vercel. Both have generous free tiers.

## 1. Backend + Database on Render

1. Push this repo to GitHub if you haven't already.
2. Go to [render.com](https://render.com) and sign in with GitHub.
3. Click **New > Blueprint**, and select this repo. Render will read
   `render.yaml` at the repo root and provision two things automatically:
   - A **web service** (`kanban-server`) running the Express app
   - A **free Postgres database** (`kanban-db`)
4. Render auto-generates `JWT_SECRET` and wires `DATABASE_URL` from the
   database to the web service — you don't need to set those by hand.
5. **Before the first deploy finishes being useful**, edit the `CLIENT_URL`
   env var on the web service to match your real Vercel URL (see step 2
   below — you'll come back and update this once you have that URL).
6. Once deployed, open the **Shell** tab on the web service in the Render
   dashboard and run:
   ```bash
   npm run migrate
   ```
   This creates all the tables. You only need to do this once.
7. Confirm it's live: `curl https://your-service.onrender.com/api/health`

**Note on the free tier:** Render's free web services spin down after 15
minutes of inactivity and take ~30-60 seconds to wake back up on the next
request. Fine for a portfolio project; mention this if a demo feels slow to
first load.

## 2. Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New > Project**, select this repo.
3. Set the **Root Directory** to `client` (important — this is a monorepo
   with `client/` and `server/` as siblings).
4. Vercel should auto-detect Vite from `client/vercel.json`. If it asks,
   confirm: Build Command `npm run build`, Output Directory `dist`.
5. Add an environment variable:
   - `VITE_API_URL` = your Render backend URL (e.g. `https://your-service.onrender.com`)
6. Deploy. Vercel gives you a URL like `https://your-app.vercel.app`.
7. **Go back to Render** and update the `CLIENT_URL` env var on the backend
   to this exact Vercel URL, then let it redeploy. This is required — CORS
   will silently reject every request from the frontend until the backend
   knows to trust that origin.

## 3. Verify end to end

1. Open your Vercel URL
2. Sign up for an account
3. Create a board, add a card
4. Open the same URL in a second browser (or incognito window), sign up as
   a second user, and have the first user invite the second by email
5. Open the same board in both — confirm real-time sync and the presence
   indicator both work across two genuinely separate deployed clients

## Troubleshooting

- **CORS errors in the browser console**: `CLIENT_URL` on the backend
  doesn't exactly match the frontend's URL (check for trailing slashes,
  http vs https, www vs no-www).
- **"Failed to fetch" from the frontend**: `VITE_API_URL` is wrong, or the
  Render service is asleep (free tier) — wait ~30s and retry.
- **Signup/login 500s**: migration wasn't run, or `DATABASE_URL` isn't wired
  correctly — check the Render service logs.
- **Sockets connect but no real-time events arrive**: double check both the
  REST calls and the socket connection are hitting the same backend URL —
  a mismatched `VITE_API_URL` can cause the socket to silently connect to
  the wrong (or a cached) backend.
