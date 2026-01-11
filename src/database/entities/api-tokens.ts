import { pgTable, serial, bigint, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { merchants } from './merchants';

export const apiTokens = pgTable('api_tokens', {
  id: serial('id').primaryKey(),
  merchantId: bigint('merchant_id', { mode: 'number' }).notNull().references(() => merchants.id),
  token: text('token').notNull().unique(), // API ключ
  name: text('name').notNull(), // Название для идентификации
  isActive: boolean('is_active').default(true),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
  merchant: one(merchants, {
    fields: [apiTokens.merchantId],
    references: [merchants.id],
  }),
}));
