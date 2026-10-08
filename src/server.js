const config = require('./config');
const app = require('./app');
const db = require('./db');

async function start() {
  await db.raw('select 1'); // fail fast if the database is unreachable
  const server = app.listen(config.port, () => console.log(`Server running on http://localhost:${config.port} (${config.env})`));

  const shutdown = async () => {
    server.close(async () => {
      await db.destroy();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
