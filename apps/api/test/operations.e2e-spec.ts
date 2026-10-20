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

describe('operations (e2e)', () => {
  let app: INestApplication;
  let f: Fixture;
  const tokens: Record<string, string> = {};

  const as = (who: string) => ({
    get: (path: string) =>
      request(app.getHttpServer())
        .get(`/api/v1${path}`)
        .set('authorization', `Bearer ${tokens[who]}`),
    post: (path: string, body: object) =>
      request(app.getHttpServer())
        .post(`/api/v1${path}`)
        .set('authorization', `Bearer ${tokens[who]}`)
        .send(body),
    patch: (path: string, body: object) =>
      request(app.getHttpServer())
        .patch(`/api/v1${path}`)
        .set('authorization', `Bearer ${tokens[who]}`)
        .send(body),
  });
  const newWorkOrder = {
    type: 'reactive',
    trade: 'HVAC',
    title: 'AHU tripping near food court',
    priority: 'high',
    source: 'help_desk',
  };

  beforeAll(async () => {
    f = await createFixture(
      ['A1', 'A2'],
      [
        { key: 'admin', role: Role.PortfolioAdmin, mall: null },
        { key: 'tech', role: Role.Technician, mall: 'A1' },
        { key: 'viewer', role: Role.Viewer, mall: 'A1' },
      ],
    );
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, app.get<AppConfig>(APP_CONFIG));
    await app.init();
    for (const who of ['admin', 'tech', 'viewer']) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: f.emails[who], password: PASSWORD })
        .expect(200);
      tokens[who] = res.body.accessToken;
    }
  });

  afterAll(async () => {
    await app?.close();
    await f?.cleanup();
  });

  it('lets a technician raise, start and close a work order in their mall', async () => {
    const mall = f.mallIds.A1!;
    const created = await as('tech').post(`/malls/${mall}/work-orders`, newWorkOrder).expect(201);
    expect(created.body).toMatchObject({
      status: 'open',
      priority: 'high',
      slaHours: 8,
      breached: false,
    });
    expect(created.body.code).toMatch(/^WO\d{7}$/);
    expect(created.body.allowedTransitions).toContain('in_progress');

    const id = created.body.id;
    const started = await as('tech')
      .patch(`/malls/${mall}/work-orders/${id}/status`, { status: 'in_progress' })
      .expect(200);
    expect(started.body.respondedAt).not.toBeNull();

    const closed = await as('tech')
      .patch(`/malls/${mall}/work-orders/${id}/status`, { status: 'closed', labourCostInr: 1500 })
      .expect(200);
    expect(closed.body).toMatchObject({
      status: 'closed',
      labourCostInr: '1500.00',
      allowedTransitions: [],
    });

    await as('tech')
      .patch(`/malls/${mall}/work-orders/${id}/status`, { status: 'open' })
      .expect(400);

    const list = await as('tech').get(`/malls/${mall}/work-orders?status=closed`).expect(200);
    expect(list.body.items.map((w: { id: string }) => w.id)).toContain(id);
  });

  it('keeps work orders inside the mall the caller is assigned to', async () => {
    await as('tech').post(`/malls/${f.mallIds.A2}/work-orders`, newWorkOrder).expect(403);
    await as('tech').get(`/malls/${f.mallIds.A2}/work-orders`).expect(403);
    await as('viewer').post(`/malls/${f.mallIds.A1}/work-orders`, newWorkOrder).expect(403);
    await as('viewer').get(`/malls/${f.mallIds.A1}/work-orders`).expect(200);
  });

  it('cannot reach a work order through another mall’s URL', async () => {
    const created = await as('admin')
      .post(`/malls/${f.mallIds.A2}/work-orders`, newWorkOrder)
      .expect(201);
    await as('admin').get(`/malls/${f.mallIds.A1}/work-orders/${created.body.id}`).expect(404);
  });

  it('validates new work orders', async () => {
    const mall = f.mallIds.A1!;
    await as('tech')
      .post(`/malls/${mall}/work-orders`, { ...newWorkOrder, priority: 'urgent' })
      .expect(400);
    await as('tech')
      .post(`/malls/${mall}/work-orders`, { ...newWorkOrder, type: 'tenant_request' })
      .expect(400);
    const res = await as('tech')
      .post(`/malls/${mall}/work-orders`, { ...newWorkOrder, assetCode: 'NOPE-1' })
      .expect(400);
    expect(res.body.message).toBe('No asset NOPE-1 in this mall');
  });

  it('serves the dashboard, portfolio and registers', async () => {
    const mall = f.mallIds.A1!;
    const dash = await as('tech').get(`/malls/${mall}/dashboard`).expect(200);
    expect(dash.body.mall.code).toBe('A1');
    expect(dash.body.workOrders.active).toBeGreaterThanOrEqual(0);

    const portfolio = await as('tech').get('/portfolio').expect(200);
    expect(portfolio.body.map((m: { code: string }) => m.code)).toEqual(['A1']);
    const all = await as('admin').get('/portfolio').expect(200);
    expect(all.body.map((m: { code: string }) => m.code)).toEqual(['A1', 'A2']);

    for (const path of ['assets', 'maintenance?window=overdue']) {
      await as('tech').get(`/malls/${mall}/${path}`).expect(200);
    }
    // Technicians work on assets, not on licences or security incidents.
    for (const path of ['compliance', 'incidents']) {
      await as('tech').get(`/malls/${mall}/${path}`).expect(403);
      await as('viewer').get(`/malls/${mall}/${path}`).expect(200);
    }
  });
});
