const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_INTERNAL_SERVER_ERROR = 500;

class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

function notFoundHandler(request, response) {
  if (request.path === '/api' || request.path.startsWith('/api/')) {
    response.status(HTTP_NOT_FOUND).json({
      error: {
        code: 'NOT_FOUND',
        message: 'API endpoint not found.'
      }
    });
    return;
  }

  response.status(HTTP_NOT_FOUND).send('Not found.');
}

function errorHandler(error, _request, response, _next) {
  if (error instanceof SyntaxError && error.status === HTTP_BAD_REQUEST && 'body' in error) {
    response.status(HTTP_BAD_REQUEST).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Request body must contain valid JSON.'
      }
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message
      }
    });
    return;
  }

  console.error(error);
  response.status(HTTP_INTERNAL_SERVER_ERROR).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred.'
    }
  });
}

module.exports = { AppError, notFoundHandler, errorHandler };
