import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function Card({ card, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', columnId: card.column_id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="kanban-card">
      <div className="kanban-card-title">{card.title}</div>
      {card.description && <div className="kanban-card-desc">{card.description}</div>}
      <button
        type="button"
        className="card-delete-btn"
        // Prevent the drag listener from hijacking this click
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onDelete(card.id)}
        aria-label="Delete card"
      >
        ×
      </button>
    </div>
  );
}
