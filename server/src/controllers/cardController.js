const pool = require('../db/pool');
const { emitToBoard } = require('../realtime');
const { LIMITS, validateRequiredText } = require('../utils/validation');

// POST /api/columns/:columnId/cards - add a card at the end of a column
async function createCard(req, res) {
  try {
    const { columnId } = req.params;
    const { title, description, socketId } = req.body;

    const validationError = validateRequiredText(title, 'Card title', LIMITS.CARD_TITLE);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const posResult = await pool.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM cards WHERE column_id = $1',
      [columnId]
    );
    const position = posResult.rows[0].next_position;

    const result = await pool.query(
      `INSERT INTO cards (column_id, title, description, position)
       VALUES ($1, $2, $3, $4)
       RETURNING id, column_id, title, description, position, updated_at`,
      [columnId, title.trim(), description || null, position]
    );
    const card = result.rows[0];

    const boardId = req.params.boardId || (await getBoardIdForColumn(columnId));
    emitToBoard(boardId, 'card:created', { card }, socketId);

    res.status(201).json({ card });
  } catch (err) {
    console.error('createCard error:', err);
    res.status(500).json({ error: 'Could not create card' });
  }
}

async function getBoardIdForColumn(columnId) {
  const result = await pool.query('SELECT board_id FROM columns WHERE id = $1', [columnId]);
  return result.rows[0]?.board_id;
}

// PATCH /api/cards/:id - edit title/description only (no position change)
async function updateCard(req, res) {
  try {
    const { id } = req.params;
    const { title, description, socketId } = req.body;

    if (typeof title === 'string') {
      const validationError = validateRequiredText(title, 'Card title', LIMITS.CARD_TITLE);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }
    }

    const result = await pool.query(
      `UPDATE cards
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, column_id, title, description, position, updated_at`,
      [title?.trim(), description, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    const card = result.rows[0];

    const boardId = req.params.boardId || (await getBoardIdForColumn(card.column_id));
    emitToBoard(boardId, 'card:updated', { card }, socketId);

    res.json({ card });
  } catch (err) {
    console.error('updateCard error:', err);
    res.status(500).json({ error: 'Could not update card' });
  }
}

// PATCH /api/cards/:id/move - move a card to a (possibly different) column + position
// This is the operation the frontend calls on every drag-and-drop drop.
async function moveCard(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { toColumnId, toPosition, socketId } = req.body;

    if (!toColumnId || typeof toPosition !== 'number') {
      return res.status(400).json({ error: 'toColumnId and toPosition are required' });
    }

    const cardResult = await client.query(
      'SELECT column_id, position FROM cards WHERE id = $1',
      [id]
    );
    if (cardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    const { column_id: fromColumnId, position: fromPosition } = cardResult.rows[0];

    await client.query('BEGIN');

    if (fromColumnId === toColumnId) {
      // Reordering within the same column
      if (toPosition > fromPosition) {
        await client.query(
          `UPDATE cards SET position = position - 1
           WHERE column_id = $1 AND position > $2 AND position <= $3`,
          [fromColumnId, fromPosition, toPosition]
        );
      } else if (toPosition < fromPosition) {
        await client.query(
          `UPDATE cards SET position = position + 1
           WHERE column_id = $1 AND position >= $2 AND position < $3`,
          [fromColumnId, toPosition, fromPosition]
        );
      }
    } else {
      // Moving to a different column:
      // 1. Close the gap left behind in the old column
      await client.query(
        `UPDATE cards SET position = position - 1
         WHERE column_id = $1 AND position > $2`,
        [fromColumnId, fromPosition]
      );
      // 2. Make room at the target position in the new column
      await client.query(
        `UPDATE cards SET position = position + 1
         WHERE column_id = $1 AND position >= $2`,
        [toColumnId, toPosition]
      );
    }

    const result = await client.query(
      `UPDATE cards
       SET column_id = $1, position = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, column_id, title, description, position, updated_at`,
      [toColumnId, toPosition, id]
    );

    await client.query('COMMIT');
    const card = result.rows[0];

    const boardId = req.params.boardId || (await getBoardIdForColumn(toColumnId));
    emitToBoard(boardId, 'card:moved', { card, fromColumnId }, socketId);

    res.json({ card, fromColumnId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('moveCard error:', err);
    res.status(500).json({ error: 'Could not move card' });
  } finally {
    client.release();
  }
}

// DELETE /api/cards/:id
async function deleteCard(req, res) {
  try {
    const { id } = req.params;
    const { socketId } = req.body;

    const cardResult = await pool.query(
      `SELECT col.board_id, c.column_id FROM cards c
       JOIN columns col ON col.id = c.column_id
       WHERE c.id = $1`,
      [id]
    );
    if (cardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    const { board_id: boardId, column_id: columnId } = cardResult.rows[0];

    await pool.query('DELETE FROM cards WHERE id = $1', [id]);

    emitToBoard(boardId, 'card:deleted', { cardId: Number(id), columnId }, socketId);

    res.json({ success: true });
  } catch (err) {
    console.error('deleteCard error:', err);
    res.status(500).json({ error: 'Could not delete card' });
  }
}

module.exports = { createCard, updateCard, moveCard, deleteCard };
