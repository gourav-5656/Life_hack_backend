const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');
const verifyToken = require('../middleware/authMiddleware');

// GET all tasks for the logged-in user
router.get('/', verifyToken, async (req, res) => {
  const snapshot = await db.collection('users').doc(req.user.uid).collection('tasks').get();
  const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.json(tasks);
});

// CREATE a task
router.post('/', verifyToken, async (req, res) => {
  const { title, category, xpValue } = req.body;
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Task title cannot be empty' });
  }

  const MAX_XP = 100; // hard cap per task
  const safeXP = Math.min(Math.max(Number(xpValue) || 10, 1), MAX_XP);

  const taskRef = await db.collection('users').doc(req.user.uid).collection('tasks').add({
    title,
    category: category || 'General',
    xpValue: safeXP,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({ id: taskRef.id });
});

// UPDATE a task
router.put('/:taskId', verifyToken, async (req, res) => {
  const taskRef = db.collection('users').doc(req.user.uid).collection('tasks').doc(req.params.taskId);
  await taskRef.update(req.body);
  res.json({ success: true });
});

// DELETE a task
router.delete('/:taskId', verifyToken, async (req, res) => {
  await db.collection('users').doc(req.user.uid).collection('tasks').doc(req.params.taskId).delete();
  res.json({ success: true });
});

module.exports = router;