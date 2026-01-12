import { orders, customers, products } from "../database";
import { telegramAuth } from "../middleware/auth";
import { Express } from "express";
import { and, eq, gte, lte, sql, desc } from "drizzle-orm";
import { db } from "../database";

export const setupAnalyticsApi = (app: Express) => {
  // 1. Общая статистика (базовая)
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
          count: sql<number>`count(*)`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.merchantId, merchantId),
            gte(orders.createdAt, startOfDay),
            eq(orders.status, "completed")
          )
        );

      // 2. МЕСЯЦ (Только completed)
      const [monthRes] = await db
        .select({
          sum: sql<string>`sum(${orders.totalAmount})`,
          count: sql<number>`count(*)`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.merchantId, merchantId),
            gte(orders.createdAt, startOfMonth),
            eq(orders.status, "completed")
          )
        );

      // 3. Средний чек за месяц
      const monthSum = Number(monthRes?.sum || 0);
      const monthCount = Number(monthRes?.count || 0);
      const avgCheck = monthCount > 0 ? monthSum / monthCount : 0;

      // 4. Всего клиентов
      const [customersCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(eq(customers.merchantId, merchantId));

      res.json({
        today: Number(todayRes?.sum || 0),
        todayCount: Number(todayRes?.count || 0),
        month: monthSum,
        monthCount: monthCount,
        avgCheck: Math.round(avgCheck),
        customersCount: Number(customersCount?.count || 0),
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  // 2. График продаж по дням (последние 30 дней)
  app.get("/api/analytics/sales-chart", telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    const days = Number(req.query.days) || 30; // По умолчанию 30 дней
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    try {
      const salesByDay = await db
        .select({
          date: sql<string>`DATE(${orders.createdAt})`,
          sum: sql<string>`sum(${orders.totalAmount})`,
          count: sql<number>`count(*)`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.merchantId, merchantId),
            gte(orders.createdAt, startDate),
            eq(orders.status, "completed")
          )
        )
        .groupBy(sql`DATE(${orders.createdAt})`)
        .orderBy(sql`DATE(${orders.createdAt})`);

      // Создаем карту существующих данных
      const dataMap = new Map(
        salesByDay.map(row => [row.date, { sum: Number(row.sum || 0), count: Number(row.count || 0) }])
      );

      // Заполняем все дни (даже с нулями)
      const result = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        result.push({
          date: dateStr,
          sum: dataMap.get(dateStr)?.sum || 0,
          count: dataMap.get(dateStr)?.count || 0,
        });
      }

      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  // 3. Топ-5 товаров/услуг по количеству продаж
  app.get("/api/analytics/top-products", telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;

    try {
      // Извлекаем название товара из комментария заказа
      // Предполагаем, что в комментарии есть название товара
      const topProducts = await db
        .select({
          product: orders.comment,
          count: sql<number>`count(*)`,
          sum: sql<string>`sum(${orders.totalAmount})`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.merchantId, merchantId),
            eq(orders.status, "completed")
          )
        )
        .groupBy(orders.comment)
        .orderBy(desc(sql`count(*)`))
        .limit(5);

      res.json(topProducts.map(row => ({
        name: row.product || 'Без названия',
        count: Number(row.count || 0),
        sum: Number(row.sum || 0),
      })));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  // 4. Топ-5 клиентов по сумме заказов
  app.get("/api/analytics/top-customers", telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;

    try {
      const topCustomers = await db
        .select({
          customerId: orders.customerId,
          customerName: customers.name,
          customerPhone: customers.phone,
          count: sql<number>`count(*)`,
          sum: sql<string>`sum(${orders.totalAmount})`,
        })
        .from(orders)
        .innerJoin(customers, eq(orders.customerId, customers.id))
        .where(
          and(
            eq(orders.merchantId, merchantId),
            eq(orders.status, "completed")
          )
        )
        .groupBy(orders.customerId, customers.name, customers.phone)
        .orderBy(desc(sql`sum(${orders.totalAmount})`))
        .limit(5);

      res.json(topCustomers.map(row => ({
        id: row.customerId,
        name: row.customerName || 'Без имени',
        phone: row.customerPhone || '-',
        ordersCount: Number(row.count || 0),
        totalSum: Number(row.sum || 0),
      })));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  // 5. Конверсия статусов
  app.get("/api/analytics/conversion", telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;

    try {
      const statusStats = await db
        .select({
          status: orders.status,
          count: sql<number>`count(*)`,
        })
        .from(orders)
        .where(eq(orders.merchantId, merchantId))
        .groupBy(orders.status);

      const total = statusStats.reduce((sum, s) => sum + Number(s.count), 0);
      const stats = statusStats.map(s => ({
        status: s.status || 'unknown',
        count: Number(s.count || 0),
        percentage: total > 0 ? Math.round((Number(s.count) / total) * 100) : 0,
      }));

      res.json({
        total,
        stats,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });
};
