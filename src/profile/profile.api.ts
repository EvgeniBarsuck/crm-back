import { Express } from "express";
import { db } from "../database/db";
import { merchants } from "../database/entities/merchants";
import { telegramAuth } from "../middleware/auth";
import { eq } from "drizzle-orm";

export const setupProfileApi = (app: Express) => {
  app.get("/api/profile", telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;

    const [merchant] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.id, merchantId));

    if (!merchant) return res.status(404).json({ error: "Merchant not found" });

    res.json({
      username: merchant.username,
      currency: merchant.currency, // 👇 Отдаем валюту
      // ... шаблоны ...
    });
  });

  // 2. Роут для смены валюты
  app.patch("/api/profile/currency", telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    const { currency } = req.body; // Ждем символ, например '$'

    if (!currency) return res.status(400).json({ error: "Currency required" });

    await db
      .update(merchants)
      .set({ currency: currency })
      .where(eq(merchants.id, merchantId));

    res.json({ success: true, currency });
  });
};
