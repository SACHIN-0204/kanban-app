const pool = require('../db/pool');
const { LIMITS, validateRequiredText } = require('../utils/validation');

// GET /api/boards - list all boards the logged-in user belongs to
async function listBoards(req, res) {
  try {
    const result = await pool.query(
      `SELECT b.id, b.name, b.created_at, bm.role
       FROM boards b
       JOIN board_members bm ON bm.board_id = b.id
       WHERE bm.user_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json({ boards: result.rows });
  } catch (err) {
    console.error('listBoards error:', err);
    res.status(500).json({ error: 'Could not fetch boards' });
  }
}

// POST /api/boards - create a board, creator becomes owner
async function createBoard(req, res) {
  const client = await pool.connect();
  try {
    const { name } = req.body;
    const validationError = validateRequiredText(name, 'Board name', LIMITS.BOARD_NAME);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await client.query('BEGIN');

    const boardResult = await client.query(
      'INSERT INTO boards (name, owner_id) VALUES ($1, $2) RETURNING id, name, owner_id, created_at',
      [name.trim(), req.user.id]
    );
    const board = boardResult.rows[0];

    await client.query(
      'INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)',
      [board.id, req.user.id, 'owner']
    );

    // Every new board starts with three default columns - saves the user setup work
    const defaultColumns = ['To Do', 'In Progress', 'Done'];
    for (let i = 0; i < defaultColumns.length; i++) {
      await client.query(
        'INSERT INTO columns (board_id, name, position) VALUES ($1, $2, $3)',
        [board.id, defaultColumns[i], i]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ board });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createBoard error:', err);
    res.status(500).json({ error: 'Could not create board' });
  } finally {
    client.release();
  }
}

// GET /api/boards/:boardId - full board with columns + cards, nested
async function getBoard(req, res) {
  try {
    const { boardId } = req.params;

    const boardResult = await pool.query(
      'SELECT id, name, owner_id, created_at FROM boards WHERE id = $1',
      [boardId]
    );
    if (boardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const columnsResult = await pool.query(
      'SELECT id, name, position FROM columns WHERE board_id = $1 ORDER BY position ASC',
      [boardId]
    );

    const cardsResult = await pool.query(
      `SELECT c.id, c.column_id, c.title, c.description, c.position, c.updated_at
       FROM cards c
       JOIN columns col ON col.id = c.column_id
       WHERE col.board_id = $1
       ORDER BY c.position ASC`,
      [boardId]
    );

    const membersResult = await pool.query(
      `SELECT u.id, u.name, u.email, bm.role
       FROM board_members bm
       JOIN users u ON u.id = bm.user_id
       WHERE bm.board_id = $1`,
      [boardId]
    );

    // Nest cards under their column for easy frontend rendering
    const columns = columnsResult.rows.map((col) => ({
      ...col,
      cards: cardsResult.rows.filter((card) => card.column_id === col.id),
    }));

    res.json({
      board: boardResult.rows[0],
      columns,
      members: membersResult.rows,
      yourRole: req.boardRole,
    });
  } catch (err) {
    console.error('getBoard error:', err);
    res.status(500).json({ error: 'Could not fetch board' });
  }
}

// DELETE /api/boards/:boardId - owner only (enforced by requireBoardOwner middleware)
async function deleteBoard(req, res) {
  try {
    const { boardId } = req.params;
    await pool.query('DELETE FROM boards WHERE id = $1', [boardId]);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteBoard error:', err);
    res.status(500).json({ error: 'Could not delete board' });
  }
}

// POST /api/boards/:boardId/members - invite a collaborator by email (owner only)
async function addMember(req, res) {
  try {
    const { boardId } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const userResult = await pool.query('SELECT id, name, email FROM users WHERE email = $1', [
      email.toLowerCase(),
    ]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No user found with that email' });
    }
    const invitedUser = userResult.rows[0];

    const existing = await pool.query(
      'SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2',
      [boardId, invitedUser.id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'User is already a member of this board' });
    }

    await pool.query(
      'INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)',
      [boardId, invitedUser.id, 'collaborator']
    );

    res.status(201).json({ member: { ...invitedUser, role: 'collaborator' } });
  } catch (err) {
    console.error('addMember error:', err);
    res.status(500).json({ error: 'Could not add member' });
  }
}

module.exports = { listBoards, createBoard, getBoard, deleteBoard, addMember };
