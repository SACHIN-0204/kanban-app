const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { requireBoardMember, requireBoardOwner } = require('../middleware/boardAccess');

const {
  listBoards,
  createBoard,
  getBoard,
  deleteBoard,
  addMember,
} = require('../controllers/boardController');
const { createColumn } = require('../controllers/columnController');
const { createCard } = require('../controllers/cardController');

// All board routes require a logged-in user
router.use(requireAuth);

router.get('/', listBoards);
router.post('/', createBoard);

// Routes below operate on a specific board - check membership first
router.get('/:boardId', requireBoardMember, getBoard);
router.delete('/:boardId', requireBoardMember, requireBoardOwner, deleteBoard);
router.post('/:boardId/members', requireBoardMember, requireBoardOwner, addMember);

// Nested: creating a column requires membership on the parent board
router.post('/:boardId/columns', requireBoardMember, createColumn);

// Nested: creating a card requires membership on the board that owns the column.
// columnId isn't a board, so this route takes boardId in the path for the
// access check, then columnId identifies where the card goes.
router.post('/:boardId/columns/:columnId/cards', requireBoardMember, (req, res) => {
  req.params.columnId = req.params.columnId; // explicit for readability
  createCard(req, res);
});

module.exports = router;
