import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'default-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  dbPath: process.env.DB_PATH || './data/platform.db',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10)
  },
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  staticDir: process.env.STATIC_DIR || './public',
  nodeEnv: process.env.NODE_ENV || 'development',
  simulation: {
    defaultTemperature: 300.0,
    defaultSaltConcentration: 0.15,
    defaultRmsdThreshold: 2.0,
    maxRetries: 3,
    deviationThreshold: 1.0,
    maxConsecutiveDeviations: 3
  },
  monitoring: {
    rmsdWarningThreshold: 1.5,
    rmsdCriticalThreshold: 2.0,
    energyJumpThreshold: 100.0,
    temperatureVarianceThreshold: 5.0,
    checkIntervalMs: 1000
  }
};
