FROM node:20-alpine

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем TypeScript
RUN npm run build

# Удаляем dev-зависимости для уменьшения размера образа (опционально)
# RUN npm prune --production

# Открываем порт
EXPOSE 3000

# Запускаем миграции и сервер
CMD ["sh", "-c", "npm run migration:run && npm start"]
