import { useState, useEffect, useCallback, useRef } from 'react';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import Column from '../components/Column';
import AddColumn from '../components/AddColumn';
import CardPreview from '../components/Card';

export default function Board({ boardId, onBack, socket, socketConnected }) {
  const { token } = useAuth();
  const [board, setBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [members, setMembers] = useState([]);
  const [viewers, setViewers] = useState([]);
  const [error, setError] = useState('');
  const [activeCard, setActiveCard] = useState(null);

  // Columns/cards change frequently during drag; socket event handlers are
  // registered once and need the latest state without re-subscribing on
  // every change, so we keep a ref in sync for them to read from.
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // avoids accidental drags on simple clicks
    })
  );

  const loadBoard = useCallback(async () => {
    try {
      const data = await api.getBoard(token, boardId);
      setBoard(data.board);
      setColumns(data.columns);
      setMembers(data.members);
    } catch (err) {
      setError(err.message);
    }
  }, [token, boardId]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  // Join the board's real-time room on mount, leave on unmount/board switch.
  useEffect(() => {
    if (!socket || !socketConnected) return;

    socket.emit('join-board', boardId);

    function handlePresenceList(list) {
      setViewers(list);
    }
    function handlePresenceJoined(user) {
      setViewers((prev) => (prev.some((v) => v.id === user.id) ? prev : [...prev, user]));
    }
    function handlePresenceLeft(user) {
      setViewers((prev) => prev.filter((v) => v.id !== user.id));
    }

    function handleCardCreated({ card }) {
      setColumns((prev) =>
        prev.map((col) => (col.id === card.column_id ? { ...col, cards: [...col.cards, card] } : col))
      );
    }

    function handleCardUpdated({ card }) {
      setColumns((prev) =>
        prev.map((col) =>
          col.id === card.column_id
            ? { ...col, cards: col.cards.map((c) => (c.id === card.id ? card : c)) }
            : col
        )
      );
    }

    function handleCardMoved({ card, fromColumnId }) {
      setColumns((prev) =>
        prev.map((col) => {
          if (col.id === fromColumnId && col.id !== card.column_id) {
            return { ...col, cards: col.cards.filter((c) => c.id !== card.id) };
          }
          if (col.id === card.column_id) {
            const withoutCard = col.cards.filter((c) => c.id !== card.id);
            const newCards = [...withoutCard];
            newCards.splice(card.position, 0, card);
            return { ...col, cards: newCards };
          }
          return col;
        })
      );
    }

    function handleCardDeleted({ cardId, columnId }) {
      setColumns((prev) =>
        prev.map((col) =>
          col.id === columnId ? { ...col, cards: col.cards.filter((c) => c.id !== cardId) } : col
        )
      );
    }

    function handleColumnCreated({ column }) {
      setColumns((prev) => [...prev, column]);
    }

    function handleColumnUpdated({ column }) {
      setColumns((prev) =>
        prev.map((col) => (col.id === column.id ? { ...col, ...column } : col))
      );
    }

    function handleColumnDeleted({ columnId }) {
      setColumns((prev) => prev.filter((col) => col.id !== columnId));
    }

    socket.on('presence:list', handlePresenceList);
    socket.on('presence:joined', handlePresenceJoined);
    socket.on('presence:left', handlePresenceLeft);
    socket.on('card:created', handleCardCreated);
    socket.on('card:updated', handleCardUpdated);
    socket.on('card:moved', handleCardMoved);
    socket.on('card:deleted', handleCardDeleted);
    socket.on('column:created', handleColumnCreated);
    socket.on('column:updated', handleColumnUpdated);
    socket.on('column:deleted', handleColumnDeleted);

    return () => {
      socket.emit('leave-board', boardId);
      socket.off('presence:list', handlePresenceList);
      socket.off('presence:joined', handlePresenceJoined);
      socket.off('presence:left', handlePresenceLeft);
      socket.off('card:created', handleCardCreated);
      socket.off('card:updated', handleCardUpdated);
      socket.off('card:moved', handleCardMoved);
      socket.off('card:deleted', handleCardDeleted);
      socket.off('column:created', handleColumnCreated);
      socket.off('column:updated', handleColumnUpdated);
      socket.off('column:deleted', handleColumnDeleted);
      setViewers([]);
    };
  }, [socket, socketConnected, boardId]);

  function findColumnByCardId(cardId) {
    return columns.find((col) => col.cards.some((c) => c.id === cardId));
  }

  function handleDragStart(event) {
    const cardId = event.active.id;
    const col = findColumnByCardId(cardId);
    const card = col?.cards.find((c) => c.id === cardId);
    setActiveCard(card || null);
  }

  // Optimistically reorder locally as the drag moves over columns/cards,
  // so the UI feels instant. The authoritative move call fires on drop.
  function handleDragOver(event) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const activeColumn = findColumnByCardId(activeId);
    const overColumn = columns.find((col) => col.id === overId) || findColumnByCardId(overId);

    if (!activeColumn || !overColumn || activeColumn.id === overColumn.id) return;

    setColumns((prev) => {
      const activeCol = prev.find((c) => c.id === activeColumn.id);
      const overCol = prev.find((c) => c.id === overColumn.id);
      const movingCard = activeCol.cards.find((c) => c.id === activeId);
      if (!movingCard) return prev;

      return prev.map((col) => {
        if (col.id === activeCol.id) {
          return { ...col, cards: col.cards.filter((c) => c.id !== activeId) };
        }
        if (col.id === overCol.id) {
          const overIndex = col.cards.findIndex((c) => c.id === overId);
          const insertAt = overIndex >= 0 ? overIndex : col.cards.length;
          const newCards = [...col.cards];
          newCards.splice(insertAt, 0, movingCard);
          return { ...col, cards: newCards };
        }
        return col;
      });
    });
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;

    const cardId = active.id;
    const finalColumn = findColumnByCardId(cardId) || columns.find((c) => c.id === over.id);
    if (!finalColumn) return;

    const finalPosition = finalColumn.cards.findIndex((c) => c.id === cardId);

    try {
      await api.moveCard(token, cardId, finalColumn.id, Math.max(finalPosition, 0), socket?.id);
      // Re-sync with server truth in case of any drift
      loadBoard();
    } catch (err) {
      setError(err.message);
      loadBoard(); // revert to server state on failure
    }
  }

  async function handleAddCard(columnId, title) {
    try {
      await api.createCard(token, boardId, columnId, title, socket?.id);
      loadBoard();
    } catch (err) {
      setError(err.message);
      throw err; // let Column show the inline error too
    }
  }

  async function handleAddColumn(name) {
    try {
      await api.createColumn(token, boardId, name, socket?.id);
      loadBoard();
    } catch (err) {
      setError(err.message);
      throw err; // let AddColumn show the inline error too
    }
  }

  async function handleDeleteCard(cardId) {
    try {
      await api.deleteCard(token, cardId, socket?.id);
      loadBoard();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!board) {
    return (
      <div className="board-page">
        <button type="button" onClick={onBack}>← Back</button>
        {error ? <p className="error-text">{error}</p> : <p>Loading board...</p>}
      </div>
    );
  }

  return (
    <div className="board-page">
      <header className="board-header">
        <button type="button" onClick={onBack}>← Back</button>
        <h1>{board.name}</h1>
        <div className="presence-row">
          {socketConnected ? (
            viewers.length > 0 && (
              <span className="presence-viewers">
                {viewers.map((v) => (
                  <span key={v.id} className="presence-dot" title={v.name}>
                    {v.name.charAt(0).toUpperCase()}
                  </span>
                ))}
                <span className="presence-label">
                  {viewers.length === 1 ? `${viewers[0].name} is also here` : `${viewers.length} others here`}
                </span>
              </span>
            )
          ) : (
            <span className="presence-offline">Connecting...</span>
          )}
        </div>
      </header>

      {error && <p className="error-text">{error}</p>}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-board">
          {columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              onAddCard={handleAddCard}
              onDeleteCard={handleDeleteCard}
            />
          ))}
          <AddColumn onAdd={handleAddColumn} />
        </div>

        <DragOverlay>
          {activeCard ? <CardPreview card={activeCard} onDelete={() => {}} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
