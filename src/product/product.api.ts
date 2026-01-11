import { products } from '../database/entities/products';
import { db } from '../database/db';
import { eq, desc } from 'drizzle-orm';
import { telegramAuth } from '../middleware/auth';
import { Express } from "express";

export const setupProductApi = (app: Express) => {
  
  // Получить список товаров/услуг мерчанта
  app.get('/api/products', telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;

    try {
      const list = await db.select()
        .from(products)
        .where(eq(products.userId, merchantId))
        .orderBy(desc(products.createdAt));

      res.json(list);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Создать новый товар/услугу
  app.post('/api/products', telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    const { name, price } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Название обязательно' });
    }

    try {
      const [newProduct] = await db.insert(products).values({
        userId: merchantId,
        name: name,
        price: price || 0,
      }).returning();

      res.json(newProduct);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Обновить товар/услугу
  app.put('/api/products/:id', telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    const productId = parseInt(req.params.id);
    const { name, price } = req.body;

    try {
      const [updated] = await db.update(products)
        .set({
          name: name,
          price: price,
        })
        .where(eq(products.id, productId))
        // Проверяем, что товар принадлежит этому мерчанту
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Товар не найден' });
      }

      res.json(updated);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Удалить товар/услугу
  app.delete('/api/products/:id', telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    const productId = parseInt(req.params.id);

    try {
      const [deleted] = await db.delete(products)
        .where(eq(products.id, productId))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: 'Товар не найден' });
      }

      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Server error' });
    }
  });
};
