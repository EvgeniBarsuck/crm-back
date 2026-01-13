import { Express } from "express";
import { telegramAuth } from "../middleware/auth";
import { db } from "../database/db";
import { customers, orders, merchants } from "../database/entities";
import { eq, sql, desc, and } from "drizzle-orm";
import { Telegraf } from "telegraf";
import { SubscriptionService } from "../subscription/subscription.service";
import { getTranslator } from "../i18n";

export const setupBroadcastApi = (app: Express, bot: Telegraf) => {
  // POST /api/broadcast/send - Отправить рассылку
  app.post("/api/broadcast/send", telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    const { message, segment } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Получаем язык мерчанта для локализации
    const [merchant] = await db.select().from(merchants).where(eq(merchants.id, merchantId));
    const t = getTranslator(merchant?.language || 'ru');

    // Проверяем доступ к фиче notifications (PRO или PREMIUM)
    const hasAccess = await SubscriptionService.hasAccess(merchantId, 'notifications');
    if (!hasAccess) {
      return res.status(403).json({ 
        error: t('broadcast.subscription_required')
      });
    }

    try {
      // Получаем список клиентов по сегменту
      let targetCustomers;

      if (segment === 'all') {
        // Все клиенты с Telegram ID
        targetCustomers = await db
          .select()
          .from(customers)
          .where(
            and(
              eq(customers.merchantId, merchantId),
              sql`${customers.telegramId} IS NOT NULL`
            )
          );
      } else if (segment === 'vip') {
        // VIP клиенты (сумма заказов > 10000)
        targetCustomers = await db
          .select({
            id: customers.id,
            name: customers.name,
            phone: customers.phone,
            telegramId: customers.telegramId,
            merchantId: customers.merchantId,
            inviteToken: customers.inviteToken,
            createdAt: customers.createdAt,
          })
          .from(customers)
          .innerJoin(orders, eq(orders.customerId, customers.id))
          .where(
            and(
              eq(customers.merchantId, merchantId),
              sql`${customers.telegramId} IS NOT NULL`,
              eq(orders.status, 'completed')
            )
          )
          .groupBy(customers.id, customers.name, customers.phone, customers.telegramId, customers.merchantId, customers.inviteToken, customers.createdAt)
          .having(sql`sum(${orders.totalAmount}::numeric) > 10000`);
      } else if (segment === 'inactive') {
        // Неактивные клиенты (последний заказ > 30 дней назад)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        targetCustomers = await db
          .select({
            id: customers.id,
            name: customers.name,
            phone: customers.phone,
            telegramId: customers.telegramId,
            merchantId: customers.merchantId,
            inviteToken: customers.inviteToken,
            createdAt: customers.createdAt,
          })
          .from(customers)
          .innerJoin(orders, eq(orders.customerId, customers.id))
          .where(
            and(
              eq(customers.merchantId, merchantId),
              sql`${customers.telegramId} IS NOT NULL`
            )
          )
          .groupBy(customers.id, customers.name, customers.phone, customers.telegramId, customers.merchantId, customers.inviteToken, customers.createdAt)
          .having(sql`max(${orders.createdAt}) < ${thirtyDaysAgo}`);
      } else {
        return res.status(400).json({ error: 'Invalid segment' });
      }

      // Фильтруем только тех, у кого есть telegramId
      const customersWithTelegram = targetCustomers.filter(c => c.telegramId);

      if (customersWithTelegram.length === 0) {
        return res.json({ 
          success: true, 
          sent: 0, 
          failed: 0,
          message: t('broadcast.no_customers')
        });
      }

      // Отправляем сообщения
      let sent = 0;
      let failed = 0;

      for (const customer of customersWithTelegram) {
        try {
          // Заменяем переменные в сообщении
          const personalizedMessage = message
            .replace(/\{name\}/g, customer.name || t('common.client'))
            .replace(/\{phone\}/g, customer.phone || '');

          await bot.telegram.sendMessage(customer.telegramId!, personalizedMessage);
          sent++;
          
          // Задержка 50мс между сообщениями, чтобы не попасть в rate limit
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (e) {
          console.error(`Failed to send to ${customer.telegramId}:`, e);
          failed++;
        }
      }

      res.json({ 
        success: true, 
        sent, 
        failed,
        total: customersWithTelegram.length 
      });
    } catch (e) {
      console.error('Broadcast error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // GET /api/broadcast/segments - Получить статистику по сегментам
  app.get("/api/broadcast/segments", telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;

    try {
      // Все клиенты с Telegram
      const [allCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(
          and(
            eq(customers.merchantId, merchantId),
            sql`${customers.telegramId} IS NOT NULL`
          )
        );

      // VIP клиенты
      const vipCustomers = await db
        .select({
          count: sql<number>`count(distinct ${customers.id})`,
        })
        .from(customers)
        .innerJoin(orders, eq(orders.customerId, customers.id))
        .where(
          and(
            eq(customers.merchantId, merchantId),
            sql`${customers.telegramId} IS NOT NULL`,
            eq(orders.status, 'completed')
          )
        )
        .groupBy(customers.id)
        .having(sql`sum(${orders.totalAmount}::numeric) > 10000`);

      // Неактивные клиенты (> 30 дней)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const inactiveCustomers = await db
        .select({
          count: sql<number>`count(distinct ${customers.id})`,
        })
        .from(customers)
        .innerJoin(orders, eq(orders.customerId, customers.id))
        .where(
          and(
            eq(customers.merchantId, merchantId),
            sql`${customers.telegramId} IS NOT NULL`
          )
        )
        .groupBy(customers.id)
        .having(sql`max(${orders.createdAt}) < ${thirtyDaysAgo}`);

      res.json({
        all: Number(allCount?.count || 0),
        vip: vipCustomers.length,
        inactive: inactiveCustomers.length,
      });
    } catch (e) {
      console.error('Segments error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  });
};
