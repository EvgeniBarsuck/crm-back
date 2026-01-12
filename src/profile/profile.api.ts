import { Express } from "express";
import { db } from "../database/db";
import { merchants } from "../database/entities/merchants";
import { telegramAuth } from "../middleware/auth";
import { eq } from "drizzle-orm";
import { SubscriptionService } from "../subscription/subscription.service";

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
      language: merchant.language || 'ru', // 👇 Отдаем язык
      tplInProgress: merchant.tplInProgress,
      tplCompleted: merchant.tplCompleted,
      tplCancelled: merchant.tplCancelled,
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

  // 3. Роут для смены языка
  app.patch("/api/profile/language", telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    const { language } = req.body; // Ждем код языка: 'ru', 'en', 'pl'

    // Валидация языка
    const supportedLanguages = ['ru', 'en'];
    if (!language || !supportedLanguages.includes(language)) {
      return res.status(400).json({ 
        error: "Invalid language. Supported: " + supportedLanguages.join(', ') 
      });
    }

    await db
      .update(merchants)
      .set({ language: language })
      .where(eq(merchants.id, merchantId));

    res.json({ success: true, language });
  });

  app.patch('/api/profile/templates', telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    // Фронт пришлет поля именно с такими именами
    const { in_progress, completed, cancelled } = req.body; 
  
    try {
      // Проверяем доступ к фиче templates (только PRO и PREMIUM)
      const hasAccess = await SubscriptionService.hasAccess(merchantId, 'templates');
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Шаблоны уведомлений доступны на тарифах PRO (250 ⭐/мес) и PREMIUM (400 ⭐/мес)' 
        });
      }

      await db.update(merchants)
        .set({
          tplInProgress: in_progress, // null или строка
          tplCompleted: completed,
          tplCancelled: cancelled
        })
        .where(eq(merchants.id, merchantId));
  
      res.json({ success: true });
    } catch (e) {
      console.error("Error saving templates:", e);
      res.status(500).json({ error: 'Server error' });
    }
  });
};
