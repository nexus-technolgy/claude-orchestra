import { Hono } from 'hono';
import claudeService from '../services/claude';
import config from '../config';

const health = new Hono();

health.get('/', async (c) => {
  const agents = await claudeService.listAgents();
  
  return c.json({
    status: 'healthy',
    version: '1.0.0',
    environment: config.NODE_ENV,
    activeAgents: agents.length,
    agents,
  });
});

health.get('/agents', async (c) => {
  const agents = await claudeService.listAgents();
  return c.json({ agents });
});

export default health;
