import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import FormData from 'form-data';
import axios from 'axios';

const execAsync = promisify(exec);

const DB_HOST = process.env.POSTGRES_HOST || 'localhost';
const DB_PORT = process.env.POSTGRES_PORT || '5432';
const DB_USER = process.env.POSTGRES_USER || 'crm_user';
const DB_PASSWORD = process.env.POSTGRES_PASSWORD || 'crm_secure_password';
const DB_NAME = process.env.POSTGRES_DB || 'crm';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BACKUP_CHAT_ID = process.env.BACKUP_CHAT_ID;

export async function createBackup() {
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFile = `/tmp/backup_${DB_NAME}_${date}.sql.gz`;

  console.log('🔄 Начинаем бэкап базы данных...');
  console.log(`📅 Дата: ${date}`);

  try {
    // Создаем дамп базы данных
    const pgDumpCommand = `PGPASSWORD="${DB_PASSWORD}" pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} --no-owner --no-acl | gzip > ${backupFile}`;
    
    await execAsync(pgDumpCommand);

    // Получаем размер файла
    const stats = fs.statSync(backupFile);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`✅ Бэкап создан: ${backupFile} (${fileSizeMB} MB)`);

    // Отправляем в Telegram
    if (!TELEGRAM_BOT_TOKEN || !BACKUP_CHAT_ID) {
      console.log('⚠️  TELEGRAM_BOT_TOKEN или BACKUP_CHAT_ID не заданы.');
      console.log(`📁 Файл сохранен локально: ${backupFile}`);
      return;
    }

    await sendToTelegram(backupFile, date, fileSizeMB);

    // Удаляем временный файл (опционально)
    fs.unlinkSync(backupFile);
    console.log('🧹 Временный файл удален');

    console.log('🎉 Бэкап завершен успешно!');
  } catch (error) {
    console.error('❌ Ошибка при создании бэкапа:', error);
    throw error;
  }
}

async function sendToTelegram(filePath: string, date: string, sizeMB: string) {
  console.log('📤 Отправляем в Telegram...');

  const form = new FormData();
  form.append('chat_id', BACKUP_CHAT_ID!);
  form.append('document', fs.createReadStream(filePath));
  form.append('caption', `🗄 Автоматический бэкап\n📅 ${date}\n💾 Размер: ${sizeMB} MB\n✅ База: ${DB_NAME}`);

  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`,
      form,
      { headers: form.getHeaders() }
    );
    console.log('✅ Бэкап отправлен в Telegram!');
  } catch (error) {
    console.error('❌ Ошибка отправки в Telegram:', error);
    throw error;
  }
}
