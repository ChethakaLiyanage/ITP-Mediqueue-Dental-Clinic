const express = require('express');
const router = express.Router();
const { login, verifyToken, updateProfile } = require('../Controllers/ManagerAuthControllers');

// Manager login route
router.post('/login', login);

// Update manager profile
router.patch('/update-profile', verifyToken, updateProfile);

// Protected route example
router.get('/protected-route', verifyToken, (req, res) => {
  res.json({ message: 'This is a protected route for managers', user: req.user });
});

module.exports = router;
