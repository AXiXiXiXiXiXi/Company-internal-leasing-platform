function requireString(
  config: Record<string, unknown>,
  key: string,
  minLength = 1,
): string {
  const value = config[key];
  if (typeof value !== 'string' || value.length < minLength) {
    throw new Error(`环境变量 ${key} 缺失或长度不足 ${minLength}`);
  }
  return value;
}

function optionalInteger(
  config: Record<string, unknown>,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = config[key];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`环境变量 ${key} 必须是 ${min}-${max} 的整数`);
  }
  return value;
}

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  if (config.NODE_ENV === 'test') {
    return config;
  }

  requireString(config, 'DB_HOST');
  requireString(config, 'DB_USERNAME');
  const databasePassword = requireString(config, 'DB_PASSWORD');
  if (databasePassword === 'change-me') {
    throw new Error('必须将 DB_PASSWORD 从示例值改成真实数据库密码');
  }
  requireString(config, 'DB_DATABASE');
  const jwtSecret = requireString(config, 'JWT_SECRET');
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET 至少需要 32 个字符');
  }
  if (jwtSecret.startsWith('replace-with-')) {
    throw new Error('必须将 JWT_SECRET 从示例值改成随机密钥');
  }
  optionalInteger(config, 'PORT', 3000, 1, 65535);
  optionalInteger(config, 'DB_PORT', 3306, 1, 65535);
  optionalInteger(config, 'JWT_EXPIRES_SECONDS', 28800, 60, 604800);
  return config;
}
