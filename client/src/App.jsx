import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useSocket } from './hooks/useSocket';
import Login from './pages/Login';
import Signup from './pages/Signup';
import BoardList from './pages/BoardList';
import Board from './pages/Board';
import './App.css';

function AppContent() {
  const { user, loading, token } = useAuth();
  const { socket, connected } = useSocket(token);
  const [authView, setAuthView] = useState('login'); // 'login' | 'signup'
  const [openBoardId, setOpenBoardId] = useState(null);

  if (loading) {
    return <div className="center-screen">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="center-screen">
        {authView === 'login' ? (
          <Login onSwitchToSignup={() => setAuthView('signup')} />
        ) : (
          <Signup onSwitchToLogin={() => setAuthView('login')} />
        )}
      </div>
    );
  }

  if (openBoardId) {
    return (
      <Board
        boardId={openBoardId}
        onBack={() => setOpenBoardId(null)}
        socket={socket}
        socketConnected={connected}
      />
    );
  }

  return <BoardList onOpenBoard={setOpenBoardId} />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
