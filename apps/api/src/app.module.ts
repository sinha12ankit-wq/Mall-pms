import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionsGuard } from './auth/permissions.guard';
import { APP_CONFIG, type AppConfig } from './config';
import { ConfigModule } from './config.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { MallsModule } from './malls/malls.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        throttlers: [{ ttl: 60_000, limit: 300 }],
        // The e2e suite logs in many times from one address.
        skipIf: () => config.NODE_ENV === 'test',
      }),
    }),
    AuthModule,
    MallsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global guards run in this order: rate limit, authenticate, authorise.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
