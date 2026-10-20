import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@mall-pms/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { APP_CONFIG, type AppConfig } from '../src/config';
import { createFixture, type Fixture, PASSWORD } from './fixtures';

describe('auth and mall access (e2e)', () => {
  let app: INestApplication;
  let a: Fixture;
  let b: Fixture;

  const login = async (email: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return res.body as { accessToken: string; refreshToken: string };
  };
  const get = (path: string, token: string) =>
    request(app.getHttpServer()).get(path).set('authorization', `Bearer ${token}`);

  beforeAll(async () => {
    a = await createFixture(
      ['A1', 'A2'],
      [
        { key: 'admin', role: Role.PortfolioAdmin, mall: null },
        { key: 'tech', role: Role.Technician, mall: 'A1' },
        { key: 'gone', role: Role.Viewer, mall: 'A1', active: false },
      ],
    );
    b = await createFixture(['B1'], [{ key: 'admin', role: Role.PortfolioAdmin, mall: null }]);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, app.get<AppConfig>(APP_CONFIG));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await a?.cleanup();
    await b?.cleanup();
  });

  it('reports health without a token', async () => {
    await request(app.getHttpServer()).get('/health').expect(200, { status: 'ok', database: 'up' });
  });

  it('rejects a wrong password, an unknown email and an inactive user the same way', async () => {
    for (const body of [
      { email: a.emails.tech, password: 'wrong-password' },
      { email: 'nobody@test.mallpms.in', password: PASSWORD },
      { email: a.emails.gone, password: PASSWORD },
    ]) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(body)
        .expect(401);
      expect(res.body.message).toBe('Invalid email or password');
    }
  });

  it('validates the login body', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'x' }).expect(400);
  });

  it('accepts emails in any case', async () => {
    await login(a.emails.tech!.toUpperCase());
  });

  it('requires a valid token', async () => {
    await request(app.getHttpServer()).get('/api/v1/malls').expect(401);
    await get('/api/v1/malls', 'not-a-token').expect(401);
  });

  it('returns the current user with their roles', async () => {
    const { accessToken } = await login(a.emails.tech!);
    const res = await get('/api/v1/auth/me', accessToken).expect(200);
    expect(res.body.roles).toEqual([{ role: 'technician', mallId: a.mallIds.A1, mallCode: 'A1' }]);
  });

  it('limits a mall-scoped user to their mall', async () => {
    const { accessToken } = await login(a.emails.tech!);
    const list = await get('/api/v1/malls', accessToken).expect(200);
    expect(list.body.map((m: { code: string }) => m.code)).toEqual(['A1']);
    await get(`/api/v1/malls/${a.mallIds.A1}`, accessToken).expect(200);
    await get(`/api/v1/malls/${a.mallIds.A2}`, accessToken).expect(403);
  });

  it('lets a portfolio admin see every mall in their organisation only', async () => {
    const { accessToken } = await login(a.emails.admin!);
    const list = await get('/api/v1/malls', accessToken).expect(200);
    expect(list.body.map((m: { code: string }) => m.code)).toEqual(['A1', 'A2']);
    // Another organisation's mall is hidden by row-level security.
    await get(`/api/v1/malls/${b.mallIds.B1}`, accessToken).expect(404);
  });

  it('rotates refresh tokens and revokes the family when one is reused', async () => {
    const first = await login(a.emails.tech!);
    const server = app.getHttpServer();

    const second = await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);
    expect(second.body.refreshToken).not.toBe(first.refreshToken);
    await get('/api/v1/auth/me', second.body.accessToken).expect(200);

    // Replaying the old token looks like theft: it fails and kills the newer one too.
    await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(401);
    await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: second.body.refreshToken })
      .expect(401);
  });

  it('revokes the session on logout', async () => {
    const { refreshToken } = await login(a.emails.tech!);
    const server = app.getHttpServer();
    await request(server).post('/api/v1/auth/logout').send({ refreshToken }).expect(204);
    await request(server).post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);
  });
});
