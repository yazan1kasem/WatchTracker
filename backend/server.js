const express = require('express');
const config = require('./config');
const { handleError, handleNotFound } = require('./middleware/errors');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const pageRoutes = require('./routes/pages');
const publicProfileRoutes = require('./routes/public-profiles');
const tmdbRoutes = require('./routes/tmdb');
const trackedMediaRoutes = require('./routes/tracked-media');

const app = express();

app.use(express.json());
app.use(pageRoutes);
app.use(express.static(config.FRONTEND_DIRECTORY, { index: false }));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tmdb', tmdbRoutes);
app.use('/api/tracked-media', trackedMediaRoutes);
app.use('/api/users', publicProfileRoutes);

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'watchtrack' });
});

app.use(handleNotFound);
app.use(handleError);

app.listen(config.PORT, () => {
  console.log(`WatchTrack listening on http://localhost:${config.PORT}`);
});
