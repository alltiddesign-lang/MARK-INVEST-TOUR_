/**
 * Главный файл сервера
 * Рефакторинг: разделение на модули
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');

// Валидация переменных окружения (должна быть первой)
const { validateEnv, getEnv, getEnvNumber } = require('./server/config/env');
validateEnv();

// Импорт конфигурации
const { initDatabase } = require('./server/config/database');
const { initRedis } = require('./server/config/redis');
const { apiLimiter } = require('./server/middleware/rateLimit.middleware');
const { errorHandler, notFoundHandler } = require('./server/middleware/error.middleware');
const { requestLogger } = require('./server/middleware/logger.middleware');
const apiRoutes = require('./server/routes');

// Инициализация Express
const app = express();
const PORT = getEnvNumber('PORT', 3000);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Отключаем для Tilda CMS
  crossOriginEmbedderPolicy: false
}));

// CORS настройки
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getEnv('CORS_ORIGIN', '*').split(',').map(o => o.trim());
    
    // Разрешаем все в development или если указано '*'
    if (getEnv('NODE_ENV') !== 'production' || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    
    // В production проверяем origin
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Основные middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(requestLogger); // Логирование запросов
app.use('/api/', apiLimiter);

// Статические файлы
app.use('/assets', express.static(path.join(__dirname, 'assets'), {
  maxAge: '1d',
  etag: true
}));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Health check (до API, без rate limiting)
app.get('/health', (req, res) => {
  res.redirect('/api/health');
});

// Swagger документация
const { swaggerSpec, swaggerUi } = require('./server/config/swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Neverend Travel API Documentation'
}));

// API роуты
app.use('/api', apiRoutes);

// Роуты для страниц
app.get('/', (req, res) => {
  // Проверяем, является ли устройство iOS
  const userAgent = req.headers['user-agent'] || '';
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  
  // Для iOS отдаём упрощённую версию
  if (isIOS) {
    return res.sendFile(path.join(__dirname, 'ios.html'));
  }
  
  // Для остальных устройств - обычная версия
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/admin/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

app.get('/tour/:id', (req, res) => {
  // Проверяем, является ли устройство iOS
  const userAgent = req.headers['user-agent'] || '';
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  
  // Для iOS отдаём упрощённую версию
  if (isIOS) {
    return res.sendFile(path.join(__dirname, 'ios-tour.html'));
  }
  
  // Для остальных устройств - обычная версия
  res.sendFile(path.join(__dirname, 'tour.html'));
});

app.get('/all-tours.html', (req, res) => {
  // Проверяем, является ли устройство iOS
  const userAgent = req.headers['user-agent'] || '';
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  
  // Для iOS отдаём упрощённую версию
  if (isIOS) {
    return res.sendFile(path.join(__dirname, 'ios-all-tours.html'));
  }
  
  // Для остальных устройств - обычная версия
  res.sendFile(path.join(__dirname, 'all-tours.html'));
});

// Обработка всех остальных маршрутов - возвращаем index.html для SPA
app.get('*', (req, res) => {
  if (['/api', '/admin', '/assets', '/public'].some(prefix => req.path.startsWith(prefix))) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Middleware для обработки ошибок (должен быть последним)
app.use(errorHandler);
app.use(notFoundHandler);

// Инициализация базы данных, Redis и запуск сервера
const { log, error: logError } = require('./server/utils/logger');

// Инициализация асинхронно
(async () => {
  try {
    // Инициализируем базу данных
    await initDatabase();
    
    // Инициализируем Redis (не блокируем запуск, если Redis недоступен)
    await initRedis();
    
    // Запускаем сервер
    app.listen(PORT, () => {
      log(`Сервер запущен на http://localhost:${PORT}`);
      log(`Админ-панель: http://localhost:${PORT}/admin`);
      log(`Health check: http://localhost:${PORT}/health`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      log('Получен SIGTERM, завершаем работу...');
      const { closeRedis } = require('./server/config/redis');
      await closeRedis();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      log('Получен SIGINT, завершаем работу...');
      const { closeRedis } = require('./server/config/redis');
      await closeRedis();
      process.exit(0);
    });
  } catch (err) {
    logError('Ошибка инициализации:', err);
    process.exit(1);
  }
})();
