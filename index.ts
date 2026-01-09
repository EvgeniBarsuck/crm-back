import "dotenv/config";
import { telegramAuth } from "./src/middleware/auth";
import express from "express";
import { Telegraf } from "telegraf";
import cors from "cors";
import { db, merchants } from "./src/database";
import { sql } from "drizzle-orm";
import { seed } from "./src/database/seed";
import { setupOrderApi } from "./src/order/order.api";
import { setupCustomerApi } from "./src/customer/customer.api";

export const run = async () => {
  const app = express();

  // 1. CORS должен быть первым
  app.use(
    cors({
      origin: "*", 
      allowedHeaders: ["Authorization", "Content-Type", "Accept"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    })
  );

  app.use(express.json());
  
  app.use((req, res, next) => {
    console.log(`📩 ЗАПРОС ПРИШЕЛ: ${req.method} ${req.url}`);
    next();
  });
  

  setupOrderApi(app);
  setupCustomerApi(app);

  const token = process.env.TELEGRAM_BOT_TOKEN || "ТВОЙ_ТОКЕН_ИЗ_BOTFATHER";

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not defined");
  }

  const bot = new Telegraf(token);

  bot.start((ctx) => ctx.reply("Привет! Бэкенд работает."));

  bot.launch().catch((err) => {
      console.error("Ошибка запуска бота:", err);
  });

  // Роут для авторизации/регистрации
  app.get("/api/auth/me", telegramAuth, async (req, res) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      await db.insert(merchants).values({
        id: user.id,
        username: user.username,
      }).onConflictDoUpdate({
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
