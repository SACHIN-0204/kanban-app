const pool = require('../db/pool');

// Confirms the logged-in user is a member (owner or collaborator) of the
// board referenced by req.params.boardId. Attaches req.boardRole ('owner' | 'collaborator').
// Use on any route that operates on a specific board, or on nested
// columns/cards where we resolve the boardId first.
async function requireBoardMember(req, res, next) {
  try {
    const boardId = req.params.boardId;
    const result = await pool.query(
      'SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2',
      [boardId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this board' });
    }

    req.boardRole = result.rows[0].role;
    next();
  } catch (err) {
    console.error('requireBoardMember error:', err);
    res.status(500).json({ error: 'Something went wrong checking board access' });
  }
}

// Stricter check for destructive actions (delete board, remove members).
function requireBoardOwner(req, res, next) {
  if (req.boardRole !== 'owner') {
    return res.status(403).json({ error: 'Only the board owner can do this' });
  }
  next();
}

// For routes keyed by columnId (e.g. PATCH /api/columns/:id), we don't have
// boardId in the URL. Look it up first, then run the same membership check.
async function requireColumnBoardMember(req, res, next) {
  try {
    const columnId = req.params.id || req.params.columnId;
    const colResult = await pool.query('SELECT board_id FROM columns WHERE id = $1', [columnId]);
    if (colResult.rows.length === 0) {
      return res.status(404).json({ error: 'Column not found' });
    }
    req.params.boardId = colResult.rows[0].board_id;
    return requireBoardMember(req, res, next);
  } catch (err) {
    console.error('requireColumnBoardMember error:', err);
    res.status(500).json({ error: 'Something went wrong checking board access' });
  }
}

// Same idea for routes keyed by cardId (e.g. PATCH /api/cards/:id).
async function requireCardBoardMember(req, res, next) {
  try {
    const cardId = req.params.id;
    const cardResult = await pool.query(
      `SELECT col.board_id FROM cards c
       JOIN columns col ON col.id = c.column_id
       WHERE c.id = $1`,
      [cardId]
    );
    if (cardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    req.params.boardId = cardResult.rows[0].board_id;
    return requireBoardMember(req, res, next);
  } catch (err) {
    console.error('requireCardBoardMember error:', err);
    res.status(500).json({ error: 'Something went wrong checking board access' });
  }
}

module.exports = {
  requireBoardMember,
  requireBoardOwner,
  requireColumnBoardMember,
  requireCardBoardMember,
};
