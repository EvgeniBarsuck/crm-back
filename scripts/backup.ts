import 'dotenv/config';
import { createBackup } from '../src/backup/backup.service';

// Ручной запуск бэкапа
console.log('🚀 Запуск бэкапа вручную...');

createBackup()
  .then(() => {
    console.log('✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
