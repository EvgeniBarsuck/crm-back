import { orders } from "../database";
import { telegramAuth } from "../middleware/auth";
import { Express } from "express";
import { and, eq, gte, ne, sql } from "drizzle-orm";
import { db } from "../database";

export const setupAnalyticsApi = (app: Express) => {
  app.get("/api/analytics", telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    const now = new Date();

    // Начало сегодняшнего дня (00:00)
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    // Начало текущего месяца (1 число)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    try {
      // 1. Выручка СЕГОДНЯ (сумма active + completed, исключая cancelled)
      const [todayRes] = await db
        .select({
          sum: sql<string>`sum(${orders.totalAmount})`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.merchantId, merchantId),
            gte(orders.createdAt, startOfDay),
            ne(orders.status, "cancelled")
          )
        );

      // 2. Выручка ЗА МЕСЯЦ
      const [monthRes] = await db
        .select({
          sum: sql<string>`sum(${orders.totalAmount})`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.merchantId, merchantId),
            gte(orders.createdAt, startOfMonth),
            ne(orders.status, "cancelled")
          )
        );

      res.json({
        today: Number(todayRes?.sum || 0),
        month: Number(monthRes?.sum || 0),
      });
    } catch (e) {
      console.error("Analytics error:", e);
      res.status(500).json({ error: "Server error" });
    }
  });
};
