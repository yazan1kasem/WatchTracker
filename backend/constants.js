// Single source for the values that schema.sql also enforces with CHECK constraints.
const ROLES = Object.freeze({
  USER: 'user',
  ADMIN: 'admin'
});

const MEDIA_TYPES = Object.freeze({
  MOVIE: 'movie',
  TV: 'tv'
});

module.exports = { MEDIA_TYPES, ROLES };
