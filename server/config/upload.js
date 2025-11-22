/**
 * Конфигурация multer для загрузки файлов
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Фильтр файлов - разрешены только изображения
 */
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Разрешены только изображения: JPEG, PNG, WebP'));
  }
};

/**
 * Создание папки для изображений, если её нет
 */
const imagesDir = path.join(__dirname, '../../assets/images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
  console.log('Создана папка для изображений:', imagesDir);
}

/**
 * Настройка хранилища для загруженных файлов
 */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Убеждаемся, что папка существует
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    cb(null, imagesDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    // Сохраняем с оригинальным расширением, оптимизация произойдет после загрузки
    cb(null, uniqueSuffix + ext);
  }
});

/**
 * Настройка multer
 */
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB максимум
  fileFilter: fileFilter
});

module.exports = {
  upload,
  fileFilter
};

