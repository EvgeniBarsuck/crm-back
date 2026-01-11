import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../subscription/subscription.service';

// Проверка доступа к премиум-функции
export function requireFeature(feature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const merchantId = req.user?.id;

    if (!merchantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const hasAccess = await SubscriptionService.hasAccess(merchantId, feature);

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Доступ ограничен',
          message: `Эта функция доступна только в тарифах PRO и PREMIUM`,
          feature,
          upgradeRequired: true,
        });
      }

      next();
    } catch (error) {
      console.error('Error checking subscription:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  };
}

// Проверка лимита
export function checkLimit(limitType: 'maxOrders' | 'maxCustomers' | 'maxProducts') {
  return async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const merchantId = req.user?.id;

    if (!merchantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const subscription = await SubscriptionService.getSubscription(merchantId);
      const { SUBSCRIPTION_PLANS } = await import('../subscription/subscription.config');
      const planConfig = SUBSCRIPTION_PLANS[subscription.plan];

      // @ts-ignore
      const limit = planConfig.features[limitType];

      // Если безлимит, пропускаем
      if (limit === null) {
        return next();
      }

      // Здесь должна быть проверка текущего количества
      // Пока пропускаем (TODO: добавить подсчет)
      next();
    } catch (error) {
      console.error('Error checking limit:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  };
}
