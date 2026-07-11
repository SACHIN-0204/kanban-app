// Owns the Socket.io server instance and all real-time broadcasting logic.
// Controllers call emitToBoard(...) after a successful DB write; they don't
// need to know anything about sockets, rooms, or connected clients.

const { Server } = require('socket.io');
const { socketAuth } = require('./middleware/socketAuth');

let io = null;

// boardId -> Map<socketId, { id, name, email }>
// Used to answer "who's currently viewing this board" for presence.
const boardPresence = new Map();

function initRealtime(httpServer, clientUrl) {
  io = new Server(httpServer, {
    cors: {
      origin: clientUrl || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  io.use(socketAuth);

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (user ${socket.user.name})`);

    socket.on('join-board', (boardId) => {
      const room = `board:${boardId}`;

      if (!boardPresence.has(boardId)) boardPresence.set(boardId, new Map());

      // Snapshot existing viewers BEFORE adding this socket, so the joiner
      // doesn't see themselves in their own "who else is here" list.
      const existingViewers = Array.from(boardPresence.get(boardId).values());

      socket.join(room);
      socket.currentBoardId = boardId;
      boardPresence.get(boardId).set(socket.id, socket.user);

      socket.emit('presence:list', existingViewers);

      // Tell everyone else a new viewer joined
      socket.to(room).emit('presence:joined', socket.user);
    });

    socket.on('leave-board', (boardId) => {
      leaveBoard(socket, boardId);
    });

    socket.on('disconnect', () => {
      if (socket.currentBoardId) {
        leaveBoard(socket, socket.currentBoardId);
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

function leaveBoard(socket, boardId) {
  const room = `board:${boardId}`;
  socket.leave(room);

  const presenceMap = boardPresence.get(boardId);
  if (presenceMap) {
    presenceMap.delete(socket.id);
    if (presenceMap.size === 0) {
      boardPresence.delete(boardId);
    }
  }

  socket.to(room).emit('presence:left', socket.user);
}

// Called by controllers after a successful write. Broadcasts to everyone in
// the board's room EXCEPT the socket that triggered it (that client already
// has the result from its own REST response, no need to send it twice).
// excludeSocketId is optional - pass req.body._socketId if the client sent one.
function emitToBoard(boardId, event, payload, excludeSocketId) {
  if (!io) return;
  const room = `board:${boardId}`;
  if (excludeSocketId) {
    io.to(room).except(excludeSocketId).emit(event, payload);
  } else {
    io.to(room).emit(event, payload);
  }
}

module.exports = { initRealtime, emitToBoard };
