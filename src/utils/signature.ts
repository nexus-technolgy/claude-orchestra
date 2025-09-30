import config from '../config';
import logger from './logger';

export async function verifyGitHubSignature(
  payload: string,
  signature: string | undefined
): Promise<boolean> {
  if (!signature) {
    logger.warn('No signature provided in request');
    return false;
  }

  const secret = config.GITHUB_WEBHOOK_SECRET;
  
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signed = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );

    const expectedSignature = 'sha256=' + Buffer.from(signed).toString('hex');
    
    return signature === expectedSignature;
  } catch (error) {
    logger.error('Signature verification failed', { error });
    return false;
  }
}
