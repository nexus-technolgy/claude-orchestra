import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import webhook from '../src/routes/webhook';
import githubService from '../src/services/github';
import claudeService from '../src/services/claude';

describe('Webhook Routes', () => {
  let app: Hono;

  beforeAll(() => {
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.GITHUB_TOKEN = 'test-token';

    app = new Hono();
    app.route('/webhook', webhook);
  });

  beforeEach(() => {
    // Mock spawnAgent to prevent actual agent spawning in tests
    vi.spyOn(claudeService, 'spawnAgent').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
        user: {
          login: 'testuser',
        },
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

    // Mock permission check to return trusted user
    vi.spyOn(githubService, 'checkUserPermission').mockResolvedValue({
      permission: 'write',
      role_name: 'write',
      isTrusted: true,
    });

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

  it('should request review for untrusted sender', async () => {
    const payload = JSON.stringify({
      action: 'created',
      issue: {
        number: 2,
        body: 'Original issue body',
        user: {
          login: 'issue-creator',
        },
      },
      comment: {
        body: '@claude malicious instruction',
        user: {
          login: 'unknown-user',
        },
      },
      repository: {
        full_name: 'test/repo',
        clone_url: 'https://github.com/test/repo.git',
      },
      sender: {
        login: 'unknown-user',
      },
    });

    const signature = await createSignature(payload);

    // Mock permission check to return untrusted user
    vi.spyOn(githubService, 'checkUserPermission').mockResolvedValue({
      permission: 'none',
      role_name: 'none',
      isTrusted: false,
    });

    // Mock comment and label methods
    const postCommentSpy = vi.spyOn(githubService, 'postComment').mockResolvedValue();
    const addLabelSpy = vi.spyOn(githubService, 'addPendingReviewLabel').mockResolvedValue();

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
    expect(json.status).toBe('pending_review');
    expect(json.sender).toBe('unknown-user');
    expect(json.permission).toBe('none');

    // Verify comment and label were added
    expect(postCommentSpy).toHaveBeenCalledWith(
      'test/repo',
      2,
      expect.stringContaining('requires manual review')
    );
    expect(addLabelSpy).toHaveBeenCalledWith('test/repo', 2);
  });

  it('should allow trusted user to approve pending request', async () => {
    const payload = JSON.stringify({
      action: 'created',
      issue: {
        number: 3,
        body: 'Original issue body with @claude instruction',
        user: {
          login: 'original-user',
        },
      },
      comment: {
        body: '@claude approve',
        user: {
          login: 'maintainer',
        },
      },
      repository: {
        full_name: 'test/repo',
        clone_url: 'https://github.com/test/repo.git',
      },
      sender: {
        login: 'maintainer',
      },
    });

    const signature = await createSignature(payload);

    // Mock permission check for approver (trusted)
    vi.spyOn(githubService, 'checkUserPermission').mockResolvedValue({
      permission: 'admin',
      role_name: 'admin',
      isTrusted: true,
    });

    // Mock getting original issue body
    vi.spyOn(githubService, 'getOriginalIssueBody').mockResolvedValue(
      '@claude do something'
    );

    // Mock comment and label methods
    const postCommentSpy = vi.spyOn(githubService, 'postComment').mockResolvedValue();
    const removeLabelSpy = vi.spyOn(githubService, 'removePendingReviewLabel').mockResolvedValue();

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
    expect(json.status).toBe('approved_and_spawned');
    expect(json.approver).toBe('maintainer');

    // Verify label was removed and approval comment posted
    expect(removeLabelSpy).toHaveBeenCalledWith('test/repo', 3);
    expect(postCommentSpy).toHaveBeenCalledWith(
      'test/repo',
      3,
      expect.stringContaining('Approved by @maintainer')
    );
  });

  it('should deny approval from untrusted user', async () => {
    const payload = JSON.stringify({
      action: 'created',
      issue: {
        number: 4,
        body: 'Original issue',
        user: {
          login: 'original-user',
        },
      },
      comment: {
        body: '@claude approve',
        user: {
          login: 'untrusted-user',
        },
      },
      repository: {
        full_name: 'test/repo',
        clone_url: 'https://github.com/test/repo.git',
      },
      sender: {
        login: 'untrusted-user',
      },
    });

    const signature = await createSignature(payload);

    // Mock permission check for approver (untrusted)
    vi.spyOn(githubService, 'checkUserPermission').mockResolvedValue({
      permission: 'none',
      role_name: 'none',
      isTrusted: false,
    });

    const postCommentSpy = vi.spyOn(githubService, 'postComment').mockResolvedValue();

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
    expect(json.status).toBe('approval_denied');
    expect(json.approver).toBe('untrusted-user');

    // Verify denial comment was posted
    expect(postCommentSpy).toHaveBeenCalledWith(
      'test/repo',
      4,
      expect.stringContaining("don't have permission to approve")
    );
  });
});
