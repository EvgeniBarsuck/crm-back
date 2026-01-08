import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import 'dotenv/config';
import { TelegramUser } from '../types/express.d';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Middleware для Express
export const telegramAuth = (req: Request, res: Response, next: NextFunction) => {
  // Фронт будет слать строку initData в заголовке Authorization
  // Пример заголовка: "Authorization: query_id=..."
  console.log(req.headers);
  const initData = req.headers.authorization;

  if (!initData) {
    res.status(401).json({ error: 'No authorization data' });
    return;
  }

  // Если прислали с префиксом "tma ", убираем его (стандартная практика)
  const rawData = initData.startsWith('tma ') ? initData.slice(4) : initData;

  const urlParams = new URLSearchParams(rawData);
  const hash = urlParams.get('hash');

  // Если хеша нет — данные некорректны
  if (!hash) {
    res.status(401).json({ error: 'Invalid data' });
    return;
  }

  urlParams.delete('hash');

  // Сортировка параметров по алфавиту
  const params: string[] = [];
  for (const [key, value] of urlParams.entries()) {
    params.push(`${key}=${value}`);
  }
  params.sort();

  const dataCheckString = params.join('\n');

  if (!BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not defined');
    res.status(500).json({ error: 'Internal Server Error' });
    return;
  }

  // Генерация секретного ключа
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();

  // Генерация хеша для проверки
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash === hash) {
    // Подпись верна!
    // Достаем данные юзера из строки JSON
    const userStr = urlParams.get('user');
    if (userStr) {
      try {
        req.user = JSON.parse(userStr) as TelegramUser;
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
    next();
  } else {
    res.status(403).json({ error: 'Data is not valid' });
    return;
  }
};
