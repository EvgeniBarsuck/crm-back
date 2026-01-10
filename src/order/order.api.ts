import { telegramAuth } from "../middleware/auth";
import { db } from "../database/db";
import { orders } from "../database/entities/orders";
import { eq, desc, and } from "drizzle-orm";
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
      const list = await db
        .select({
          id: orders.id,
          totalAmount: orders.totalAmount,
          status: orders.status,
          createdAt: orders.createdAt,
          // 👇 ВАЖНО: Явно берем имя и называем его customerName
          customerName: customers.name,
        })
        .from(orders)
        // 👇 Соединяем таблицу заказов с таблицей клиентов
        .leftJoin(customers, eq(orders.customerId, customers.id))
        .where(eq(orders.merchantId, merchantId))
        .orderBy(desc(orders.createdAt));

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
  app.patch("/api/orders/:id/status", telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    const orderId = parseInt(req.params.id); // Превращаем строку ID в число
    const { status } = req.body;

    console.log(
      `📝 Попытка смены статуса. OrderID: ${orderId}, Новый статус: ${status}`
    );

    // Валидация
    if (isNaN(orderId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const validStatuses = ["new", "in_progress", "completed", "cancelled"];
    if (!status || !validStatuses.includes(status)) {
      console.log("❌ Неверный статус:", status);
      return res.status(400).json({ error: "Invalid status" });
    }

    try {
      // Обновляем
      const [updatedOrder] = await db
        .update(orders)
        .set({ status: status })
        .where(eq(orders.id, orderId))
        .returning();

      if (!updatedOrder) {
        console.log("❌ Заказ не найден или не принадлежит мерчанту");
        return res.status(404).json({ error: "Order not found" });
      }

      console.log("✅ Статус успешно обновлен");

      // Пытаемся отправить уведомление (в try/catch, чтобы не ронять запрос)
      try {
        const statusEmoji: Record<string, string> = {
          new: "🆕",
          in_progress: "⏳",
          completed: "✅",
          cancelled: "❌",
        };
        await bot.telegram.sendMessage(
          merchantId,
          `Статус заказа #${orderId} изменен на: ${statusEmoji[status]} <b>${status}</b>`,
          { parse_mode: "HTML" }
        );

        try {
          // Нам нужно достать telegramId клиента через JOIN
          const [orderWithClient] = await db
            .select({
              clientTgId: customers.telegramId,
              clientName: customers.name,
            })
            .from(orders)
            .leftJoin(customers, eq(orders.customerId, customers.id))
            .where(eq(orders.id, orderId));

          if (orderWithClient && orderWithClient.clientTgId) {
            // Текст для клиента (более вежливый)
            const clientMessages: Record<string, string> = {
              in_progress: `👨‍🍳 Ваш заказ #${orderId} принят в работу!`,
              completed: `🎁 Ура! Ваш заказ #${orderId} готов.!`,
              cancelled: `❌ Ваш заказ #${orderId} был отменен.`,
            };

            if (clientMessages[status]) {
              await bot.telegram.sendMessage(
                Number(orderWithClient.clientTgId),
                clientMessages[status]
              );
            }
          }
        } catch (clientErr) {
          console.error("Не удалось отправить клиенту:", clientErr);
        }
      } catch (msgErr) {
        console.error("Не удалось отправить сообщение в ТГ:", msgErr);
      }

      res.json(updatedOrder);
    } catch (e) {
      console.error("🔥 Ошибка базы данных:", e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete('/api/orders/:id', telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    const orderId = parseInt(req.params.id);
  
    try {
      const [deletedOrder] = await db.delete(orders)
        .where(and(
          eq(orders.id, orderId),
          eq(orders.merchantId, merchantId) // Защита: удаляем только свои
        ))
        .returning();
  
      if (!deletedOrder) {
        return res.status(404).json({ error: 'Order not found' });
      }
  
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Server error' });
    }
  });
};
