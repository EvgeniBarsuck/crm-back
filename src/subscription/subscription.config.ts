// Конфигурация тарифных планов

export interface SubscriptionPlan {
  id: 'free' | 'pro' | 'premium';
  name: string;
  price: number; // в звездах Telegram
  currency: string;
  duration: number; // дней
  features: {
    maxOrders: number | null; // null = безлимит
    maxCustomers: number | null;
    maxProducts: number | null;
    notifications: boolean; // Уведомления клиентам
    templates: boolean; // Кастомные шаблоны
    analytics: boolean; // Расширенная аналитика
    backups: boolean; // Автоматические бэкапы
    support: 'basic' | 'priority' | 'vip';
    apiAccess: boolean; // REST API доступ (только PREMIUM)
    exportData: boolean; // Экспорт данных в Excel/CSV
    multiUser: boolean; // Доступ для команды (несколько пользователей)
    whiteLabel: boolean; // Убрать брендинг приложения
  };
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Бесплатный',
    price: 0,
    currency: 'XTR', // Telegram Stars
    duration: 0, // бессрочно
    features: {
      maxOrders: 15, // урезали в 2 раза
      maxCustomers: 15,
      maxProducts: 5,
      notifications: false,
      templates: false,
      analytics: false,
      backups: false,
      support: 'basic',
      apiAccess: false,
      exportData: false,
      multiUser: false,
      whiteLabel: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'PRO',
    price: 250, // ⭐ звезд/месяц (≈300₽)
    currency: 'XTR', // Telegram Stars
    duration: 30,
    features: {
      maxOrders: 500, // НЕ безлимит, но много
      maxCustomers: 200,
      maxProducts: 100,
      notifications: true,
      templates: true,
      analytics: true,
      backups: true,
      support: 'priority',
      apiAccess: false, // Только Premium
      exportData: false, // Только Premium
      multiUser: false, // Только Premium
      whiteLabel: false, // Только Premium
    },
  },
  premium: {
    id: 'premium',
    name: 'PREMIUM',
    price: 400, // ⭐ звезд/месяц (≈600₽)
    currency: 'XTR', // Telegram Stars
    duration: 30,
    features: {
      maxOrders: null, // БЕЗЛИМИТ - только в Premium!
      maxCustomers: null,
      maxProducts: null,
      notifications: true,
      templates: true,
      analytics: true,
      backups: true,
      support: 'vip',
      apiAccess: true, // 🔥 Эксклюзив Premium
      exportData: true, // 🔥 Экспорт в Excel/CSV
      multiUser: true, // 🔥 Доступ для команды
      whiteLabel: true, // 🔥 Белый лейбл
    },
  },
};

// Период бесплатного триала (дней)
export const TRIAL_PERIOD_DAYS = 7;

// Проверка, доступна ли функция для тарифа
export function hasFeature(plan: string, feature: keyof SubscriptionPlan['features']): boolean {
  const planConfig = SUBSCRIPTION_PLANS[plan];
  if (!planConfig) return false;
  return planConfig.features[feature] === true;
}

// Проверка лимита
export function checkLimit(plan: string, limitType: 'maxOrders' | 'maxCustomers' | 'maxProducts', currentCount: number): boolean {
  const planConfig = SUBSCRIPTION_PLANS[plan];
  if (!planConfig) return false;
  
  const limit = planConfig.features[limitType];
  if (limit === null) return true; // безлимит
  
  return currentCount < limit;
}
