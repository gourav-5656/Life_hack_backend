const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');
const verifyToken = require('../middleware/authMiddleware');
require('dotenv').config();

// Non-linear XP curve: XP needed for next level
function xpForLevel(level) {
  return Math.round(100 * Math.pow(level, 1.5));
}

router.post('/complete-task/:taskId', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const { taskId } = req.params;

  const taskRef = db.collection('users').doc(uid).collection('tasks').doc(taskId);
  const taskDoc = await taskRef.get();

  if (!taskDoc.exists) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const task = taskDoc.data();

  if (task.status === 'completed') {
    return res.status(400).json({ error: 'Task already completed' });
  }

  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  const user = userDoc.data();

  // Time since account/last activity - basic anomaly input
  const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt) : new Date(user.createdAt);
  const secondsSinceLast = (Date.now() - lastActive.getTime()) / 1000;

  // Call Python anomaly-check service
  let checkResult = { valid: true, risk_score: 0 };
  try {
    const pyRes = await fetch(`${process.env.PYTHON_SERVICE_URL}/check-xp-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: uid,
        xp_amount: task.xpValue,
        time_since_last_completion: secondsSinceLast,
      }),
    });
    checkResult = await pyRes.json();
  } catch (err) {
    console.error('Python service unreachable, defaulting to valid:', err.message);
  }

  if (!checkResult.valid) {
    return res.status(403).json({ error: 'Task completion flagged as suspicious', risk_score: checkResult.risk_score });
  }
 // --- Streak logic ---
  const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
  const lastActiveDate = user.lastActiveDate || null;
  let currentStreak = user.currentStreak || 0;
  let longestStreak = user.longestStreak || 0;

  if (lastActiveDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (lastActiveDate === yesterdayStr) {
      currentStreak += 1; // continued streak
    } else {
      currentStreak = 1; // streak broken, restart
    }
    longestStreak = Math.max(longestStreak, currentStreak);
  }
  // Compute new XP/level
  let newTotalXP = user.totalXP + task.xpValue;
  let newLevel = user.level;
  let leveledUp = false;

  while (newTotalXP >= xpForLevel(newLevel)) {
    newTotalXP -= xpForLevel(newLevel);
    newLevel += 1;
    leveledUp = true;
  }

   await userRef.update({
    totalXP: newTotalXP,
    level: newLevel,
    currency: (user.currency || 0) + Math.round(task.xpValue / 2),
    lastActiveAt: new Date().toISOString(),
    lastActiveDate: today,
    currentStreak,
    longestStreak,
  });

  await taskRef.update({ status: 'completed', completedAt: new Date().toISOString() });

   res.json({
    leveledUp,
    newLevel,
    newTotalXP,
    xpForNextLevel: xpForLevel(newLevel),
    currentStreak,
    longestStreak,
  });
});

module.exports = router;