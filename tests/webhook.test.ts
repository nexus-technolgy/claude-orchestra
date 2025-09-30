import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import webhook from '../src/routes/webhook';

describe('Webhook Routes', () => {
  let app: Hono;

  beforeAll(() => {
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.GITHUB_TOKEN = 'test-token';
    
    app = new Hono();
    app.route('/webhook', webhook);
  });

  async function createSignature(payload: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode('test-secret'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signed = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );

    return 'sha256=' + Buffer.from(signed).toString('hex');
  }

  it('should reject request without signature', async () => {
    const res = await app.request('/webhook', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(401);
  });

  it('should accept valid webhook with signature', async () => {
    const payload = JSON.stringify({
      action: 'created',
      issue: {
        number: 1,
        body: '@claude test instruction',
      },
      repository: {
        full_name: 'test/repo',
        clone_url: 'https://github.com/test/repo.git',
      },
      sender: {
        login: 'testuser',
      },
    });

    const signature = await createSignature(payload);

    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'x-hub-signature-256': signature,
        'x-github-event': 'issue_comment',
      },
      body: payload,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBeDefined();
  });
});
