import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  schemaFilter: ['core', 'space', 'ops'],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://mallpms:mallpms@localhost:5432/mallpms',
  },
});
