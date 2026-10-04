const express = require('express');
const { ROLES } = require('../constants');
const { clearAuthCookie, requireAuth, setAuthCookie } = require('../middleware/auth');
const { HTTP_STATUS } = require('../middleware/errors');
const { authenticateUser } = require('../services/auth-service');
const { createToken } = require('../services/token-service');
const { createUser } = require('../services/user-service');
const { validateLoginCredentials, validateRegistration } = require('../validation/user-validation');

const router = express.Router();

router.post('/register', async (request, response) => {
  const user = await createUser(validateRegistration(request.body), ROLES.USER);
  response.status(HTTP_STATUS.CREATED).json({ data: { user } });
});

router.post('/login', async (request, response) => {
  const user = await authenticateUser(validateLoginCredentials(request.body));
  setAuthCookie(response, createToken(user));
  response.json({ data: { user } });
});

router.post('/logout', requireAuth, (_request, response) => {
  clearAuthCookie(response);
  response.status(HTTP_STATUS.NO_CONTENT).send();
});

router.get('/me', requireAuth, (request, response) => {
  response.json({ data: { user: request.user } });
});

module.exports = router;
