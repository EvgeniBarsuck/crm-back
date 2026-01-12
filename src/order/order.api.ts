import { telegramAuth } from "../middleware/auth";
import { db } from "../database/db";
import { orders } from "../database/entities/orders";
import { eq, desc, and, isNotNull } from "drizzle-orm";
import { Express } from "express";
import { customers } from "../database/entities/customers";
import { Context, Telegraf } from "telegraf";
import { merchants } from "../database/entities/merchants";
import { getTranslator } from "../i18n";

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
          deadline: orders.deadline, // Дедлайн
          // 👇 ВАЖНО: Явно берем имя и называем его customerName
          customerName: customers.name,
          comment: orders.comment,
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
    const { total_amount, customer_id, comment, deadline } = req.body;

    if (!total_amount) return res.status(400).json({ error: "No amount" });

    // 1. 👇 Сначала узнаем валюту мерчанта
    const [merchantData] = await db
      .select({
        currency: merchants.currency,
      })
      .from(merchants)
      .where(eq(merchants.id, merchantId));

    const symbol = merchantData?.currency || "₽";

    try {
      // Парсим дедлайн безопасно
      let parsedDeadline: Date | null = null;
      if (deadline) {
        try {
          parsedDeadline = new Date(deadline);
          // Проверяем, что дата валидна
          if (isNaN(parsedDeadline.getTime())) {
            parsedDeadline = null;
          }
        } catch (e) {
          console.error("Invalid deadline format:", deadline);
          parsedDeadline = null;
        }
      }

      const [newOrder] = await db
        .insert(orders)
        .values({
          merchantId: merchantId,
          customerId: customer_id, // Может быть undefined, если заказ без привязки
          totalAmount: String(total_amount), // Drizzle numeric ждет строку
          status: "new",
          comment: comment || "",
          deadline: parsedDeadline, // Дедлайн (опционально)
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
  💰 Сумма: <b>${total_amount} ${symbol}</b>
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
        // Нам нужно достать telegramId клиента через JOIN и язык мерчанта
        const [orderWithClient] = await db
          .select({
            clientTgId: customers.telegramId,
            clientName: customers.name,
            tplInProgress: merchants.tplInProgress,
            tplCompleted: merchants.tplCompleted,
            tplCancelled: merchants.tplCancelled,
            currency: merchants.currency,
            language: merchants.language, // Язык мерчанта для i18n
          })
          .from(orders)
          .leftJoin(customers, eq(orders.customerId, customers.id))
          .leftJoin(merchants, eq(orders.merchantId, merchants.id))
          .where(eq(orders.id, orderId));

        // Получаем переводчик для языка мерчанта
        const merchantLanguage = orderWithClient?.language || 'ru';
        const t = getTranslator(merchantLanguage);

        // Отправляем уведомление мерчанту
        const statusEmoji: Record<string, string> = {
          new: "🆕",
          in_progress: "⏳",
          completed: "✅",
          cancelled: "❌",
        };
        
        const statusName = t(`order.status.${status}`);
        const merchantMessage = t('order.notifications.merchant_status_changed', {
          id: String(orderId),
          emoji: statusEmoji[status],
          status: statusName,
        });
        
        await bot.telegram.sendMessage(
          merchantId,
          merchantMessage,
          { parse_mode: "HTML" }
        );

        try {

          if (orderWithClient && orderWithClient.clientTgId) {
            // Получаем переводчик для языка мерчанта
            const t = getTranslator(orderWithClient.language || 'ru');
            
            // Текст для клиента (более вежливый)
            const formatMessage = (
              template: string | null,
              defaultTextKey: string
            ) => {
              // Если есть кастомный шаблон - используем его
              if (template && template.trim() !== "") {
                return template
                  .replace(/{id}/g, String(orderId))
                  .replace(/{name}/g, orderWithClient.clientName || "")
                  .replace(
                    /{sum}/g,
                    `${updatedOrder.totalAmount} ${
                      orderWithClient.currency || "₽"
                    }`
                  );
              }
              
              // Иначе используем перевод из i18n
              return t(defaultTextKey, {
                name: orderWithClient.clientName || t('common.guest'),
                id: String(orderId),
                sum: `${updatedOrder.totalAmount} ${orderWithClient.currency || "₽"}`,
              });
            };

            let message = "";

            if (status === "in_progress") {
              message = formatMessage(
                orderWithClient.tplInProgress || "",
                'order.notifications.in_progress'
              );
            } else if (status === "completed") {
              message = formatMessage(
                orderWithClient.tplCompleted || "",
                'order.notifications.completed'
              );
            } else if (status === "cancelled") {
              message = formatMessage(
                orderWithClient.tplCancelled || "",
                'order.notifications.cancelled'
              );
            }

            // Отправляем (только если сообщение не пустое)
            if (message) {
              await bot.telegram.sendMessage(
                Number(orderWithClient.clientTgId),
                message
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

  app.delete("/api/orders/:id", telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    const orderId = parseInt(req.params.id);

    try {
      // 1. Сначала ищем заказ
      const [existingOrder] = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.merchantId, merchantId)));

      if (!existingOrder) {
        return res.status(404).json({ error: "Order not found" });
      }

      // 2. ЖЕСТКАЯ ПРОВЕРКА: Если статус не 'new', запрещаем удаление
      if (existingOrder.status !== "new") {
        return res
          .status(400)
          .json({ error: "Можно удалять только новые заказы (черновики)" });
      }

      // 3. Если всё ок — удаляем
      await db.delete(orders).where(eq(orders.id, orderId));

      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch("/api/orders/:id/info", telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    const orderId = parseInt(req.params.id);
    const { comment, amount } = req.body; // Принимаем и то, и то

    // Формируем объект для обновления (Dynamic Update)
    const updateValues: any = {};
    if (comment !== undefined) updateValues.comment = comment;
    if (amount !== undefined) updateValues.totalAmount = String(amount); // В базе decimal/numeric часто хранится как строка

    // Если нечего обновлять — ошибка
    if (Object.keys(updateValues).length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    try {
      const [updatedOrder] = await db
        .update(orders)
        .set(updateValues)
        .where(and(eq(orders.id, orderId), eq(orders.merchantId, merchantId)))
        .returning();

      if (!updatedOrder) {
        return res.status(404).json({ error: "Order not found" });
      }

      res.json(updatedOrder);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  // GET /api/orders/calendar - Получить заказы для календаря
  app.get("/api/orders/calendar", telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    const { start, end } = req.query; // Диапазон дат (YYYY-MM-DD)

    try {
      let query = db
        .select({
          id: orders.id,
          totalAmount: orders.totalAmount,
          status: orders.status,
          deadline: orders.deadline,
          createdAt: orders.createdAt,
          customerName: customers.name,
          comment: orders.comment,
        })
        .from(orders)
        .leftJoin(customers, eq(orders.customerId, customers.id))
        .where(eq(orders.merchantId, merchantId))
        .$dynamic();

      // Фильтруем только заказы с дедлайном
      query = query.where(
        and(
          eq(orders.merchantId, merchantId),
          isNotNull(orders.deadline)
        )
      );

      const ordersList = await query.orderBy(orders.deadline);

      // Группируем по датам дедлайна
      const grouped: { [date: string]: any[] } = {};
      ordersList.forEach(order => {
        if (order.deadline) {
          const dateKey = order.deadline.toISOString().split('T')[0]; // YYYY-MM-DD
          if (!grouped[dateKey]) grouped[dateKey] = [];
          grouped[dateKey].push(order);
        }
      });

      res.json(grouped);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });
};
