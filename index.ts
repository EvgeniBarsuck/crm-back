import "dotenv/config";
import { telegramAuth } from "./src/middleware/auth";
import express from "express";
import { Telegraf } from "telegraf";
import cors from "cors";
import { customers, db, merchants } from "./src/database";
import { eq } from "drizzle-orm";
import { setupOrderApi } from "./src/order/order.api";
import { setupCustomerApi } from "./src/customer/customer.api";
import { setupMerchantApi } from "./src/merchant/merchant.api";
import { setupAnalyticsApi } from "./src/analytics/analytics.api";

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
  setupAnalyticsApi(app);

  const token = process.env.TELEGRAM_BOT_TOKEN || "ТВОЙ_ТОКЕН_ИЗ_BOTFATHER";

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not defined");
  }

  const bot = new Telegraf(token);
  bot.start(async (ctx) => {
    const payload = ctx.payload; // Это будет UUID: "f47ac..."

    if (!payload) {
      return ctx.reply("👋 Привет! Это CRM...");
    }

    // Мы больше не проверяем startsWith('client_'), так как UUID это просто строка
    // Валидируем длину UUID (обычно 36 символов), чтобы не грузить базу мусором
    if (payload.length < 10) return ctx.reply("Некорректная ссылка.");

    try {
      // 👇 ИЩЕМ ПО inviteToken ВМЕСТО ID
      // Так как токен уникальный, мы найдем ровно одного клиента
      const [updated] = await db
        .update(customers)
        .set({ telegramId: ctx.from.id })
        .where(eq(customers.inviteToken, payload))
        .returning();

      if (updated) {
        // ... (код отправки уведомления тот же)
        await ctx.reply(`✅ Вы успешно подписались!`);
      } else {
        ctx.reply("❌ Ссылка недействительна или клиент не найден.");
      }
    } catch (e) {
      // ...
    }
  });

  // Запускаем бота без await, чтобы не блокировать запуск сервера
  bot.launch().catch((err) => console.error("Bot launch error:", err));

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
