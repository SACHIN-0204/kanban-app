import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Manages a single authenticated socket connection for the lifetime of the
// token. Returns the socket instance in state (not a ref) so consumers
// re-render once the connection is actually established.
export function useSocket(token) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      setConnected(false);
      return;
    }

    const newSocket = io(SOCKET_URL, { auth: { token } });

    newSocket.on('connect', () => setConnected(true));
    newSocket.on('disconnect', () => setConnected(false));

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [token]);

  return { socket, connected };
}
