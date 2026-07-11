const jwt = require('jsonwebtoken');

// Socket.io middleware: verifies the JWT sent during connection handshake.
// Client connects with: io(URL, { auth: { token } })
function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = { id: decoded.id, name: decoded.name, email: decoded.email };
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
}

module.exports = { socketAuth };
