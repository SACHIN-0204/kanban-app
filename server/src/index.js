require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');

const { initRealtime } = require('./realtime');

const authRoutes = require('./routes/auth');
const boardRoutes = require('./routes/boards');
const columnRoutes = require('./routes/columns');
const cardRoutes = require('./routes/cards');

// Fail fast with a clear message rather than a confusing runtime error deep
// in a request handler if a required secret wasn't set (e.g. forgot to add
// it in the hosting provider's env var dashboard).
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Check your .env file (local) or environment variables (hosted).');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is not set. Check your .env file (local) or environment variables (hosted).');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

initRealtime(server, process.env.CLIENT_URL);

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// Health check - useful once deployed, to confirm the server is alive
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/columns', columnRoutes);
app.use('/api/cards', cardRoutes);

// Catch-all 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Last-resort error handler: catches anything a route handler didn't
// already catch (e.g. a thrown error outside a try/catch), so the client
// always gets a clean JSON error instead of the connection just hanging
// or an HTML stack trace leaking implementation details.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
