const config = require('../config');
const { AppError, HTTP_STATUS } = require('../middleware/errors');

const attemptsByUsername = new Map();

// Counts the attempt before the password check, so parallel requests cannot slip past the limit.
function registerLoginAttempt(username) {
  const now = Date.now();
  removeExpiredAttempts(now);
  const attempt = attemptsByUsername.get(username) ?? { count: 0, startedAt: now };

  if (attempt.count >= config.MAX_LOGIN_ATTEMPTS) {
    throw new AppError(HTTP_STATUS.TOO_MANY_REQUESTS, 'LOGIN_RATE_LIMITED', 'Too many login attempts.');
  }

  attemptsByUsername.set(username, { count: attempt.count + 1, startedAt: attempt.startedAt });
}

function resetLoginAttempts(username) {
  attemptsByUsername.delete(username);
}

// ponytail: full sweep per login keeps memory bounded by the window; fine for one server process.
function removeExpiredAttempts(now) {
  for (const [username, attempt] of attemptsByUsername) {
    if (now - attempt.startedAt >= config.LOGIN_WINDOW_MS) {
      attemptsByUsername.delete(username);
    }
  }
}

module.exports = { registerLoginAttempt, resetLoginAttempts };
