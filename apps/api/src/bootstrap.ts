import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import type { AppConfig } from './config';

/** HTTP hardening shared by main.ts and the e2e tests. */
export function configureApp(app: INestApplication, config: AppConfig) {
  app.use(helmet());
  app.enableCors({ origin: config.CORS_ORIGINS, credentials: true });
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.enableShutdownHooks();
}
