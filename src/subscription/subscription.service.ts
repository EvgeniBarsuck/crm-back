import { db } from '../database/db';
import { subscriptions } from '../database/entities/subscriptions';
import { eq } from 'drizzle-orm';
import { SUBSCRIPTION_PLANS, TRIAL_PERIOD_DAYS } from './subscription.config';

export class SubscriptionService {
  // Получить подписку мерчанта
  static async getSubscription(merchantId: number) {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.merchantId, merchantId))
      .limit(1);

    // Если подписки нет, создаем бесплатную
    if (!subscription) {
      return await this.createFreeSubscription(merchantId);
    }

    // Проверяем, не истекла ли подписка
    if (subscription.endDate && new Date() > new Date(subscription.endDate)) {
      await this.expireSubscription(merchantId);
      return await this.getSubscription(merchantId); // Рекурсивно получаем обновленную
    }

    return subscription;
  }

  // Создать бесплатную подписку
  static async createFreeSubscription(merchantId: number) {
    const [newSub] = await db
      .insert(subscriptions)
      .values({
        id: merchantId, // используем merchant_id как id подписки
        merchantId,
        plan: 'free',
        status: 'active',
        startDate: new Date(),
        endDate: null, // бессрочно
      })
      .returning();

    return newSub;
  }

  // Активировать триал
  static async activateTrial(merchantId: number) {
    const subscription = await this.getSubscription(merchantId);

    if (subscription.isTrialUsed) {
      throw new Error('Триал уже использован');
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + TRIAL_PERIOD_DAYS);

    const [updated] = await db
      .update(subscriptions)
      .set({
        plan: 'pro',
        status: 'active',
        startDate: new Date(),
        endDate,
        isTrialUsed: true,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.merchantId, merchantId))
      .returning();

    return updated;
  }

  // Апгрейд/покупка подписки
  static async upgradePlan(merchantId: number, plan: 'pro' | 'premium', paymentId: string) {
    const planConfig = SUBSCRIPTION_PLANS[plan];
    if (!planConfig) {
      throw new Error('Неизвестный тариф');
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + planConfig.duration);

    const [updated] = await db
      .update(subscriptions)
      .set({
        plan,
        status: 'active',
        startDate: new Date(),
        endDate,
        lastPaymentId: paymentId,
        lastPaymentDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.merchantId, merchantId))
      .returning();

    return updated;
  }

  // Отменить подписку (перевод на Free)
  static async cancelSubscription(merchantId: number) {
    const [updated] = await db
      .update(subscriptions)
      .set({
        plan: 'free',
        status: 'cancelled',
        endDate: new Date(), // истекает сразу
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.merchantId, merchantId))
      .returning();

    return updated;
  }

  // Истечение подписки (автоматически)
  static async expireSubscription(merchantId: number) {
    const [updated] = await db
      .update(subscriptions)
      .set({
        plan: 'free',
        status: 'expired',
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.merchantId, merchantId))
      .returning();

    return updated;
  }

  // Проверка доступа к функции
  static async hasAccess(merchantId: number, feature: string): Promise<boolean> {
    const subscription = await this.getSubscription(merchantId);
    const planConfig = SUBSCRIPTION_PLANS[subscription.plan];
    
    if (!planConfig) return false;

    // @ts-ignore
    return planConfig.features[feature] === true;
  }
}
