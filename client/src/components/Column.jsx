import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import Card from './Card';

const CARD_TITLE_MAX = 255;

export default function Column({ column, onAddCard, onDeleteCard }) {
  const [newCardTitle, setNewCardTitle] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column' },
  });

  async function handleAddCard(e) {
    e.preventDefault();
    const trimmed = newCardTitle.trim();
    if (!trimmed) return;

    setError('');
    setAdding(true);
    try {
      await onAddCard(column.id, trimmed);
      setNewCardTitle('');
      setShowAddForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="kanban-column">
      <div className="kanban-column-header">
        <span>{column.name}</span>
        <span className="kanban-column-count">{column.cards.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={`kanban-column-body ${isOver ? 'column-drag-over' : ''}`}
      >
        <SortableContext
          items={column.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.length === 0 && !isOver && (
            <p className="column-empty-hint">Drop cards here or add one below</p>
          )}
          {column.cards.map((card) => (
            <Card key={card.id} card={card} onDelete={onDeleteCard} />
          ))}
        </SortableContext>
      </div>

      {error && <p className="error-text column-error">{error}</p>}

      {showAddForm ? (
        <form onSubmit={handleAddCard} className="add-card-form">
          <input
            type="text"
            autoFocus
            placeholder="Card title..."
            value={newCardTitle}
            onChange={(e) => setNewCardTitle(e.target.value)}
            maxLength={CARD_TITLE_MAX}
            disabled={adding}
            onBlur={() => !newCardTitle && setShowAddForm(false)}
          />
          <button type="submit" disabled={adding || !newCardTitle.trim()}>
            {adding ? '...' : 'Add'}
          </button>
        </form>
      ) : (
        <button type="button" className="add-card-btn" onClick={() => setShowAddForm(true)}>
          + Add a card
        </button>
      )}
    </div>
  );
}
