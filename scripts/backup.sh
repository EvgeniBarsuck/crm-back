#!/bin/bash
set -e

# Настройки
DB_HOST="${POSTGRES_HOST:-db}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-crm_user}"
DB_PASSWORD="${POSTGRES_PASSWORD:-crm_secure_password}"
DB_NAME="${POSTGRES_DB:-crm}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN}"
TELEGRAM_CHAT_ID="${BACKUP_CHAT_ID}" # ID чата куда отправлять (твой личный chat_id)

# Имя файла с датой
BACKUP_DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="/tmp/backup_${DB_NAME}_${BACKUP_DATE}.sql.gz"

echo "🔄 Начинаем бэкап базы данных..."
echo "📅 Дата: $BACKUP_DATE"

# Создаем дамп базы данных и сжимаем его
PGPASSWORD=$DB_PASSWORD pg_dump \
  -h $DB_HOST \
  -p $DB_PORT \
  -U $DB_USER \
  -d $DB_NAME \
  --no-owner \
  --no-acl \
  | gzip > $BACKUP_FILE

# Проверяем размер файла
BACKUP_SIZE=$(du -h $BACKUP_FILE | cut -f1)
echo "✅ Бэкап создан: $BACKUP_FILE ($BACKUP_SIZE)"

# Отправляем в Telegram
if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
  echo "⚠️  TELEGRAM_BOT_TOKEN или BACKUP_CHAT_ID не заданы. Отправка в Telegram пропущена."
  echo "📁 Файл сохранен локально: $BACKUP_FILE"
else
  echo "📤 Отправляем в Telegram..."
  
  CAPTION="🗄 Автоматический бэкап%0A📅 ${BACKUP_DATE}%0A💾 Размер: ${BACKUP_SIZE}%0A✅ База: ${DB_NAME}"
  
  curl -F "chat_id=${TELEGRAM_CHAT_ID}" \
       -F "document=@${BACKUP_FILE}" \
       -F "caption=${CAPTION}" \
       "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument"
  
  echo ""
  echo "✅ Бэкап отправлен в Telegram!"
fi

# Удаляем временный файл (или оставляем на сервере для дополнительного хранения)
# rm $BACKUP_FILE

echo "🎉 Готово!"
