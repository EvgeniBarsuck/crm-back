import { Request, Response, NextFunction } from 'express';
import { db } from '../database/db';
import { apiTokens } from '../database/entities/api-tokens';
import { eq, and } from 'drizzle-orm';

/**
 * Middleware для проверки API ключа
 * Использование: Authorization: Bearer crm_xxxxx
 */
export const apiAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'API key required. Use: Authorization: Bearer YOUR_API_KEY' });
  }

  const token = authHeader.substring(7); // Убираем "Bearer "

  try {
    const [apiToken] = await db
      .select()
      .from(apiTokens)
      .where(and(
        eq(apiTokens.token, token),
        eq(apiTokens.isActive, true)
      ))
      .limit(1);

    if (!apiToken) {
      return res.status(401).json({ error: 'Invalid or inactive API key' });
    }

    // Обновляем время последнего использования
    await db
      .update(apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiTokens.id, apiToken.id));

    // Добавляем merchantId в req.user для совместимости с telegramAuth
    // @ts-ignore
    req.user = { id: apiToken.merchantId };

    next();
  } catch (error) {
    console.error('API auth error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};
