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
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    try {
      // 1. СЕГОДНЯ (Только completed)
      const [todayRes] = await db
        .select({
          sum: sql<string>`sum(${orders.totalAmount})`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.merchantId, merchantId),
            gte(orders.createdAt, startOfDay),
            eq(orders.status, "completed") // 👈 БЫЛО: ne('cancelled'), СТАЛО: eq('completed')
          )
        );

      // 2. МЕСЯЦ (Только completed)
      const [monthRes] = await db
        .select({
          sum: sql<string>`sum(${orders.totalAmount})`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.merchantId, merchantId),
            gte(orders.createdAt, startOfMonth),
            eq(orders.status, "completed") // 👈 Только завершенные
          )
        );

      res.json({
        today: Number(todayRes?.sum || 0),
        month: Number(monthRes?.sum || 0),
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });
};
