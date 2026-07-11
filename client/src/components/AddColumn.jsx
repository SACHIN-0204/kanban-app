import { useState } from 'react';

const COLUMN_NAME_MAX = 100;

export default function AddColumn({ onAdd }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setError('');
    setAdding(true);
    try {
      await onAdd(trimmed);
      setName('');
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  if (!showForm) {
    return (
      <button type="button" className="add-column-btn" onClick={() => setShowForm(true)}>
        + Add column
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="add-column-form">
      <input
        type="text"
        autoFocus
        placeholder="Column name..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={COLUMN_NAME_MAX}
        disabled={adding}
        onBlur={() => !name && setShowForm(false)}
      />
      <button type="submit" disabled={adding || !name.trim()}>
        {adding ? '...' : 'Add'}
      </button>
      {error && <p className="error-text">{error}</p>}
    </form>
  );
}
