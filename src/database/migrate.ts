import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './db';

async function runMigrations() {
  console.log('⏳ Запуск миграций...');
  try {
    // Эта команда запустит все миграции из папки ./migrations
    // Путь должен быть относительным к месту запуска скрипта (обычно корень проекта)
    // Но так как мы используем drizzle-orm, путь указываем относительно скомпилированного кода или исходников
    await migrate(db, { migrationsFolder: './src/database/migrations' });
    console.log('✅ Миграции успешно выполнены');
  } catch (error) {
    console.error('❌ Ошибка при выполнении миграций:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();



