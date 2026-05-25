import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getDb, closeDb } from './db';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { cleanupExpiredBlacklist } from './session-repository';

const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

let cleanupTimer: NodeJS.Timeout | null = null;

const server = app.listen(PORT, () => {
  getDb();
  console.log(`[${NODE_ENV}] Auth API server listening on port ${PORT}`);

  cleanupTimer = setInterval(() => {
    try {
      const count = cleanupExpiredBlacklist();
      if (count > 0) {
        console.log(`Cleaned up ${count} expired blacklist entries`);
      }
    } catch (err) {
      console.error('Blacklist cleanup failed:', err);
    }
  }, 60 * 60 * 1000);
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down...`);
  if (cleanupTimer) clearInterval(cleanupTimer);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { app };
