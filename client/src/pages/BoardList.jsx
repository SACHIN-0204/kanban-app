import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const BOARD_NAME_MAX = 200;

export default function BoardList({ onOpenBoard }) {
  const { token, user, logout } = useAuth();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newBoardName, setNewBoardName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadBoards();
  }, []);

  async function loadBoards() {
    try {
      const { boards } = await api.listBoards(token);
      setBoards(boards);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    const trimmed = newBoardName.trim();
    if (!trimmed) return;

    setError('');
    setCreating(true);
    try {
      await api.createBoard(token, trimmed);
      setNewBoardName('');
      await loadBoards();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="board-list-page">
      <header className="board-list-header">
        <h1>Your Boards</h1>
        <div className="header-right">
          <span>{user?.name}</span>
          <button type="button" onClick={logout}>Log out</button>
        </div>
      </header>

      <form onSubmit={handleCreate} className="new-board-form">
        <input
          type="text"
          placeholder="New board name..."
          value={newBoardName}
          onChange={(e) => setNewBoardName(e.target.value)}
          maxLength={BOARD_NAME_MAX}
          disabled={creating}
        />
        <button type="submit" disabled={creating || !newBoardName.trim()}>
          {creating ? 'Creating...' : 'Create board'}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <div className="board-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="board-tile board-tile-skeleton" aria-hidden="true" />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p className="empty-state-title">No boards yet</p>
          <p className="hint">Create your first board above to get started.</p>
        </div>
      ) : (
        <div className="board-grid">
          {boards.map((board) => (
            <button
              key={board.id}
              type="button"
              className="board-tile"
              onClick={() => onOpenBoard(board.id)}
            >
              <span className="board-tile-name">{board.name}</span>
              <span className="board-tile-role">{board.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
