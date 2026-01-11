import { pgTable, bigint, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { merchants } from './merchants';

export const subscriptions = pgTable('subscriptions', {
  id: bigint('id', { mode: 'number' }).primaryKey().notNull(),
  merchantId: bigint('merchant_id', { mode: 'number' }).notNull().references(() => merchants.id),
  
  // Тариф: free, pro, premium
  plan: text('plan').notNull().default('free'),
  
  // Статус: active, expired, cancelled
  status: text('status').notNull().default('active'),
  
  // Даты
  startDate: timestamp('start_date', { withTimezone: true }).notNull().defaultNow(),
  endDate: timestamp('end_date', { withTimezone: true }), // null = бессрочно (для free)
  
  // Для триала
  isTrialUsed: boolean('is_trial_used').default(false),
  
  // История платежей
  lastPaymentId: text('last_payment_id'),
  lastPaymentDate: timestamp('last_payment_date', { withTimezone: true }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  merchant: one(merchants, {
    fields: [subscriptions.merchantId],
    references: [merchants.id],
  }),
}));
