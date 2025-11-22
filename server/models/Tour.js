/**
 * Модель тура
 */

const { getDatabase } = require('../config/database');
const { NotFoundError } = require('../utils/errors');

class Tour {
  /**
   * Найти все туры с фильтрами
   * Оптимизировано: использование индексов и подготовленных запросов
   * @param {Object} filters - Фильтры поиска
   * @param {string} [filters.status] - Статус тура
   * @param {string} [filters.search] - Поисковый запрос
   * @param {string} [filters.dateFrom] - Дата начала (от)
   * @param {string} [filters.dateTo] - Дата окончания (до)
   * @param {string} [filters.location] - Локация
   * @param {number} [filters.minPrice] - Минимальная цена
   * @param {number} [filters.maxPrice] - Максимальная цена
   * @returns {Promise<Array>} Массив туров
   */
  static async findAll(filters = {}) {
    const db = getDatabase();
    const { status, search, dateFrom, dateTo, location, minPrice, maxPrice } = filters;
    
    // Используем подготовленный запрос для оптимизации
    let query = 'SELECT * FROM tours WHERE 1=1';
    const params = [];
    
    // Фильтры применяются в порядке индексов БД для оптимизации
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (dateFrom) {
      query += ' AND date_start >= ?';
      params.push(dateFrom);
    }
    
    if (dateTo) {
      query += ' AND date_end <= ?';
      params.push(dateTo);
    }
    
    if (minPrice !== undefined && minPrice !== null) {
      query += ' AND price >= ?';
      params.push(parseInt(minPrice));
    }
    
    if (maxPrice !== undefined && maxPrice !== null) {
      query += ' AND price <= ?';
      params.push(parseInt(maxPrice));
    }
    
    if (location) {
      query += ' AND location LIKE ?';
      params.push(`%${location}%`);
    }
    
    // Поиск применяется последним (самый медленный фильтр)
    if (search) {
      query += ' AND (title LIKE ? OR description LIKE ? OR short_description LIKE ? OR location LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    // Сортировка по индексированным полям
    query += ' ORDER BY date_start ASC, created_at DESC';
    
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, tours) => {
        if (err) {
          reject(err);
        } else {
          resolve(tours || []);
        }
      });
    });
  }

  /**
   * Найти тур по ID
   * @param {number} id
   * @returns {Promise<Object>}
   */
  static async findById(id) {
    const db = getDatabase();
    
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM tours WHERE id = ?', [id], async (err, tour) => {
        if (err) {
          reject(err);
        } else if (!tour) {
          reject(new NotFoundError('Тур не найден'));
        } else {
          // Получаем программу тура
          db.all('SELECT * FROM tour_programs WHERE tour_id = ? ORDER BY day ASC', [id], (err, programs) => {
            if (err) {
              reject(err);
            } else {
              tour.programs = programs || [];
              
              // Получаем включения/исключения
              db.all('SELECT * FROM tour_inclusions WHERE tour_id = ? ORDER BY type ASC, id ASC', [id], (err, inclusions) => {
                if (err) {
                  reject(err);
                } else {
                  tour.inclusions = inclusions || [];
                  
                  // Получаем цены
                  db.all('SELECT * FROM tour_prices WHERE tour_id = ? ORDER BY price_order ASC, price ASC', [id], (err, prices) => {
                    if (err) {
                      reject(err);
                    } else {
                      tour.prices = prices || [];
                      resolve(tour);
                    }
                  });
                }
              });
            }
          });
        }
      });
    });
  }

  /**
   * Создать новый тур
   * @param {Object} tourData
   * @returns {Promise<number>} ID созданного тура
   */
  static async create(tourData) {
    const db = getDatabase();
    const {
      title,
      description,
      short_description,
      image_url,
      price,
      duration,
      location,
      date_start,
      date_end,
      max_participants,
      status,
      day,
      programm
    } = tourData;

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO tours (title, description, short_description, image_url, price, duration, 
         location, date_start, date_end, max_participants, status, day, programm) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          description,
          short_description,
          image_url,
          price,
          duration,
          location,
          date_start,
          date_end,
          max_participants,
          status || 'active',
          day || null,
          programm || null
        ],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  /**
   * Обновить тур
   * @param {number} id
   * @param {Object} tourData
   * @returns {Promise<void>}
   */
  static async update(id, tourData) {
    const db = getDatabase();
    const {
      title,
      description,
      short_description,
      image_url,
      price,
      duration,
      location,
      date_start,
      date_end,
      max_participants,
      status,
      day,
      programm
    } = tourData;

    const updateQuery = image_url
      ? `UPDATE tours SET title = ?, description = ?, short_description = ?, image_url = ?, price = ?, 
         duration = ?, location = ?, date_start = ?, date_end = ?, max_participants = ?, status = ?, 
         day = ?, programm = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      : `UPDATE tours SET title = ?, description = ?, short_description = ?, price = ?, 
         duration = ?, location = ?, date_start = ?, date_end = ?, max_participants = ?, status = ?, 
         day = ?, programm = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

    const params = image_url
      ? [title, description, short_description, image_url, price, duration, location, date_start, date_end, max_participants, status, day || null, programm || null, id]
      : [title, description, short_description, price, duration, location, date_start, date_end, max_participants, status, day || null, programm || null, id];

    return new Promise((resolve, reject) => {
      db.run(updateQuery, params, function(err) {
        if (err) {
          reject(err);
        } else if (this.changes === 0) {
          reject(new NotFoundError('Тур не найден'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Удалить тур
   * @param {number} id
   * @returns {Promise<Object>} Данные удаленного тура (для удаления файлов)
   */
  static async delete(id) {
    const db = getDatabase();
    
    return new Promise((resolve, reject) => {
      // Сначала получаем тур, чтобы узнать путь к изображению
      db.get('SELECT image_url FROM tours WHERE id = ?', [id], (err, tour) => {
        if (err) {
          reject(err);
        } else if (!tour) {
          reject(new NotFoundError('Тур не найден'));
        } else {
          // Удаляем программу тура
          db.run('DELETE FROM tour_programs WHERE tour_id = ?', [id], (err) => {
            if (err) {
              console.error('Ошибка удаления программы тура:', err.message);
            }
            
            // Удаляем тур из БД
            db.run('DELETE FROM tours WHERE id = ?', [id], function(err) {
              if (err) {
                reject(err);
              } else if (this.changes === 0) {
                reject(new NotFoundError('Тур не найден'));
              } else {
                resolve(tour);
              }
            });
          });
        }
      });
    });
  }

  /**
   * Сохранить программу тура
   * @param {number} tourId
   * @param {Array} programs
   * @returns {Promise<void>}
   */
  static async savePrograms(tourId, programs) {
    const db = getDatabase();
    
    return new Promise((resolve, reject) => {
      // Удаляем старую программу
      db.run('DELETE FROM tour_programs WHERE tour_id = ?', [tourId], (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Добавляем новую программу
        if (programs && programs.length > 0) {
          const stmt = db.prepare('INSERT INTO tour_programs (tour_id, day, programm, image_url) VALUES (?, ?, ?, ?)');
          let completed = 0;
          let hasError = false;
          
          programs.forEach(program => {
            if (program.day && program.programm) {
              stmt.run([tourId, program.day, program.programm, program.image_url || null], (err) => {
                if (err && !hasError) {
                  hasError = true;
                  reject(err);
                } else {
                  completed++;
                  if (completed === programs.length && !hasError) {
                    stmt.finalize();
                    resolve();
                  }
                }
              });
            } else {
              completed++;
              if (completed === programs.length && !hasError) {
                stmt.finalize();
                resolve();
              }
            }
          });
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Сохранить включения/исключения тура
   * @param {number} tourId
   * @param {Array} inclusions - Массив объектов {item: string, type: 'included'|'excluded'}
   * @returns {Promise<void>}
   */
  static async saveInclusions(tourId, inclusions) {
    const db = getDatabase();
    
    return new Promise((resolve, reject) => {
      // Удаляем старые включения/исключения
      db.run('DELETE FROM tour_inclusions WHERE tour_id = ?', [tourId], (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Добавляем новые включения/исключения
        if (inclusions && inclusions.length > 0) {
          const stmt = db.prepare('INSERT INTO tour_inclusions (tour_id, item, type) VALUES (?, ?, ?)');
          let completed = 0;
          let hasError = false;
          
          inclusions.forEach(inclusion => {
            if (inclusion.item && inclusion.type && (inclusion.type === 'included' || inclusion.type === 'excluded')) {
              stmt.run([tourId, inclusion.item.trim(), inclusion.type], (err) => {
                if (err && !hasError) {
                  hasError = true;
                  reject(err);
                } else {
                  completed++;
                  if (completed === inclusions.length && !hasError) {
                    stmt.finalize();
                    resolve();
                  }
                }
              });
            } else {
              completed++;
              if (completed === inclusions.length && !hasError) {
                stmt.finalize();
                resolve();
              }
            }
          });
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Сохранить цены тура
   * @param {number} tourId
   * @param {Array} prices - Массив объектов {price: number, description: string, price_order: number}
   * @returns {Promise<void>}
   */
  static async savePrices(tourId, prices) {
    const db = getDatabase();
    
    return new Promise((resolve, reject) => {
      // Удаляем старые цены
      db.run('DELETE FROM tour_prices WHERE tour_id = ?', [tourId], (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Добавляем новые цены
        if (prices && prices.length > 0) {
          const stmt = db.prepare('INSERT INTO tour_prices (tour_id, price, description, price_order) VALUES (?, ?, ?, ?)');
          let completed = 0;
          let hasError = false;
          
          prices.forEach((priceItem, index) => {
            if (priceItem.price !== undefined && priceItem.price !== null) {
              const price = parseInt(priceItem.price);
              const description = priceItem.description ? priceItem.description.trim() : null;
              const priceOrder = priceItem.price_order !== undefined ? parseInt(priceItem.price_order) : index;
              
              stmt.run([tourId, price, description, priceOrder], (err) => {
                if (err && !hasError) {
                  hasError = true;
                  reject(err);
                } else {
                  completed++;
                  if (completed === prices.length && !hasError) {
                    stmt.finalize();
                    resolve();
                  }
                }
              });
            } else {
              completed++;
              if (completed === prices.length && !hasError) {
                stmt.finalize();
                resolve();
              }
            }
          });
        } else {
          resolve();
        }
      });
    });
  }
}

module.exports = Tour;

