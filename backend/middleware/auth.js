const crypto = require('node:crypto');
const config = require('../config');
const { AppError } = require('./errors');

const AUTH_COOKIE_NAME = 'watchtrack_token';
const JWT_ALGORITHM = 'HS256';
const TOKEN_DURATION_SECONDS = parseTokenDuration(config.JWT_EXPIRES_IN);

function parseTokenDuration(value) {
  const match = /^(\d+)([smhd])$/.exec(value);

  if (!match) {
    throw new Error('JWT_EXPIRES_IN must use a number followed by s, m, h, or d.');
  }

  const units = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(match[1]) * units[match[2]];
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function createSignature(value) {
  return crypto
    .createHmac('sha256', config.JWT_SECRET)
    .update(value)
    .digest('base64url');
}

function createToken(user) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: JWT_ALGORITHM, typ: 'JWT' }));
  const payload = encodeBase64Url(
    JSON.stringify({
      sub: user.id,
      role: user.role,
      iat: issuedAt,
      exp: issuedAt + TOKEN_DURATION_SECONDS
    })
  );
  const signedValue = `${header}.${payload}`;

  return `${signedValue}.${createSignature(signedValue)}`;
}

function verifyToken(token) {
  const parts = token.split('.');

  if (parts.length !== 3) {
    throw new Error('Invalid token.');
  }

  const [header, payload, signature] = parts;
  const expectedSignature = createSignature(`${header}.${payload}`);
  const signaturesMatch = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!signaturesMatch) {
    throw new Error('Invalid token.');
  }

  const decodedHeader = JSON.parse(decodeBase64Url(header));
  const decodedPayload = JSON.parse(decodeBase64Url(payload));

  if (
    decodedHeader.alg !== JWT_ALGORITHM ||
    !Number.isInteger(decodedPayload.sub) ||
    typeof decodedPayload.role !== 'string' ||
    !Number.isInteger(decodedPayload.exp) ||
    decodedPayload.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new Error('Invalid token.');
  }

  return decodedPayload;
}

function readCookie(cookieHeader) {
  const cookies = cookieHeader?.split(';') ?? [];
  const tokenCookie = cookies.find((cookie) => cookie.trim().startsWith(`${AUTH_COOKIE_NAME}=`));

  return tokenCookie?.trim().slice(AUTH_COOKIE_NAME.length + 1);
}

function requireAuth(request, _response, next) {
  const token = readCookie(request.headers.cookie);

  if (!token) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required.'));
    return;
  }

  try {
    const payload = verifyToken(token);
    request.user = { id: payload.sub, role: payload.role };
    next();
  } catch (_error) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required.'));
  }
}

function setAuthCookie(response, token) {
  const secureFlag = config.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader(
    'Set-Cookie',
    `${AUTH_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${TOKEN_DURATION_SECONDS}${secureFlag}`
  );
}

function clearAuthCookie(response) {
  response.setHeader(
    'Set-Cookie',
    `${AUTH_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
  );
}

module.exports = { clearAuthCookie, createToken, requireAuth, setAuthCookie };