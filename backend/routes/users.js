const express = require('express');
const User = require('../models/user');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const publicShape = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  whatsappNumber: user.whatsappNumber
});

router.get('/me', async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json(publicShape(user));
});

router.patch('/me', async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  const { whatsappNumber } = req.body;
  if (whatsappNumber !== undefined) {
    // Guardamos em E.164 ("+5511999999999"): é assim que a Twilio manda o From,
    // e o webhook casa o número exato. Vazio desvincula (null). Removemos tudo
    // que não for dígito/"+" pra tolerar espaços, traços e parênteses digitados.
    const cleaned = String(whatsappNumber).replace(/[^\d+]/g, '').trim();
    user.whatsappNumber = cleaned ? cleaned : null;
  }

  // number duplicado cai no SequelizeUniqueConstraintError -> 400 no middleware de erro.
  await user.save();
  res.json(publicShape(user));
});

module.exports = router;
