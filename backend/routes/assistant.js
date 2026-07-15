const express = require('express');
const authMiddleware = require('../middleware/auth');
const { ask, isConfigured, AssistantNotConfiguredError } = require('../services/assistant');

const router = express.Router();
router.use(authMiddleware);

const MAX_QUESTION_LENGTH = 1000;

// Diz se o Vero está ligado, pra UI esconder o chat em vez de oferecer algo quebrado.
router.get('/status', (req, res) => {
  res.json({ enabled: isConfigured() });
});

router.post('/', async (req, res) => {
  const { question } = req.body;

  if (typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: 'question é obrigatório' });
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({ error: `question deve ter no máximo ${MAX_QUESTION_LENGTH} caracteres` });
  }

  try {
    const { answer, refused } = await ask(req.user, question.trim());
    res.json({ answer, refused });
  } catch (err) {
    if (err instanceof AssistantNotConfiguredError) {
      return res.status(503).json({ error: err.message });
    }

    // Erros da API viram status HTTP tratados por CLASSE, nunca por texto da
    // mensagem. Sem isso, um 429 da Anthropic viraria um 500 genérico e o
    // usuário não saberia que era só esperar.
    const anthropic = require('@anthropic-ai/sdk');

    if (err instanceof anthropic.RateLimitError) {
      return res.status(429).json({ error: 'O Vero está sobrecarregado. Tente de novo em instantes.' });
    }
    if (err instanceof anthropic.AuthenticationError) {
      return res.status(503).json({ error: 'A ANTHROPIC_API_KEY é inválida.' });
    }
    if (err instanceof anthropic.APIConnectionError) {
      return res.status(503).json({ error: 'Não consegui falar com o Vero agora. Tente de novo.' });
    }
    if (err instanceof anthropic.APIError) {
      console.error('Erro da API da Anthropic:', err.status, err.message);
      return res.status(502).json({ error: 'O Vero falhou ao responder. Tente de novo.' });
    }

    throw err; // desconhecido: deixa o middleware de erro do server tratar
  }
});

module.exports = router;
