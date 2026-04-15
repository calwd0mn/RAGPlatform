export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (secret && secret.trim().length > 0 && secret !== 'change-this-secret') {
    return secret;
  }

  if (process.env.NODE_ENV === 'test') {
    return 'test-jwt-secret';
  }

  throw new Error('JWT_SECRET must be set to a strong non-default value.');
}

export function getJwtExpiresInSeconds(): number {
  const rawValue = process.env.JWT_EXPIRES_IN_SECONDS;
  if (!rawValue) {
    return 604800;
  }

  const parsedValue = Number(rawValue);
  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  return 604800;
}
