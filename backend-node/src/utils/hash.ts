import crypto from 'crypto';

export function verifyDjangoPassword(password: string, encoded: string): boolean {
  // Format: algorithm$iterations$salt$hash
  const parts = encoded.split('$');
  if (parts.length !== 4) return false;
  
  const [algorithm, iterationsStr, salt, hash] = parts;
  
  if (algorithm !== 'pbkdf2_sha256') {
    console.warn(`Unsupported algorithm: ${algorithm}`);
    return false;
  }
  
  const iterations = parseInt(iterationsStr, 10);
  const keyLength = Buffer.from(hash, 'base64').length;
  
  try {
    const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha256');
    const derivedKeyBase64 = derivedKey.toString('base64');
    return derivedKeyBase64 === hash;
  } catch (error) {
    return false;
  }
}

export function hashDjangoPassword(password: string): string {
  const salt = crypto.randomBytes(12).toString('base64');
  const iterations = 390000;
  const keyLength = 32;
  const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha256');
  const hash = derivedKey.toString('base64');
  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
}
