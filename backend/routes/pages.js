const path = require('node:path');
const express = require('express');
const config = require('../config');

const HTTP_MOVED_PERMANENTLY = 301;
const HOME_PATH = '/';
const PUBLIC_PROFILE_PATH_PREFIX = '/u/';

// Every page has a clean URL; the HTML files themselves are an implementation detail.
const PAGE_FILES = {
  '/': 'profile-search.html',
  '/login': 'login.html',
  '/register': 'register.html',
  '/library': 'library.html',
  '/library/add': 'add-media.html',
  '/admin': 'admin.html',
  '/u/:username': 'public-profile.html'
};

// Old .html addresses keep working for existing bookmarks and links.
const LEGACY_PAGE_REDIRECTS = {
  '/profile-search.html': '/',
  '/login.html': '/login',
  '/register.html': '/register',
  '/library.html': '/library',
  '/add-media.html': '/library/add',
  '/admin.html': '/admin'
};

const router = express.Router();

for (const [pagePath, fileName] of Object.entries(PAGE_FILES)) {
  router.get(pagePath, (_request, response) => {
    response.sendFile(path.join(config.FRONTEND_DIRECTORY, fileName));
  });
}

for (const [legacyPath, pagePath] of Object.entries(LEGACY_PAGE_REDIRECTS)) {
  router.get(legacyPath, (request, response) => {
    response.redirect(HTTP_MOVED_PERMANENTLY, `${pagePath}${getQueryString(request)}`);
  });
}

router.get('/public-profile.html', (request, response) => {
  const username = request.query.username;
  const target = typeof username === 'string' && username
    ? `${PUBLIC_PROFILE_PATH_PREFIX}${encodeURIComponent(username)}`
    : HOME_PATH;
  response.redirect(HTTP_MOVED_PERMANENTLY, target);
});

function getQueryString(request) {
  const queryStart = request.originalUrl.indexOf('?');
  return queryStart === -1 ? '' : request.originalUrl.slice(queryStart);
}

module.exports = router;
