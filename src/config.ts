import { z } from 'zod';

const configSchema = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  GITHUB_TOKEN: z.string().min(1),
  WORKSPACE_BASE: z.string().default(`${process.env.HOME}/claude-workspaces`),
  DOMAIN: z.string().optional(),
  RATE_LIMIT_WINDOW: z.string().default('60000'), // 1 minute
  RATE_LIMIT_MAX: z.string().default('10'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

type Config = z.infer<typeof configSchema>;

let config: Config | undefined;

export function loadConfig(): Config {
  if (config) return config;

  const parsed = configSchema.safeParse(process.env);

  if (!parsed.success) {
    // In test environment, don't exit - just throw
    if (process.env.NODE_ENV === 'test') {
      throw new Error('Configuration validation failed');
    }
    console.error('Configuration validation failed:');
    console.error(parsed.error.format());
    process.exit(1);
  }

  config = parsed.data;
  return config;
}

// Lazy load config - don't load until actually needed
const configProxy = new Proxy({} as Config, {
  get(target, prop) {
    if (!config) {
      loadConfig();
    }
    return config![prop as keyof Config];
  }
});

export default configProxy;
