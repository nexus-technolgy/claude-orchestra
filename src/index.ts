import { Hono } from 'hono';
import { logger as honoLogger } from 'hono/logger';
import { cors } from 'hono/cors';
import { rateLimiter } from 'hono-rate-limiter';
import config from './config';
import logger from './utils/logger';
import webhook from './routes/webhook';
import health from './routes/health';

const app = new Hono();

// Middleware
app.use('*', honoLogger());
app.use('*', cors());

// Rate limiting
app.use(
  '/webhook',
  rateLimiter({
    windowMs: parseInt(config.RATE_LIMIT_WINDOW),
    limit: parseInt(config.RATE_LIMIT_MAX),
    standardHeaders: 'draft-6',
    keyGenerator: (c) => c.req.header('x-forwarded-for') || 'unknown',
  })
);

// Routes
app.route('/webhook', webhook);
app.route('/health', health);

// Root
app.get('/', (c) => {
  return c.json({
    service: 'Claude GitHub Webhook',
    version: '1.0.0',
    status: 'running',
  });
});

// Start server
const port = parseInt(config.PORT);

logger.info('Starting server', {
  port,
  environment: config.NODE_ENV,
  workspaceBase: config.WORKSPACE_BASE,
});

export default {
  port,
  fetch: app.fetch,
};
