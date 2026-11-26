const app = require('./app');
const env = require('./config/env');

const server = app.listen(env.port, () => {
  console.log('=========================================');
  console.log('  ArtiFile API server is running');
  console.log(`  URL:         http://localhost:${env.port}`);
  console.log(`  Environment: ${env.nodeEnv}`);
  console.log(`  GSuite:      ${env.gsuiteDomain}`);
  console.log('=========================================');
});

process.on('unhandledRejection', (reason) => {
  console.error('[ArtiFile] Unhandled promise rejection:', reason);
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('[ArtiFile] Server shut down gracefully.');
    process.exit(0);
  });
});
