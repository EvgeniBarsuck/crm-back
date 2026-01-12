import { Express } from 'express';
import { telegramAuth } from '../middleware/auth';
import { db } from '../database/db';
import { orders, customers, products, merchants } from '../database/entities';
import { eq } from 'drizzle-orm';
import { SubscriptionService } from '../subscription/subscription.service';
import { getTranslator } from '../i18n';

export const setupExportApi = (app: Express) => {
  // GET /api/export/orders - Экспорт заказов в CSV
  app.get('/api/export/orders', telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;

    try {
      // Проверяем доступ к фиче exportData
      const hasAccess = await SubscriptionService.hasAccess(merchantId, 'exportData');
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Export Data доступен только на тарифе PREMIUM' 
        });
      }

      // Получаем язык мерчанта
      const merchant = await db.query.merchants.findFirst({
        where: eq(merchants.id, merchantId),
      });
      const t = getTranslator(merchant?.language || 'ru');

      const ordersList = await db.query.orders.findMany({
        where: eq(orders.merchantId, merchantId),
        with: {
          customer: true,
        },
        orderBy: (orders, { desc }) => [desc(orders.createdAt)],
      });

      // Формируем CSV
      const csvHeader = t('export.ordersHeader') + '\n';
      const csvRows = ordersList.map(order => {
        const customerName = order.customer?.name || t('export.noName');
        const customerPhone = order.customer?.phone || '-';
        const totalAmount = order.totalAmount || 0;
        const status = order.status || 'new';
        const comment = (order.comment || '').replace(/,/g, ' '); // Убираем запятые
        const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString(merchant?.language === 'en' ? 'en-US' : 'ru-RU') : '-';

        return `${order.id},"${customerName}","${customerPhone}",${totalAmount},${status},"${comment}",${date}`;
      }).join('\n');

      const csv = csvHeader + csvRows;

      // Устанавливаем заголовки для скачивания файла
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="orders_${Date.now()}.csv"`);
      res.send('\uFEFF' + csv); // BOM для корректного отображения кириллицы в Excel
    } catch (error) {
      console.error('Error exporting orders:', error);
      res.status(500).json({ error: 'Export error' });
    }
  });

  // GET /api/export/customers - Экспорт клиентов в CSV
  app.get('/api/export/customers', telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;

    try {
      const hasAccess = await SubscriptionService.hasAccess(merchantId, 'exportData');
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Export Data доступен только на тарифе PREMIUM' 
        });
      }

      // Получаем язык мерчанта
      const merchant = await db.query.merchants.findFirst({
        where: eq(merchants.id, merchantId),
      });
      const t = getTranslator(merchant?.language || 'ru');

      const customersList = await db.query.customers.findMany({
        where: eq(customers.merchantId, merchantId),
        orderBy: (customers, { desc }) => [desc(customers.createdAt)],
      });

      const csvHeader = t('export.customersHeader') + '\n';
      const csvRows = customersList.map(customer => {
        const name = customer.name || t('export.noName');
        const phone = customer.phone || '-';
        const telegramId = customer.telegramId || '-';
        const comment = (customer.comment || '').replace(/,/g, ' ');
        const date = customer.createdAt ? new Date(customer.createdAt).toLocaleDateString(merchant?.language === 'en' ? 'en-US' : 'ru-RU') : '-';

        return `${customer.id},"${name}","${phone}",${telegramId},"${comment}",${date}`;
      }).join('\n');

      const csv = csvHeader + csvRows;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="customers_${Date.now()}.csv"`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      console.error('Error exporting customers:', error);
      res.status(500).json({ error: 'Export error' });
    }
  });

  // GET /api/export/products - Экспорт товаров в CSV
  app.get('/api/export/products', telegramAuth, async (req, res) => {
    // @ts-ignore
    const merchantId = req.user.id;

    try {
      const hasAccess = await SubscriptionService.hasAccess(merchantId, 'exportData');
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Export Data доступен только на тарифе PREMIUM' 
        });
      }

      // Получаем язык мерчанта
      const merchant = await db.query.merchants.findFirst({
        where: eq(merchants.id, merchantId),
      });
      const t = getTranslator(merchant?.language || 'ru');

      const productsList = await db.query.products.findMany({
        where: eq(products.userId, merchantId),
        orderBy: (products, { desc }) => [desc(products.createdAt)],
      });

      const csvHeader = t('export.productsHeader') + '\n';
      const csvRows = productsList.map(product => {
        const name = product.name || t('export.noName');
        const price = product.price || 0;
        const date = product.createdAt ? new Date(product.createdAt).toLocaleDateString(merchant?.language === 'en' ? 'en-US' : 'ru-RU') : '-';

        return `${product.id},"${name}",${price},${date}`;
      }).join('\n');

      const csv = csvHeader + csvRows;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="products_${Date.now()}.csv"`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      console.error('Error exporting products:', error);
      res.status(500).json({ error: 'Export error' });
    }
  });
};
