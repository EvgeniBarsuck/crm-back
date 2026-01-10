import { pgTable, bigint, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { customers } from './customers';
import { orders } from './orders';

export const merchants = pgTable('merchants', {
  id: bigint('id', { mode: 'number' }).primaryKey(), // Telegram ID
  username: text('username'),
  firstName: text('first_name'), // Новое поле
  languageCode: text('language_code'), // Новое поле
  currency: text('currency').default('₽').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const merchantsRelations = relations(merchants, ({ many }) => ({
  customers: many(customers),
  orders: many(orders),
}));
