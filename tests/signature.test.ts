import { describe, it, expect, beforeAll } from 'vitest';
import { verifyGitHubSignature } from '../src/utils/signature';

describe('GitHub Signature Verification', () => {
  const payload = JSON.stringify({ test: 'data' });

  beforeAll(() => {
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.GITHUB_TOKEN = 'test-token';
  });

  it('should verify valid signature', async () => {
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

    const signature = 'sha256=' + Buffer.from(signed).toString('hex');
    
    const result = await verifyGitHubSignature(payload, signature);
    expect(result).toBe(true);
  });

  it('should reject invalid signature', async () => {
    const result = await verifyGitHubSignature(payload, 'sha256=invalid');
    expect(result).toBe(false);
  });

  it('should reject missing signature', async () => {
    const result = await verifyGitHubSignature(payload, undefined);
    expect(result).toBe(false);
  });
});
