import { pgTable, bigint, text, timestamp } from 'drizzle-orm/pg-core';

export const merchants = pgTable('merchants', {
  id: bigint('id', { mode: 'number' }).primaryKey(), // Telegram ID
  username: text('username'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
