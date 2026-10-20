import { existsSync } from 'node:fs';
import path from 'node:path';

const rootEnv = path.resolve(__dirname, '../../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
process.env.NODE_ENV = 'test';
