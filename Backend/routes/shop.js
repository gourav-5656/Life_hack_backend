const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');
const verifyToken = require('../middleware/authMiddleware');

// Hardcoded shop catalog for now — could move to Firestore later
const SHOP_ITEMS = {
  'theme_dark': { name: 'Dark Theme', cost: 50, type: 'theme' },
  'badge_streak7': { name: '7-Day Streak Badge', cost: 30, type: 'badge' },
  'avatar_knight': { name: 'Knight Avatar', cost: 80, type: 'avatar' },
};

// List available items
router.get('/items', verifyToken, (req, res) => {
  res.json(SHOP_ITEMS);
});

// Buy an item
router.post('/buy/:itemId', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const { itemId } = req.params;

  const item = SHOP_ITEMS[itemId];
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  const user = userDoc.data();

  if ((user.currency || 0) < item.cost) {
    return res.status(400).json({ error: 'Not enough currency' });
  }

  // Check if already owned
  const invRef = userRef.collection('inventory').doc(itemId);
  const invDoc = await invRef.get();
  if (invDoc.exists) {
    return res.status(400).json({ error: 'Item already owned' });
  }

  await userRef.update({ currency: user.currency - item.cost });
  await invRef.set({ ...item, acquiredAt: new Date().toISOString() });

  res.json({ success: true, item, remainingCurrency: user.currency - item.cost });
});

// List owned items
router.get('/inventory', verifyToken, async (req, res) => {
  const snapshot = await db.collection('users').doc(req.user.uid).collection('inventory').get();
  const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.json(items);
});

module.exports = router;