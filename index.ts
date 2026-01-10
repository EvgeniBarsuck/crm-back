import "dotenv/config";
import { telegramAuth } from "./src/middleware/auth";
import express from "express";
import { Telegraf } from "telegraf";
import cors from "cors";
import { customers, db, merchants } from "./src/database";
import { eq, sql } from "drizzle-orm";
import { seed } from "./src/database/seed";
import { setupOrderApi } from "./src/order/order.api";
import { setupCustomerApi } from "./src/customer/customer.api";
import { setupMerchantApi } from "./src/merchant/merchant.api";

export const run = async () => {
  const app = express();

  // 1. CORS должен быть первым
  app.use(
    cors({
      origin: "*",
      allowedHeaders: ["Authorization", "Content-Type", "Accept"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      credentials: true,
    })
  );

  app.use(express.json());

  app.use((req, res, next) => {
    console.log(`📩 ЗАПРОС ПРИШЕЛ: ${req.method} ${req.url}`);
    next();
  });

  setupCustomerApi(app);
  setupMerchantApi(app);

  const token = process.env.TELEGRAM_BOT_TOKEN || "ТВОЙ_ТОКЕН_ИЗ_BOTFATHER";

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not defined");
  }

  const bot = new Telegraf(token);

  bot.start((ctx) => ctx.reply("Привет! Бэкенд работает."));

  // Запускаем бота без await, чтобы не блокировать запуск сервера
  bot.launch().catch((err) => console.error("Bot launch error:", err));

  bot.start(async (ctx) => {
    const payload = ctx.payload; // Это то, что после ?start=
  
    // 1. Если просто старт (без параметров) - это скорее всего Мерчант
    if (!payload) {
      return ctx.reply('Привет! Я CRM бот. Откройте приложение по кнопке меню.');
    }
  
    // 2. Если ссылка вида start=client_5
    if (payload.startsWith('client_')) {
      const customerId = parseInt(payload.replace('client_', ''));
      const telegramId = ctx.from.id;
  
      if (isNaN(customerId)) return ctx.reply('Некорректная ссылка.');
  
      try {
        // Обновляем клиента в базе: записываем его Telegram ID
        const [updated] = await db.update(customers)
          .set({ telegramId: telegramId })
          .where(eq(customers.id, customerId))
          .returning();
  
        if (updated) {
          await ctx.reply(`✅ Вы успешно подписались на уведомления о заказах!`);
          // Уведомляем мерчанта (владельца клиента), что клиент подключился
          await bot.telegram.sendMessage(updated.merchantId as number, `🔗 Клиент ${updated.name} подключил уведомления!`);
        } else {
          ctx.reply('Клиент не найден в базе.');
        }
      } catch (e) {
        console.error(e);
        ctx.reply('Ошибка привязки.');
      }
    }
  });

  setupOrderApi(app, bot);

  // Роут для авторизации/регистрации
  app.get("/api/auth/me", telegramAuth, async (req, res) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      await db
        .insert(merchants)
        .values({
          id: user.id,
          username: user.username,
        })
        .onConflictDoUpdate({
          target: merchants.id,
          set: { username: user.username },
        });

      return res.json({
        id: user.id,
        username: user.username,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Database error" });
    }
  });

  await app.listen(process.env.PORT || 3000, () => {
    console.log("Server is running on port 3000");
  });

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
};

run();
