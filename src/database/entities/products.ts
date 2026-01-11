import { pgTable, serial, bigint, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { merchants } from './merchants';

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => merchants.id), // Привязка к мерчанту
  name: text('name').notNull(), // Название: "Торт Наполеон"
  price: integer('price').default(0), // Цена по умолчанию
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const productsRelations = relations(products, ({ one }) => ({
  merchant: one(merchants, {
    fields: [products.userId],
    references: [merchants.id],
  }),
}));
