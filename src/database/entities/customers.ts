import { pgTable, serial, bigint, text, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants';

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  merchantId: bigint('merchant_id', { mode: 'number' }).references(() => merchants.id),
  name: text('name').notNull(),
  phone: text('phone'),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
