const express = require('express');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

const router = express.Router();

router.post('/register', (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields: name, email, password' });
    }

    const existing = userModel.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = userModel.create({ name, email, password });
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(201).json({ token, user });
  } catch (err) {
    return res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing required fields: email, password' });
    }

    const user = userModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!userModel.verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { password_hash, ...safeUser } = user;
    return res.json({ token, user: safeUser });
  } catch (err) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
