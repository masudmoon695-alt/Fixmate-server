import 'dotenv/config';
import app from './src/app.js';
import { closeDB, connectDB } from './src/config/db.js';

const port = Number(process.env.PORT) || 5000;

const server = app.listen(port, () => {
  console.log(`[server] FixMate API listening on http://localhost:${port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[server] Port ${port} is already in use. Set a different PORT in .env.`);
    process.exit(1);
  }
  console.error('[server] Failed to start:', error);
  process.exit(1);
});

connectDB().catch((error) => {
  // The API stays up (health route + clean JSON errors) so the issue is visible.
  console.error('[db] initial connection failed:', error.message);
});

async function shutdown(signal) {
  console.log(`[server] ${signal} received, shutting down`);
  server.close(async () => {
    await closeDB().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[server] uncaught exception:', error);
});
