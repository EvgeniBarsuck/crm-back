import { pgTable, bigint, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { customers } from './customers';
import { orders } from './orders';
import { products } from './products';

export const merchants = pgTable('merchants', {
  id: bigint('id', { mode: 'number' }).primaryKey(), // Telegram ID
  username: text('username'),
  firstName: text('first_name'), // Новое поле
  languageCode: text('language_code'), // Новое поле
  currency: text('currency').default('₽').notNull(),
  tplInProgress: text('tpl_in_progress'), // "Ваш заказ {id} принят..."
  tplCompleted: text('tpl_completed'),    // "Заказ готов!..."
  tplCancelled: text('tpl_cancelled'),    // "Заказ отменен..."
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const merchantsRelations = relations(merchants, ({ many }) => ({
  customers: many(customers),
  orders: many(orders),
  products: many(products),
}));
