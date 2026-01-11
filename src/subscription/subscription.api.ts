import { Express } from 'express';
import { telegramAuth } from '../middleware/auth';
import { SubscriptionService } from '../subscription/subscription.service';
import { SUBSCRIPTION_PLANS } from '../subscription/subscription.config';

export const setupSubscriptionApi = (app: Express, bot: any) => {
  
  // Получить текущую подписку
  app.get('/api/subscription', telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;

    try {
      const subscription = await SubscriptionService.getSubscription(merchantId);
      const planConfig = SUBSCRIPTION_PLANS[subscription.plan];

      res.json({
        ...subscription,
        planDetails: planConfig,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Получить все доступные тарифы
  app.get('/api/subscription/plans', async (req, res) => {
    res.json(Object.values(SUBSCRIPTION_PLANS));
  });

  // Активировать триал
  app.post('/api/subscription/trial', telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;

    try {
      const updated = await SubscriptionService.activateTrial(merchantId);
      res.json(updated);
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  });

  // Создать инвойс для оплаты (Telegram Stars)
  app.post('/api/subscription/create-invoice', telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;
    const { plan } = req.body; // 'pro' или 'premium'

    if (!plan || !['pro', 'premium'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const planConfig = SUBSCRIPTION_PLANS[plan];

    try {
      // Создаем инвойс через Telegram Bot API (Telegram Stars)
      const invoice = await bot.telegram.createInvoiceLink({
        title: `Подписка ${planConfig.name}`,
        description: `Подписка на ${planConfig.duration} дней. Безлимитные заказы, уведомления, шаблоны и аналитика.`,
        payload: `subscription_${merchantId}_${plan}`, // Для идентификации платежа
        provider_token: '', // Для Telegram Stars оставляем пустым!
        currency: 'XTR', // Telegram Stars
        prices: [
          {
            label: `Подписка ${planConfig.name}`,
            amount: planConfig.price, // Для звезд НЕ умножаем на 100!
          },
        ],
      });

      res.json({ invoiceLink: invoice });
    } catch (error) {
      console.error('Error creating invoice:', error);
      res.status(500).json({ error: 'Failed to create invoice' });
    }
  });

  // Webhook для обработки успешных платежей
  app.post('/api/subscription/webhook', async (req, res) => {
    // Это должно обрабатываться через Telegraf middleware
    res.json({ ok: true });
  });

  // Отменить подписку
  app.post('/api/subscription/cancel', telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;

    try {
      const updated = await SubscriptionService.cancelSubscription(merchantId);
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  });
};
