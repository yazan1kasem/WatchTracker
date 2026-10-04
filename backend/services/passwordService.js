const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const HASH_KEY_LENGTH = 64;
const SALT_LENGTH = 16;

async function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const derivedKey = await scrypt(password, salt, HASH_KEY_LENGTH);
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  const [algorithm, salt, hash] = storedHash.split('$');

  if (algorithm !== 'scrypt' || !salt || !hash) {
    return false;
  }

  const derivedKey = await scrypt(password, salt, HASH_KEY_LENGTH);
  const storedKey = Buffer.from(hash, 'hex');

  return (
    storedKey.length === derivedKey.length &&
    crypto.timingSafeEqual(storedKey, derivedKey)
  );
}

module.exports = { hashPassword, verifyPassword };