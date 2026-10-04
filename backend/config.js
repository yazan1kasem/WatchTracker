const path = require('node:path');
const dotenv = require('dotenv');

const DEFAULT_NODE_ENV = 'development';
const DEFAULT_TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const DEFAULT_TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const DEFAULT_JWT_EXPIRES_IN = '1h';
const DEFAULT_TMDB_LANGUAGE = 'en-US';

dotenv.config();

function requiredEnvironmentVariable(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env and set it.`);
  }

  return value;
}

function optionalEnvironmentVariable(name, fallback) {
  return process.env[name]?.trim() || fallback;
}

function positiveIntegerEnvironmentVariable(name) {
  const value = Number(requiredEnvironmentVariable(name));

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

const port = Number(requiredEnvironmentVariable('PORT'));

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const maxLoginAttempts = positiveIntegerEnvironmentVariable('MAX_LOGIN_ATTEMPTS');
const loginWindowMinutes = positiveIntegerEnvironmentVariable('LOGIN_WINDOW_MINUTES');
const adminUsername = optionalEnvironmentVariable('ADMIN_USERNAME', '').trim();
const adminPassword = optionalEnvironmentVariable('ADMIN_PASSWORD', '').trim();
const nodeEnvironment = optionalEnvironmentVariable('NODE_ENV', DEFAULT_NODE_ENV);
const jwtSecret = requiredEnvironmentVariable('JWT_SECRET');

if (nodeEnvironment === 'production' && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters in production.');
}

module.exports = {
  PORT: port,
  DB_FILE: path.resolve(process.cwd(), requiredEnvironmentVariable('DB_FILE')),
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: optionalEnvironmentVariable('JWT_EXPIRES_IN', DEFAULT_JWT_EXPIRES_IN),
  MAX_LOGIN_ATTEMPTS: maxLoginAttempts,
  LOGIN_WINDOW_MS: loginWindowMinutes * 60 * 1000,
  NODE_ENV: nodeEnvironment,
  ADMIN_USERNAME: adminUsername || undefined,
  ADMIN_PASSWORD: adminPassword || undefined,
  TMDB_API_KEY: requiredEnvironmentVariable('TMDB_API_KEY'),
  TMDB_BASE_URL: optionalEnvironmentVariable('TMDB_BASE_URL', DEFAULT_TMDB_BASE_URL),
  TMDB_DETAILS_CACHE_MS:
    positiveIntegerEnvironmentVariable('TMDB_DETAILS_CACHE_MINUTES') * 60 * 1000,
  TMDB_IMAGE_BASE_URL: optionalEnvironmentVariable(
    'TMDB_IMAGE_BASE_URL',
    DEFAULT_TMDB_IMAGE_BASE_URL
  ),
  TMDB_LANGUAGE: optionalEnvironmentVariable('TMDB_LANGUAGE', DEFAULT_TMDB_LANGUAGE),
  TMDB_SEARCH_CACHE_MS:
    positiveIntegerEnvironmentVariable('TMDB_SEARCH_CACHE_MINUTES') * 60 * 1000
};
