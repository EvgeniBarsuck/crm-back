import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './entities';
import 'dotenv/config';

console.log('🔧 DB Connection Config:', {
  user: process.env.POSTGRES_USER || 'postgres (default)',
  host: process.env.POSTGRES_HOST || 'localhost (default)',
  db: process.env.POSTGRES_DB || 'crm (default)',
  port: process.env.POSTGRES_PORT || '5432 (default)',
});

export const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'crm',
});

export const db = drizzle(pool, { schema });
