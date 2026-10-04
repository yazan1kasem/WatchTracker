const crypto = require('node:crypto');
const config = require('../config');

const JWT_ALGORITHM = 'HS256';
const HMAC_ALGORITHM = 'sha256';
const TOKEN_PART_COUNT = 3;
const MILLISECONDS_PER_SECOND = 1000;

function createToken(user) {
  const issuedAt = getCurrentTimeInSeconds();
  const header = encodeJson({ alg: JWT_ALGORITHM, typ: 'JWT' });
  const payload = encodeJson({
    sub: user.id,
    role: user.role,
    iat: issuedAt,
    exp: issuedAt + config.JWT_EXPIRES_IN_SECONDS
  });
  const signedValue = `${header}.${payload}`;

  return `${signedValue}.${createSignature(signedValue)}`;
}

// Returns the payload, or null for any token that is malformed, forged or expired.
function verifyToken(token) {
  const parts = token.split('.');

  if (parts.length !== TOKEN_PART_COUNT) {
    return null;
  }

  const [header, payload, signature] = parts;

  if (!hasValidSignature(header, payload, signature)) {
    return null;
  }

  // Only tokens signed by this server reach this point, so the JSON is known to be valid.
  const decodedHeader = decodeJson(header);
  const decodedPayload = decodeJson(payload);
  return isValidPayload(decodedHeader, decodedPayload) ? decodedPayload : null;
}

function hasValidSignature(header, payload, signature) {
  const actualSignature = Buffer.from(signature);
  const expectedSignature = Buffer.from(createSignature(`${header}.${payload}`));

  return (
    actualSignature.length === expectedSignature.length &&
    crypto.timingSafeEqual(actualSignature, expectedSignature)
  );
}

function isValidPayload(decodedHeader, decodedPayload) {
  return (
    decodedHeader.alg === JWT_ALGORITHM &&
    Number.isInteger(decodedPayload.sub) &&
    typeof decodedPayload.role === 'string' &&
    Number.isInteger(decodedPayload.exp) &&
    decodedPayload.exp > getCurrentTimeInSeconds()
  );
}

function createSignature(value) {
  return crypto.createHmac(HMAC_ALGORITHM, config.JWT_SECRET).update(value).digest('base64url');
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeJson(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function getCurrentTimeInSeconds() {
  return Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
}

module.exports = { createToken, verifyToken };
