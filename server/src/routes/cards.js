const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { requireCardBoardMember } = require('../middleware/boardAccess');
const { updateCard, moveCard, deleteCard } = require('../controllers/cardController');

router.use(requireAuth);

router.patch('/:id', requireCardBoardMember, updateCard);
router.patch('/:id/move', requireCardBoardMember, moveCard);
router.delete('/:id', requireCardBoardMember, deleteCard);

module.exports = router;
