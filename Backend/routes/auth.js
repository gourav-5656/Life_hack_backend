const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');
const verifyToken = require('../middleware/authMiddleware');

// Called once right after frontend login — creates the profile if it doesn't exist
router.post('/init-profile', verifyToken, async (req, res) => {
  const { uid, email } = req.user;
  const userRef = db.collection('users').doc(uid);
  const doc = await userRef.get();

  if (!doc.exists) {
    await userRef.set({
      email,
      level: 1,
      totalXP: 0,
      currency: 0,
      createdAt: new Date().toISOString(),
    });
  }

  const userDoc = await userRef.get();
  res.json(userDoc.data());
});

module.exports = router;