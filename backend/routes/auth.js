const express = require('express');
const {
  clearAuthCookie,
  createToken,
  requireAuth,
  setAuthCookie
} = require('../middleware/auth');
const {
  authenticateUser,
  getUserById,
  registerUser
} = require('../services/authService');
const { validateCredentials } = require('../validation/credentials');

const router = express.Router();

router.post('/register', async (request, response) => {
  const credentials = validateCredentials(request.body);
  const user = await registerUser(credentials);
  response.status(201).json({ data: { user } });
});

router.post('/login', async (request, response) => {
  const credentials = validateCredentials(request.body);
  const user = await authenticateUser(credentials);
  setAuthCookie(response, createToken(user));
  response.json({ data: { user } });
});

router.post('/logout', requireAuth, (_request, response) => {
  clearAuthCookie(response);
  response.status(204).send();
});

router.get('/me', requireAuth, async (request, response) => {
  const user = await getUserById(request.user.id);
  response.json({ data: { user } });
});

module.exports = router;