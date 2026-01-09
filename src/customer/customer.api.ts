import { customers } from '../database/entities/customers'; // Убедись в пути
import { db } from '../database/db';
import { eq } from 'drizzle-orm';
import { desc } from 'drizzle-orm';
import { telegramAuth } from '../middleware/auth';
import { Express } from "express";


export const setupCustomerApi = (app: Express) => {

    // 1. Получить список клиентов мерчанта
    app.get('/api/customers', telegramAuth, async (req, res) => {
      // @ts-ignore
      const merchantId = req.user.id;
    
      try {
        const list = await db.select()
          .from(customers)
          .where(eq(customers.merchantId, merchantId))
          .orderBy(desc(customers.createdAt));
    
        res.json(list);
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
      }
    });
    
    // 2. Создать нового клиента
    app.post('/api/customers', telegramAuth, async (req, res) => {
      // @ts-ignore
      const merchantId = req.user.id;
      const { name, phone, notes } = req.body;
    
      if (!name) return res.status(400).json({ error: 'Имя обязательно' });
    
      try {
        const [newCustomer] = await db.insert(customers).values({
          merchantId: merchantId,
          name: name,
          phone: phone || '',
          comment: notes || '',
        }).returning();
    
        res.json(newCustomer);
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
      }
    });
};