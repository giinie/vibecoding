const express = require('express');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields: name, email, password' });
    }

    if (typeof name !== 'string' || name.length < 1 || name.length > 50) {
      return res.status(400).json({ error: 'Name must be between 1 and 50 characters' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (password.length < 8 || password.length > 100) {
      return res.status(400).json({ error: 'Password must be between 8 and 100 characters' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = userModel.findByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await userModel.create({ name, email: normalizedEmail, password });
    const token = signToken(user.id);

    return res.status(201).json({ token, user });
  } catch (err) {
    return res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing required fields: email, password' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = userModel.findByEmail(normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!await userModel.verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user.id);

    const { password_hash, ...safeUser } = user;
    return res.json({ token, user: safeUser });
  } catch (err) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
