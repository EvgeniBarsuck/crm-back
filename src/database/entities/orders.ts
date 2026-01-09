import { pgTable, serial, bigint, integer, numeric, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { merchants } from './merchants';
import { customers } from './customers';

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  merchantId: bigint('merchant_id', { mode: 'number' }).references(() => merchants.id),
  customerId: integer('customer_id').references(() => customers.id),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  status: text('status').default('new'), // new, done, cancelled
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const ordersRelations = relations(orders, ({ one }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  merchant: one(merchants, {
    fields: [orders.merchantId],
    references: [merchants.id],
  }),
}));
