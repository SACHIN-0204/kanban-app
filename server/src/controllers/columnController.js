const pool = require('../db/pool');
const { emitToBoard } = require('../realtime');
const { LIMITS, validateRequiredText } = require('../utils/validation');

// POST /api/boards/:boardId/columns - add a new column at the end
async function createColumn(req, res) {
  try {
    const { boardId } = req.params;
    const { name, socketId } = req.body;

    const validationError = validateRequiredText(name, 'Column name', LIMITS.COLUMN_NAME);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const posResult = await pool.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM columns WHERE board_id = $1',
      [boardId]
    );
    const position = posResult.rows[0].next_position;

    const result = await pool.query(
      'INSERT INTO columns (board_id, name, position) VALUES ($1, $2, $3) RETURNING id, board_id, name, position',
      [boardId, name.trim(), position]
    );
    const column = result.rows[0];

    emitToBoard(boardId, 'column:created', { column: { ...column, cards: [] } }, socketId);

    res.status(201).json({ column });
  } catch (err) {
    console.error('createColumn error:', err);
    res.status(500).json({ error: 'Could not create column' });
  }
}

// PATCH /api/columns/:id - rename and/or reorder a column
// Reordering here is simple: pass a new position, and we shift the columns
// in between up or down by one. Good enough for a handful of columns per board.
async function updateColumn(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { name, position, socketId } = req.body;

    const currentResult = await client.query(
      'SELECT board_id, position FROM columns WHERE id = $1',
      [id]
    );
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Column not found' });
    }
    const current = currentResult.rows[0];

    if (typeof name === 'string') {
      const validationError = validateRequiredText(name, 'Column name', LIMITS.COLUMN_NAME);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }
    }

    await client.query('BEGIN');

    if (typeof position === 'number' && position !== current.position) {
      if (position > current.position) {
        // Moving right: shift columns in between left by one
        await client.query(
          `UPDATE columns SET position = position - 1
           WHERE board_id = $1 AND position > $2 AND position <= $3`,
          [current.board_id, current.position, position]
        );
      } else {
        // Moving left: shift columns in between right by one
        await client.query(
          `UPDATE columns SET position = position + 1
           WHERE board_id = $1 AND position >= $2 AND position < $3`,
          [current.board_id, position, current.position]
        );
      }
    }

    const result = await client.query(
      `UPDATE columns
       SET name = COALESCE($1, name),
           position = COALESCE($2, position)
       WHERE id = $3
       RETURNING id, board_id, name, position`,
      [name?.trim(), position, id]
    );

    await client.query('COMMIT');
    const column = result.rows[0];

    emitToBoard(current.board_id, 'column:updated', { column }, socketId);

    res.json({ column });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('updateColumn error:', err);
    res.status(500).json({ error: 'Could not update column' });
  } finally {
    client.release();
  }
}

// DELETE /api/columns/:id
async function deleteColumn(req, res) {
  try {
    const { id } = req.params;
    const { socketId } = req.body;

    const colResult = await pool.query('SELECT board_id FROM columns WHERE id = $1', [id]);
    if (colResult.rows.length === 0) {
      return res.status(404).json({ error: 'Column not found' });
    }
    const boardId = colResult.rows[0].board_id;

    await pool.query('DELETE FROM columns WHERE id = $1', [id]);

    emitToBoard(boardId, 'column:deleted', { columnId: Number(id) }, socketId);

    res.json({ success: true });
  } catch (err) {
    console.error('deleteColumn error:', err);
    res.status(500).json({ error: 'Could not delete column' });
  }
}

module.exports = { createColumn, updateColumn, deleteColumn };
