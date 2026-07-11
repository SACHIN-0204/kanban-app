const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { requireColumnBoardMember } = require('../middleware/boardAccess');
const { updateColumn, deleteColumn } = require('../controllers/columnController');

router.use(requireAuth);

router.patch('/:id', requireColumnBoardMember, updateColumn);
router.delete('/:id', requireColumnBoardMember, deleteColumn);

module.exports = router;
