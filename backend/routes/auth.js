const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const RefreshToken = require('../models/refreshToken');
const Account = require('../models/account');

const router = express.Router();

const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || '30', 10);

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueTokens(user) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );

  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt
  });

  return { accessToken, refreshToken };
}

router.post('/register', async (req, res) => {
  const { name, email, password, whatsappNumber } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email e password são obrigatórios' });
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'E-mail já cadastrado' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, whatsappNumber });

  await Account.create({
    userId: user.id,
    name: 'Conta Padrão',
    type: 'carteira',
    initialBalance: 0
  });

  return res.status(201).json({ id: user.id, name: user.name, email: user.email });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const { accessToken, refreshToken } = await issueTokens(user);

  return res.json({
    token: accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email }
  });
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken é obrigatório' });
  }

  const stored = await RefreshToken.findOne({ where: { tokenHash: hashToken(refreshToken) } });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    return res.status(401).json({ error: 'Refresh token inválido ou expirado' });
  }

  const user = await User.findByPk(stored.userId);
  if (!user) {
    return res.status(401).json({ error: 'Usuário não encontrado' });
  }

  await stored.update({ revokedAt: new Date() });
  const tokens = await issueTokens(user);

  return res.json({ token: tokens.accessToken, refreshToken: tokens.refreshToken });
});

router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.sendStatus(204);
  }

  await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { tokenHash: hashToken(refreshToken) } }
  );

  return res.sendStatus(204);
});

module.exports = router;
