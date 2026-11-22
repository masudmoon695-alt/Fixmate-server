import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { connectDB, isDbConnected } from './config/db.js';
import { paymentsWebhook } from './controllers/payments.controller.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import routes from './routes/index.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

// Cookie options for cross-domain auth (sameSite none + secure required
// when the frontend and backend are on different domains).
const cookieOptions = {
  sameSite: 'none',
  secure: true,
  httpOnly: true,
  path: '/',
};

const configuredOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const allowedOrigins = new Set([
  'http://localhost:3000',
  ...configuredOrigins,
]);

const isLocalhost = (origin) => /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header (curl, Postman, server-to-server) are allowed.
      if (!origin || allowedOrigins.has(origin) || isLocalhost(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Lazy, cached MongoDB connection before every request. connectDB() reuses a
// global cached promise across warm serverless invocations and never crashes
// the request on failure (controllers throw 503 when the DB is required).
app.use(async (req, res, next) => {
  await connectDB().catch((error) => {
    console.error('[db] request-time connection failed:', error.message);
  });
  next();
});

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      database: isDbConnected() ? 'connected' : 'disconnected',
      uptime: Math.round(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
    },
  });
});

// Stripe needs the raw body: express.raw() only for this route, before
// express.json(). Production webhook URL:
// https://<backend-domain>/api/payments/webhook
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), paymentsWebhook);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
