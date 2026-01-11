import { Express } from 'express';
import { telegramAuth } from '../middleware/auth';
import { db } from '../database/db';
import { apiTokens } from '../database/entities/api-tokens';
import { eq, and } from 'drizzle-orm';
import { SubscriptionService } from '../subscription/subscription.service';
import crypto from 'crypto';

export const setupApiKeysApi = (app: Express) => {
  // GET /api/api-keys - Получить все API ключи мерчанта
  app.get('/api/api-keys', telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;

    try {
      // Проверяем доступ к фиче apiAccess
      const hasAccess = await SubscriptionService.hasAccess(merchantId, 'apiAccess');
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'API Access доступен только на тарифе PREMIUM' 
        });
      }

      const tokens = await db.query.apiTokens.findMany({
        where: eq(apiTokens.merchantId, merchantId),
        orderBy: (apiTokens, { desc }) => [desc(apiTokens.createdAt)],
      });

      res.json(tokens);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/api-keys - Создать новый API ключ
  app.post('/api/api-keys', telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    try {
      const hasAccess = await SubscriptionService.hasAccess(merchantId, 'apiAccess');
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'API Access доступен только на тарифе PREMIUM' 
        });
      }

      // Генерируем уникальный API ключ
      const token = `crm_${crypto.randomBytes(32).toString('hex')}`;

      const [newToken] = await db.insert(apiTokens).values({
        merchantId,
        token,
        name,
        isActive: true,
      }).returning();

      res.status(201).json(newToken);
    } catch (error) {
      console.error('Error creating API key:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // DELETE /api/api-keys/:id - Удалить API ключ
  app.delete('/api/api-keys/:id', telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    const tokenId = Number(req.params.id);

    try {
      const [deleted] = await db
        .delete(apiTokens)
        .where(and(
          eq(apiTokens.id, tokenId),
          eq(apiTokens.merchantId, merchantId)
        ))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: 'API key not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting API key:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // PATCH /api/api-keys/:id - Включить/выключить API ключ
  app.patch('/api/api-keys/:id', telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    const tokenId = Number(req.params.id);
    const { isActive } = req.body;

    try {
      const [updated] = await db
        .update(apiTokens)
        .set({ isActive })
        .where(and(
          eq(apiTokens.id, tokenId),
          eq(apiTokens.merchantId, merchantId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'API key not found' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating API key:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
};
