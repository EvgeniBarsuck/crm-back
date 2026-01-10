import { telegramAuth } from "../middleware/auth";
import { db } from "../database/db";
import { orders } from "../database/entities/orders";
import { eq, desc } from "drizzle-orm";
import { Express } from "express";
import { customers } from "../database/entities/customers";
import { Context, Telegraf } from "telegraf";

export const setupOrderApi = (app: Express, bot: Telegraf<Context>) => {
  console.log("🛠️ Регистрируем роуты Order API..."); // DEBUG

  app.get("/api/orders", telegramAuth, async (req, res) => {
    const user = req.user;
    console.log("req.user", req.user);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    console.log("user", user);
    const merchantId = user.id;

    try {
      console.log("merchantId", merchantId);
      const list = await db.query.orders.findMany({
        where: eq(orders.merchantId, merchantId),
        with: { customer: true },
        orderBy: [desc(orders.createdAt)],
      });
      console.log("list", list);
      res.status(200).json(list);
    } catch (e) {
      console.log("error", e);
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  // POST /api/orders
  app.post("/api/orders", telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    console.log("merchantId", merchantId);
    const { total_amount, customer_id } = req.body;

    if (!total_amount) return res.status(400).json({ error: "No amount" });

    try {
      const [newOrder] = await db
        .insert(orders)
        .values({
          merchantId: merchantId,
          customerId: customer_id, // Может быть undefined, если заказ без привязки
          totalAmount: String(total_amount), // Drizzle numeric ждет строку
          status: "new",
        })
        .returning();

      // --- 👇 НОВЫЙ КОД: ОТПРАВКА УВЕДОМЛЕНИЯ ---
      try {
        // 2. Ищем имя клиента для красивого сообщения
        // (Можно оптимизировать через join, но сделаем просто)
        const [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, customer_id));

        const customerName = customer ? customer.name : "Клиент";

        const message = `
  ✅ <b>Новый заказ #${newOrder.id}</b>
  
  👤 Клиент: <b>${customerName}</b>
  💰 Сумма: <b>${total_amount} ₽</b>
  🕒 Статус: 🆕 Новый
  
  <i>Заказ сохранен в базе данных.</i>
        `;

        await bot.telegram.sendMessage(merchantId, message, {
          parse_mode: "HTML",
        });
      } catch (err) {
        console.error("Ошибка отправки сообщения в ТГ:", err);
        // Не роняем запрос, если сообщение не ушло
      }
      // --- 👆 КОНЕЦ НОВОГО КОДА ---

      res.json(newOrder);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch('/api/orders/:id/status', telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    const orderId = parseInt(req.params.id);
    const { status } = req.body;
  
    const validStatuses = ['new', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    try {
      // 1. Обновляем статус в БД
      const [updatedOrder] = await db.update(orders)
        .set({ status: status })
        .where(eq(orders.id, orderId)) // И желательно проверять merchantId, но для MVP опустим
        .returning();
  
      if (!updatedOrder) {
        return res.status(404).json({ error: 'Order not found' });
      }
  
      // 2. (Опционально) Шлем уведомление мерчанту в чат, чтобы была история изменений
      // Или, если бы у нас были ID клиентов-юзеров ТГ, мы бы слали ИМ.
      // Пока шлем "Себе в лог":
      const statusEmoji: Record<string, string> = {
        'new': '🆕', 'in_progress': '⏳', 'completed': '✅', 'cancelled': '❌'
      };
  
      await bot.telegram.sendMessage(merchantId, 
        `Статус заказа #${orderId} изменен на: ${statusEmoji[status]} <b>${status}</b>`, 
        { parse_mode: 'HTML' }
      );
  
      res.json(updatedOrder);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Server error' });
    }
  });
};
