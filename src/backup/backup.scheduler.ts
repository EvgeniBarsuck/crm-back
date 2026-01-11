import cron from 'node-cron';
import { createBackup } from './backup.service';

export function setupBackupScheduler() {
  // Проверяем, включены ли бэкапы
  const backupEnabled = process.env.BACKUP_ENABLED === 'true';
  const backupSchedule = process.env.BACKUP_SCHEDULE || '0 3 * * *'; // По умолчанию: каждый день в 3:00

  if (!backupEnabled) {
    console.log('⏭️  Автоматические бэкапы отключены (BACKUP_ENABLED != true)');
    return;
  }

  if (!process.env.BACKUP_CHAT_ID) {
    console.log('⚠️  BACKUP_CHAT_ID не задан. Автоматические бэкапы отключены.');
    return;
  }

  console.log(`⏰ Настройка автоматических бэкапов: ${backupSchedule}`);
  console.log(`📱 Бэкапы будут отправляться в Telegram (Chat ID: ${process.env.BACKUP_CHAT_ID})`);

  // Запускаем cron задачу
  cron.schedule(backupSchedule, async () => {
    console.log('🔔 Запуск запланированного бэкапа...');
    try {
      await createBackup();
    } catch (error) {
      console.error('❌ Ошибка при автоматическом бэкапе:', error);
    }
  }, {
    timezone: process.env.TZ || 'Europe/Minsk' // Часовой пояс (можно настроить)
  });

  console.log('✅ Планировщик бэкапов запущен!');
}

// Экспортируем функцию для ручного запуска
export { createBackup };
