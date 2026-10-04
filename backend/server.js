const path = require('node:path');
const express = require('express');
const config = require('./config');
const { notFoundHandler, errorHandler } = require('./middleware/errors');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const tmdbRoutes = require('./routes/tmdb');
const trackedMediaRoutes = require('./routes/trackedMediaRoutes');
const publicProfileRoutes = require('./routes/publicProfiles');

const app = express();
const frontendDirectory = path.resolve(__dirname, '..', 'frontend');

app.use(express.json());
app.use(express.static(frontendDirectory, { index: 'profile-search.html' }));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tmdb', tmdbRoutes);
app.use('/api/tracked-media', trackedMediaRoutes);
app.use('/api/users', publicProfileRoutes);

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'watchtrack'
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.PORT, () => {
  console.log(`WatchTrack listening on http://localhost:${config.PORT}`);
});

module.exports = app;
