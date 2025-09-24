/**
 * Utility functions for handling secrets and redaction
 */

const SECRET_PATTERNS = [
  // Common secret patterns to redact from logs
  /(password|passwd|pwd|secret|key|token|auth|api[_-]?key|bearer)\s*[:=]\s*["']?([^\s"']+)["']?/gi,
  /(authorization|x-api-key|x-auth-token):\s*["']?([^\s"']+)["']?/gi,
  // AWS patterns
  /AKIA[0-9A-Z]{16}/g,
  /[A-Za-z0-9/+=]{40}/g, // AWS secret access key pattern
  // JWT tokens
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  // Generic base64 encoded secrets (longer than 20 chars)
  /[A-Za-z0-9+/]{20,}={0,2}/g,
];

export function redactSecrets(text: string): string {
  let redacted = text;
  
  SECRET_PATTERNS.forEach(pattern => {
    redacted = redacted.replace(pattern, (match, ...groups) => {
      if (groups.length >= 2) {
        // Pattern with capture groups (key=value format)
        return match.replace(groups[1], '[REDACTED]');
      } else {
        // Direct pattern match
        return '[REDACTED]';
      }
    });
  });
  
  return redacted;
}

export function isSecretKey(key: string): boolean {
  const secretKeys = [
    'password', 'passwd', 'pwd', 'secret', 'key', 'token', 'auth',
    'apikey', 'api_key', 'bearer', 'authorization', 'x-api-key', 'x-auth-token'
  ];
  
  return secretKeys.some(secretKey => 
    key.toLowerCase().includes(secretKey.toLowerCase())
  );
}

export function redactObjectSecrets(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(redactObjectSecrets);
  }
  
  const redacted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSecretKey(key)) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      redacted[key] = redactSecrets(value);
    } else {
      redacted[key] = redactObjectSecrets(value);
    }
  }
  
  return redacted;
}
