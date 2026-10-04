const path = require('node:path');
const dotenv = require('dotenv');

const DEFAULT_NODE_ENV = 'development';
const DEFAULT_TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const DEFAULT_TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const DEFAULT_JWT_EXPIRES_IN = '1h';
const DEFAULT_TMDB_LANGUAGE = 'en-US';
const MAX_PORT = 65535;
const MIN_PRODUCTION_SECRET_LENGTH = 32;
const MILLISECONDS_PER_MINUTE = 60 * 1000;
const SECONDS_PER_DURATION_UNIT = { s: 1, m: 60, h: 3600, d: 86400 };
const DURATION_PATTERN = /^(\d+)([smhd])$/;

dotenv.config();

function readRequiredEnvironmentVariable(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env and set it.`);
  }

  return value;
}

function readOptionalEnvironmentVariable(name, fallback) {
  return process.env[name]?.trim() || fallback;
}

function readPositiveIntegerEnvironmentVariable(name) {
  const value = Number(readRequiredEnvironmentVariable(name));

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

function readMinutesEnvironmentVariableInMilliseconds(name) {
  return readPositiveIntegerEnvironmentVariable(name) * MILLISECONDS_PER_MINUTE;
}

function readPort() {
  const port = Number(readRequiredEnvironmentVariable('PORT'));

  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    throw new Error(`PORT must be an integer between 1 and ${MAX_PORT}.`);
  }

  return port;
}

function readTokenDurationSeconds() {
  const value = readOptionalEnvironmentVariable('JWT_EXPIRES_IN', DEFAULT_JWT_EXPIRES_IN);
  const match = DURATION_PATTERN.exec(value);

  if (!match) {
    throw new Error('JWT_EXPIRES_IN must use a number followed by s, m, h, or d.');
  }

  const [, amount, unit] = match;
  return Number(amount) * SECONDS_PER_DURATION_UNIT[unit];
}

function readJwtSecret(nodeEnvironment) {
  const jwtSecret = readRequiredEnvironmentVariable('JWT_SECRET');

  if (nodeEnvironment === 'production' && jwtSecret.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must contain at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production.`);
  }

  return jwtSecret;
}

const NODE_ENV = readOptionalEnvironmentVariable('NODE_ENV', DEFAULT_NODE_ENV);

module.exports = {
  PORT: readPort(),
  DB_FILE: path.resolve(process.cwd(), readRequiredEnvironmentVariable('DB_FILE')),
  FRONTEND_DIRECTORY: path.resolve(__dirname, '..', 'frontend'),
  JWT_SECRET: readJwtSecret(NODE_ENV),
  JWT_EXPIRES_IN_SECONDS: readTokenDurationSeconds(),
  MAX_LOGIN_ATTEMPTS: readPositiveIntegerEnvironmentVariable('MAX_LOGIN_ATTEMPTS'),
  LOGIN_WINDOW_MS: readMinutesEnvironmentVariableInMilliseconds('LOGIN_WINDOW_MINUTES'),
  NODE_ENV,
  ADMIN_USERNAME: readOptionalEnvironmentVariable('ADMIN_USERNAME'),
  ADMIN_PASSWORD: readOptionalEnvironmentVariable('ADMIN_PASSWORD'),
  TMDB_API_KEY: readRequiredEnvironmentVariable('TMDB_API_KEY'),
  TMDB_BASE_URL: readOptionalEnvironmentVariable('TMDB_BASE_URL', DEFAULT_TMDB_BASE_URL),
  TMDB_DETAILS_CACHE_MS: readMinutesEnvironmentVariableInMilliseconds('TMDB_DETAILS_CACHE_MINUTES'),
  TMDB_IMAGE_BASE_URL: readOptionalEnvironmentVariable('TMDB_IMAGE_BASE_URL', DEFAULT_TMDB_IMAGE_BASE_URL),
  TMDB_LANGUAGE: readOptionalEnvironmentVariable('TMDB_LANGUAGE', DEFAULT_TMDB_LANGUAGE),
  TMDB_SEARCH_CACHE_MS: readMinutesEnvironmentVariableInMilliseconds('TMDB_SEARCH_CACHE_MINUTES')
};
