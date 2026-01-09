import { telegramAuth } from "../middleware/auth";
import { db } from "../database/db";
import { orders } from "../database/entities/orders";
import { eq, desc } from "drizzle-orm";
import { Express } from "express";

export const setupOrderApi = (app: Express) => {
  console.log("🛠️ Регистрируем роуты Order API..."); // DEBUG
  
  app.get("/api/orders", telegramAuth, async (req, res) => {
    const user = req.user;
    console.log('req.user', req.user);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    console.log('user', user);  
    const merchantId = user.id;

    try {
      console.log('merchantId', merchantId);
      const list = await db.query.orders.findMany({
        where: eq(orders.merchantId, merchantId),
        with: { customer: true },
        orderBy: [desc(orders.createdAt)],
      });
      console.log('list', list);
      res.status(200).json(list);
    } catch (e) {
      console.log('error', e);
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  // POST /api/orders
  app.post("/api/orders", telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    console.log('merchantId', merchantId);
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

      res.json(newOrder);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });
};
