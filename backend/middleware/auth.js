const config = require('../config');
const { readDatabase } = require('../db/connection');
const { findUserById } = require('../db/user-repository');
const { verifyToken } = require('../services/token-service');
const { createUnauthenticatedError } = require('./errors');

const AUTH_COOKIE_NAME = 'watchtrack_token';
const COOKIE_ATTRIBUTES = 'HttpOnly; SameSite=Lax; Path=/';

// Loads the user on every request so deleted accounts and changed roles take effect immediately.
async function requireAuth(request, _response, next) {
  const token = readTokenCookie(request.headers.cookie);
  const payload = token ? verifyToken(token) : null;
  const user = payload ? await readDatabase((database) => findUserById(database, payload.sub)) : null;

  if (!user) {
    next(createUnauthenticatedError());
    return;
  }

  request.user = user;
  next();
}

function setAuthCookie(response, token) {
  const secureAttribute = config.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader(
    'Set-Cookie',
    `${AUTH_COOKIE_NAME}=${token}; ${COOKIE_ATTRIBUTES}; Max-Age=${config.JWT_EXPIRES_IN_SECONDS}${secureAttribute}`
  );
}

function clearAuthCookie(response) {
  response.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=; ${COOKIE_ATTRIBUTES}; Max-Age=0`);
}

function readTokenCookie(cookieHeader) {
  const cookies = cookieHeader?.split(';') ?? [];
  const tokenCookie = cookies.find((cookie) => cookie.trim().startsWith(`${AUTH_COOKIE_NAME}=`));

  return tokenCookie?.trim().slice(AUTH_COOKIE_NAME.length + 1);
}

module.exports = { clearAuthCookie, requireAuth, setAuthCookie };
