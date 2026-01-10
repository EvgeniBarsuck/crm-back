import { pgTable, serial, bigint, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { merchants } from "./merchants";
import { orders } from "./orders";

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  merchantId: bigint("merchant_id", { mode: "number" }).references(
    () => merchants.id
  ),
  name: text("name").notNull(),
  phone: text("phone"),
  comment: text("comment"),
  telegramId: bigint("telegram_id", { mode: "number" }),
  inviteToken: text("invite_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const customersRelations = relations(customers, ({ many, one }) => ({
  orders: many(orders),
  merchant: one(merchants, {
    fields: [customers.merchantId],
    references: [merchants.id],
  }),
}));
