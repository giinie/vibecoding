const express = require('express');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const refreshTokenModel = require('../models/refreshTokenModel');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FAMILIES_PER_USER = 5;

function signAccessToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function createTokenPair(userId) {
  const accessToken = signAccessToken(userId);

  const familyCount = refreshTokenModel.countFamilies(userId);
  if (familyCount >= MAX_FAMILIES_PER_USER) {
    refreshTokenModel.deleteOldestFamily(userId);
  }

  const refreshData = refreshTokenModel.create(userId);
  return { accessToken, refreshToken: refreshData.token };
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
    const { accessToken, refreshToken } = createTokenPair(user.id);

    return res.status(201).json({ token: accessToken, refreshToken, user });
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

    const { accessToken, refreshToken } = createTokenPair(user.id);

    const { password_hash, ...safeUser } = user;
    return res.json({ token: accessToken, refreshToken, user: safeUser });
  } catch (err) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Missing refreshToken field' });
    }

    refreshTokenModel.deleteExpired();

    const existing = refreshTokenModel.findByToken(refreshToken);

    if (!existing) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    if (new Date(existing.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    if (existing.is_used) {
      refreshTokenModel.deleteFamily(existing.family_id);
      return res.status(401).json({ error: 'Refresh token replay detected — family revoked' });
    }

    refreshTokenModel.markUsed(existing.id);

    const accessToken = signAccessToken(existing.user_id);
    const newRefresh = refreshTokenModel.createWithFamily(existing.user_id, existing.family_id);

    return res.json({ token: accessToken, refreshToken: newRefresh.token });
  } catch (err) {
    return res.status(500).json({ error: 'Token refresh failed' });
  }
});

router.post('/logout', (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      const existing = refreshTokenModel.findByToken(refreshToken);
      if (existing) {
        refreshTokenModel.deleteFamily(existing.family_id);
      }
    }

    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;
