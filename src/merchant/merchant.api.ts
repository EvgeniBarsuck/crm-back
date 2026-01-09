import { Express } from "express";
import { db, merchants } from "src/database";
import { telegramAuth } from "src/middleware/auth";

export const setupMerchantApi = (app: Express) => {
  app.get("/api/me", telegramAuth, async (req, res) => {
    // @ts-ignore
    const user = req.user as TelegramUser; // Данные из initData (id, first_name, username...)

    try {
      // 🔥 МАГИЯ UPSERT:
      // Пытаемся вставить. Если конфликт по ID (юзер есть) -> обновляем поля.
      const [merchant] = await db
        .insert(merchants)
        .values({
          id: user.id,
          username: user.username || "",
          firstName: user.first_name || "",
          languageCode: user.language_code || "ru",
        })
        .onConflictDoUpdate({
          target: merchants.id,
          set: {
            username: user.username || "",
            firstName: user.first_name || "",
            // createdAt не трогаем
          },
        })
        .returning();

      res.json({ status: "ok", merchant });
    } catch (e) {
      console.error("Registration error:", e);
      res.status(500).json({ error: "Database error during registration" });
    }
  });
};
