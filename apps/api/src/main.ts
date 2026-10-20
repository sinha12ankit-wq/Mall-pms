import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { APP_CONFIG, type AppConfig } from './config';

// Local development reads the repo-root .env; deployments set real env vars.
const rootEnv = path.resolve(__dirname, '../../../.env');
if (process.env.NODE_ENV !== 'production' && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<AppConfig>(APP_CONFIG);
  configureApp(app, config);
  await app.listen(config.API_PORT);
}

void bootstrap();
