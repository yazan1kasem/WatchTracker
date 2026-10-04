const HTTP_STATUS = Object.freeze({
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502
});

class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

function createValidationError(message) {
  return new AppError(HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR', message);
}

function createUnauthenticatedError() {
  return new AppError(HTTP_STATUS.UNAUTHORIZED, 'UNAUTHENTICATED', 'Authentication required.');
}

function createForbiddenError(message = 'You do not have permission for this action.') {
  return new AppError(HTTP_STATUS.FORBIDDEN, 'FORBIDDEN', message);
}

function createNotFoundError(message) {
  return new AppError(HTTP_STATUS.NOT_FOUND, 'NOT_FOUND', message);
}

function createConflictError(message) {
  return new AppError(HTTP_STATUS.CONFLICT, 'DUPLICATE_RESOURCE', message);
}

function createTmdbUnavailableError(message) {
  return new AppError(HTTP_STATUS.BAD_GATEWAY, 'TMDB_UNAVAILABLE', message);
}

function sendError(response, status, code, message) {
  response.status(status).json({ error: { code, message } });
}

function isApiRequest(request) {
  return request.path === '/api' || request.path.startsWith('/api/');
}

function isInvalidJsonError(error) {
  return error instanceof SyntaxError && error.status === HTTP_STATUS.BAD_REQUEST && 'body' in error;
}

function handleNotFound(request, response) {
  if (!isApiRequest(request)) {
    response.status(HTTP_STATUS.NOT_FOUND).send('Not found.');
    return;
  }

  sendError(response, HTTP_STATUS.NOT_FOUND, 'NOT_FOUND', 'API endpoint not found.');
}

function handleError(error, _request, response, _next) {
  if (isInvalidJsonError(error)) {
    sendError(response, HTTP_STATUS.BAD_REQUEST, 'INVALID_JSON', 'Request body must contain valid JSON.');
    return;
  }

  if (error instanceof AppError) {
    sendError(response, error.status, error.code, error.message);
    return;
  }

  console.error(error);
  sendError(
    response,
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    'INTERNAL_SERVER_ERROR',
    'An unexpected server error occurred.'
  );
}

module.exports = {
  AppError,
  HTTP_STATUS,
  createConflictError,
  createForbiddenError,
  createNotFoundError,
  createTmdbUnavailableError,
  createUnauthenticatedError,
  createValidationError,
  handleError,
  handleNotFound
};
