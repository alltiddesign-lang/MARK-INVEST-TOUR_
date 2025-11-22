// Загрузка и отображение данных тура на странице

// Используем глобальный API_URL, инициализированный в api-integration.js
const API_URL = window.API_URL || '/api';

// Функция отображения ошибки
function showError(message) {
    console.error('Показываем ошибку:', message);
    const errorEl = document.getElementById('error');
    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('tour-content');
    
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
    
    if (contentEl) {
        contentEl.style.display = 'none';
    }
    
    if (errorEl) {
        errorEl.style.display = 'block';
        errorEl.textContent = message || 'Произошла ошибка при загрузке тура';
    } else {
        // Если элемента ошибки нет, выводим в консоль и показываем alert
        console.error('Элемент ошибки не найден, показываем alert:', message);
        alert(message || 'Произошла ошибка при загрузке тура');
    }
}

// Получение ID тура из URL
function getTourIdFromUrl() {
    const path = window.location.pathname;
    const match = path.match(/\/tour\/(\d+)/);
    return match ? parseInt(match[1]) : null;
}

// Форматирование даты
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
}

// Форматирование диапазона дат
function formatDateRange(startDate, endDate) {
    if (!startDate && !endDate) return '';
    if (!endDate) return formatDate(startDate);
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
        return `${start.getDate()} - ${end.getDate()} ${end.toLocaleDateString('ru-RU', { month: 'long' })} ${end.getFullYear()}`;
    } else {
        return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
}

// Загрузка данных тура
async function loadTourData() {
    console.log('loadTourData вызвана');
    const tourId = getTourIdFromUrl();
    console.log('ID тура из URL:', tourId);
    
    if (!tourId) {
        console.error('Неверный ID тура. URL:', window.location.pathname);
        showError('Неверный ID тура');
        return;
    }
    
    try {
        const url = `${API_URL}/tours/${tourId}`;
        console.log('Запрос к API:', url);
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        console.log('Ответ получен, статус:', response.status, response.statusText);
        
        if (!response.ok) {
            let errorMessage = 'Ошибка загрузки данных тура';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                const errorText = await response.text();
                if (errorText) {
                    try {
                        const errorJson = JSON.parse(errorText);
                        errorMessage = errorJson.error || errorMessage;
                    } catch (parseError) {
                        errorMessage = errorText || errorMessage;
                    }
                }
            }
            
            if (response.status === 404) {
                console.error('Тур не найден:', errorMessage);
                showError('Тур не найден');
            } else if (response.status === 500) {
                console.error('Ошибка сервера:', errorMessage);
                showError('Ошибка сервера при загрузке тура');
            } else {
                console.error('Ошибка загрузки данных тура:', response.status, errorMessage);
                showError(`Ошибка загрузки данных тура (${response.status})`);
            }
            return;
        }
        
        let tour;
        try {
            const responseText = await response.text();
            if (!responseText) {
                throw new Error('Пустой ответ от сервера');
            }
            tour = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Ошибка парсинга JSON:', parseError);
            showError('Ошибка обработки данных тура');
            return;
        }
        
        if (!tour || typeof tour !== 'object') {
            console.error('Некорректные данные тура:', tour);
            showError('Получены некорректные данные тура');
            return;
        }
        
        console.log('Данные тура получены:', tour);
        
        // Проверяем, что tour имеет необходимые поля
        if (!tour.id) {
            console.error('Тур не содержит ID:', tour);
            showError('Получены некорректные данные тура');
            return;
        }
        
        displayTourData(tour);
    } catch (error) {
        console.error('Ошибка загрузки тура:', error);
        if (error instanceof TypeError && error.message.includes('fetch')) {
            showError('Ошибка подключения к серверу. Проверьте, запущен ли сервер.');
        } else {
            showError('Ошибка подключения к серверу: ' + (error.message || 'Неизвестная ошибка'));
        }
    }
}

// Отображение данных тура
function displayTourData(tour) {
    console.log('displayTourData вызвана с данными:', tour);
    
    // Проверяем наличие элементов
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const contentEl = document.getElementById('tour-content');
    
    if (!loadingEl || !errorEl || !contentEl) {
        console.error('Не найдены необходимые элементы DOM');
        return;
    }
    
    // Скрываем загрузку и ошибку
    loadingEl.style.display = 'none';
    errorEl.style.display = 'none';
    contentEl.style.display = 'block';
    
    // Обновляем title страницы
    document.title = `${tour.title} | MARK INVEST TOUR`;
    
    // Изображение - устанавливаем как фон hero-секции с предзагрузкой для лучшего качества
    const heroSection = document.getElementById('tour-hero-section');
    if (heroSection) {
        let imageUrl;
        if (tour.image_url) {
            imageUrl = tour.image_url.startsWith('/') ? tour.image_url : `/${tour.image_url}`;
        } else {
            // Используем дефолтное изображение, если нет своего
            imageUrl = '/assets/images/hero_background_new.jpg';
            console.log('Используется дефолтное изображение');
        }
        
        // Предзагружаем изображение для лучшего качества
        // Используем высокое качество и принудительную загрузку полного изображения
        const img = new Image();
        
        // Устанавливаем размеры для загрузки изображения высокого разрешения
        // Если доступен большой экран, загружаем изображение в максимальном качестве
        const screenWidth = window.innerWidth || screen.width;
        const screenHeight = window.innerHeight || screen.height;
        const devicePixelRatio = window.devicePixelRatio || 1;
        const optimalWidth = Math.max(screenWidth * devicePixelRatio, 1920);
        
        // Для Retina и высоких DPI экранов увеличиваем качество
        let optimizedImageUrl = imageUrl;
        // Если поддерживается, можно использовать параметры для оптимизации
        // Например, для сервисов с поддержкой query параметров для размера
        
        img.onload = function() {
            // Когда изображение загружено в полном качестве, устанавливаем его как фон
            heroSection.style.backgroundImage = `url('${optimizedImageUrl}')`;
            
            // Принудительно обновляем рендеринг для лучшего качества
            heroSection.style.willChange = 'background-image';
            
            // Небольшая задержка для плавного появления
            requestAnimationFrame(() => {
                heroSection.classList.add('loaded');
                // После появления убираем will-change для оптимизации
                setTimeout(() => {
                    heroSection.style.willChange = 'auto';
                }, 1000);
            });
            
            console.log('Изображение установлено как фон в высоком качестве:', optimizedImageUrl);
        };
        img.onerror = function() {
            // Если изображение не загрузилось, используем дефолтное
            const defaultUrl = '/assets/images/hero_background_new.jpg';
            heroSection.style.backgroundImage = `url('${defaultUrl}')`;
            requestAnimationFrame(() => {
                heroSection.classList.add('loaded');
            });
            console.error('Ошибка загрузки изображения, используется дефолтное');
        };
        
        // Устанавливаем изображение сразу для плавного перехода
        heroSection.style.backgroundImage = `url('${optimizedImageUrl}')`;
        
        // Начинаем загрузку изображения в полном качестве
        // Принудительная загрузка без кеша для получения свежего изображения
        img.src = optimizedImageUrl;
    } else {
        console.error('Элемент tour-hero-section не найден');
    }
    
    // Заголовок
    const titleEl = document.getElementById('tour-title');
    if (titleEl) {
        titleEl.textContent = tour.title || 'Тур';
        console.log('Заголовок установлен:', tour.title);
    } else {
        console.error('Элемент tour-title не найден');
    }
    
    // Мета-информация
    const metaContainer = document.getElementById('tour-meta');
    if (metaContainer) {
        const metaItems = [];
        
        if (tour.date_start || tour.date_end) {
            const dateRange = formatDateRange(tour.date_start, tour.date_end);
            if (dateRange) {
                metaItems.push(`<div class="tour-meta-item">${dateRange}</div>`);
            }
        }
        
        if (tour.duration) {
            metaItems.push(`<div class="tour-meta-item">${tour.duration}</div>`);
        }
        
        if (tour.location) {
            metaItems.push(`<div class="tour-meta-item">${tour.location}</div>`);
        }
        
        if (tour.max_participants) {
            const participants = tour.current_participants || 0;
            metaItems.push(`<div class="tour-meta-item">${participants}/${tour.max_participants} участников</div>`);
        }
        
        metaContainer.innerHTML = metaItems.join('');
        console.log('Мета-информация установлена, элементов:', metaItems.length);
    } else {
        console.error('Элемент tour-meta не найден');
    }
    
    // Цена - показываем несколько цен или базовую цену
    const priceContainer = document.getElementById('tour-price');
    if (priceContainer) {
        // Если есть несколько цен, показываем их
        if (tour.prices && tour.prices.length > 0) {
            const pricesHTML = tour.prices.map(priceItem => {
                const price = priceItem.price || 0;
                const description = priceItem.description ? ` - ${priceItem.description}` : '';
                const formattedPrice = price.toLocaleString('ru-RU') + ' ₽';
                return `<div class="tour-price-item">${formattedPrice}${description}</div>`;
            }).join('');
            
            priceContainer.innerHTML = pricesHTML;
            priceContainer.style.display = 'block';
            priceContainer.className = 'tour-price tour-price-multiple';
            console.log('Цены установлены, количество:', tour.prices.length);
        } else if (tour.price) {
            // Используем базовую цену для обратной совместимости
            priceContainer.dataset.priceRub = tour.price;
            
            // Получаем сохранённую валюту или используем RUB по умолчанию
            const currentCurrency = localStorage.getItem('tourSelectedCurrency') || 'RUB';
            
            // Обновляем отображение цены
            if (typeof updateTourPrice === 'function') {
                updateTourPrice(priceContainer, tour.price, currentCurrency);
            } else {
                priceContainer.textContent = tour.price.toLocaleString('ru-RU') + ' ₽';
            }
            
            priceContainer.style.display = 'block';
            priceContainer.className = 'tour-price';
            console.log('Цена установлена:', tour.price);
        } else {
            priceContainer.style.display = 'none';
            console.log('Цена не указана');
        }
    } else {
        console.error('Элемент tour-price не найден');
    }
    
    // Краткое описание
    const shortDescContainer = document.getElementById('tour-short-description');
    if (shortDescContainer) {
        if (tour.short_description) {
            shortDescContainer.textContent = tour.short_description;
            shortDescContainer.style.display = 'block';
            console.log('Краткое описание установлено');
        } else {
            shortDescContainer.style.display = 'none';
            console.log('Краткое описание отсутствует');
        }
    } else {
        console.error('Элемент tour-short-description не найден');
    }
    
    // Полное описание
    const descTitleEl = document.getElementById('tour-description-title');
    const descContainer = document.getElementById('tour-description');
    if (descContainer) {
        if (tour.description) {
            descContainer.textContent = tour.description;
            descContainer.style.display = 'block';
            if (descTitleEl) {
                descTitleEl.style.display = 'block';
            }
            console.log('Полное описание установлено');
        } else {
            descContainer.style.display = 'none';
            if (descTitleEl) {
                descTitleEl.style.display = 'none';
            }
            console.log('Полное описание отсутствует');
        }
    } else {
        console.error('Элемент tour-description не найден');
    }
    
    // Детали тура
    const detailsTitleEl = document.getElementById('tour-details-title');
    const detailsContainer = document.getElementById('tour-details');
    if (detailsContainer) {
        const details = [];
        
        if (tour.duration) {
            details.push(`
                <div class="tour-detail-item">
                    <div class="tour-detail-label">Длительность</div>
                    <div class="tour-detail-value">${tour.duration}</div>
                </div>
            `);
        }
        
        if (tour.location) {
            details.push(`
                <div class="tour-detail-item">
                    <div class="tour-detail-label">Место</div>
                    <div class="tour-detail-value">${tour.location}</div>
                </div>
            `);
        }
        
        if (tour.max_participants) {
            const available = tour.max_participants - (tour.current_participants || 0);
            details.push(`
                <div class="tour-detail-item">
                    <div class="tour-detail-label">Доступно мест</div>
                    <div class="tour-detail-value">${available} из ${tour.max_participants}</div>
                </div>
            `);
        }
        
        if (tour.date_start && tour.date_end) {
            const start = new Date(tour.date_start);
            const end = new Date(tour.date_end);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
            details.push(`
                <div class="tour-detail-item">
                    <div class="tour-detail-label">Количество дней</div>
                    <div class="tour-detail-value">${days}</div>
                </div>
            `);
        }
        
        // Добавляем включения/исключения в детали
        if (tour.inclusions && tour.inclusions.length > 0) {
            const included = tour.inclusions.filter(inc => inc.type === 'included');
            const excluded = tour.inclusions.filter(inc => inc.type === 'excluded');
            
            if (included.length > 0) {
                const includedItems = included.map(inc => `<li>${inc.item}</li>`).join('');
                details.push(`
                    <div class="tour-detail-item tour-detail-item-full">
                        <div class="tour-detail-label">Что входит в тур</div>
                        <div class="tour-detail-value">
                            <ul style="margin: 0; padding-left: 20px; list-style: disc;">
                                ${includedItems}
                            </ul>
                        </div>
                    </div>
                `);
            }
            
            if (excluded.length > 0) {
                const excludedItems = excluded.map(inc => `<li>${inc.item}</li>`).join('');
                details.push(`
                    <div class="tour-detail-item tour-detail-item-full">
                        <div class="tour-detail-label">Не входит в тур</div>
                        <div class="tour-detail-value">
                            <ul style="margin: 0; padding-left: 20px; list-style: disc;">
                                ${excludedItems}
                            </ul>
                        </div>
                    </div>
                `);
            }
        }
        
        if (details.length > 0) {
            detailsContainer.innerHTML = details.join('');
            detailsContainer.style.display = 'grid';
            if (detailsTitleEl) {
                detailsTitleEl.style.display = 'block';
            }
            console.log('Детали тура установлены, элементов:', details.length);
        } else {
            detailsContainer.style.display = 'none';
            if (detailsTitleEl) {
                detailsTitleEl.style.display = 'none';
            }
            console.log('Детали тура отсутствуют');
        }
    } else {
        console.error('Элемент tour-details не найден');
    }
    
    // Программа тура
    displayTourPrograms(tour);
    
    // Инициализация галереи изображений
    const galleryTitleEl = document.getElementById('tour-gallery-title');
    const galleryContainer = document.getElementById('tour-gallery');
    
    if (typeof initTourGallery === 'function') {
        initTourGallery(tour.id);
        
        // Проверяем содержимое галереи после небольшой задержки
        setTimeout(() => {
            if (galleryContainer) {
                const galleryGrid = galleryContainer.querySelector('.tour-gallery-grid');
                if (galleryGrid && galleryGrid.children.length > 0) {
                    if (galleryTitleEl) {
                        galleryTitleEl.style.display = 'block';
                    }
                    galleryContainer.style.display = 'block';
                } else {
                    if (galleryTitleEl) {
                        galleryTitleEl.style.display = 'none';
                    }
                    galleryContainer.style.display = 'none';
                }
            }
        }, 800);
    } else {
        // Если функция не загрузилась, проверяем содержимое галереи
        setTimeout(() => {
            if (galleryContainer) {
                const galleryGrid = galleryContainer.querySelector('.tour-gallery-grid');
                if (galleryGrid && galleryGrid.innerHTML.trim() !== '' && galleryGrid.children.length > 0) {
                    if (galleryTitleEl) {
                        galleryTitleEl.style.display = 'block';
                    }
                } else {
                    if (galleryTitleEl) {
                        galleryTitleEl.style.display = 'none';
                    }
                }
            }
        }, 500);
    }
    
    // Форма бронирования
    setupBookingForm(tour.id);
}

// Отображение программы тура
function displayTourPrograms(tour) {
    const programsContainer = document.getElementById('tour-programs');
    if (!programsContainer) {
        console.error('Элемент tour-programs не найден');
        return;
    }
    
    // Проверяем наличие программы
    if (!tour.programs || tour.programs.length === 0) {
        programsContainer.style.display = 'none';
        return;
    }
    
    // Сортируем программы по номеру дня
    const sortedPrograms = [...tour.programs].sort((a, b) => (a.day || 0) - (b.day || 0));
    
    // Используем изображение тура как фон по умолчанию
    const defaultImageUrl = tour.image_url 
        ? (tour.image_url.startsWith('/') ? tour.image_url : `/${tour.image_url}`)
        : '/assets/images/hero_background_new.jpg';
    
    // Вычисляем даты для каждого дня
    const startDate = tour.date_start ? new Date(tour.date_start) : null;
    
    // Получаем контейнер для слайдов
    const swiperWrapper = document.getElementById('programs-swiper-wrapper');
    if (!swiperWrapper) {
        console.error('Элемент programs-swiper-wrapper не найден');
        return;
    }
    
    // Очищаем существующие слайды
    swiperWrapper.innerHTML = '';
    
    // Создаем слайды для каждого дня программы
    sortedPrograms.forEach((program, index) => {
        // Вычисляем дату для этого дня
        let dayDate = '';
        if (startDate) {
            const programDate = new Date(startDate);
            programDate.setDate(programDate.getDate() + (program.day - 1));
            dayDate = programDate.toLocaleDateString('ru-RU', { 
                day: 'numeric', 
                month: 'long' 
            });
        }
        
        // Разбиваем текст программы на параграфы (по точкам или переносам строк)
        const programText = program.programm || '';
        const paragraphs = programText.split(/\n\n|\n/).filter(p => p.trim());
        
        // Определяем изображение для дня (приоритет: изображение дня > изображение тура > дефолтное)
        const dayImageUrl = program.image_url 
            ? (program.image_url.startsWith('/') ? program.image_url : `/${program.image_url}`)
            : defaultImageUrl;
        
        // Создаем слайд
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.setAttribute('data-slide-id', program.day || index + 1);
        
        // Создаем карточку дня
        slide.innerHTML = `
            <div class="tour-program-day">
                <div class="tour-program-day-image" style="background-image: url('${dayImageUrl}');">
                    <div class="tour-program-day-badges">
                        <div class="tour-program-day-badge">День ${program.day || index + 1}</div>
                        ${dayDate ? `<div class="tour-program-day-badge">${dayDate}</div>` : ''}
                    </div>
                </div>
                <div class="tour-program-day-content">
                    <div class="tour-program-day-description">
                        ${paragraphs.length > 0 
                            ? paragraphs.map(p => `<p>${p.trim()}</p>`).join('')
                            : `<p>${programText}</p>`
                        }
                    </div>
                </div>
            </div>
        `;
        
        swiperWrapper.appendChild(slide);
    });
    
    // Инициализируем Swiper после создания слайдов
    initProgramsSwiper();
    
    console.log('Программа тура отображена, дней:', sortedPrograms.length);
}

// Инициализация Swiper для программы тура
function initProgramsSwiper() {
    const swiperContainer = document.getElementById('programs-swiper');
    if (!swiperContainer || typeof Swiper === 'undefined') {
        console.error('Swiper не найден или не загружен');
        return;
    }
    
    // Удаляем существующий экземпляр Swiper, если есть
    if (swiperContainer.swiper) {
        swiperContainer.swiper.destroy(true, true);
    }
    
    // Инициализируем новый Swiper
    const swiper = new Swiper(swiperContainer, {
        loop: false,
        slidesPerView: 'auto',
        spaceBetween: 10,
        grabCursor: true,
        speed: 600,
        preloadImages: true,
        watchSlidesProgress: true,
        watchSlidesVisibility: true,
        shortSwipes: true,
        longSwipes: true,
        longSwipesRatio: 0.1,
        observer: true,
        observeSlideChildren: true,
        keyboard: {
            enabled: true,
            onlyInViewport: false,
        },
        scrollbar: {
            el: '.swiper-scrollbar',
            draggable: true,
        },
        navigation: {
            nextEl: '#programs-prev',
            prevEl: '#programs-next',
        },
        on: {
            slideChange: function() {
                updateProgramsNavButtons(this);
            },
            init: function() {
                updateProgramsNavButtons(this);
            }
        }
    });
    
    console.log('Swiper для программы тура инициализирован');
}

// Обновление состояния кнопок навигации
function updateProgramsNavButtons(swiper) {
    const prevBtn = document.getElementById('programs-prev');
    const nextBtn = document.getElementById('programs-next');
    
    if (prevBtn) {
        if (swiper.isEnd) {
            prevBtn.classList.add('disabled');
        } else {
            prevBtn.classList.remove('disabled');
        }
    }
    
    if (nextBtn) {
        if (swiper.isBeginning) {
            nextBtn.classList.add('disabled');
        } else {
            nextBtn.classList.remove('disabled');
        }
    }
}

// Настройка формы бронирования
function setupBookingForm(tourId) {
    const formContainer = document.getElementById('booking-form-container');
    
    // Ищем существующую форму на странице или создаем простую форму
    const existingForm = document.querySelector('form');
    
    if (existingForm) {
        // Если есть форма Tilda, используем её
        const tourIdInput = document.createElement('input');
        tourIdInput.type = 'hidden';
        tourIdInput.name = 'tour_id';
        tourIdInput.value = tourId;
        existingForm.appendChild(tourIdInput);
        
        // Сохраняем ID тура для использования в api-integration.js
        sessionStorage.setItem('selectedTourId', tourId);
    } else {
        // Создаем простую форму
        formContainer.innerHTML = `
            <form id="tour-booking-form" class="tour-form">
                <input type="hidden" name="tour_id" value="${tourId}">
                <div class="tour-form-group">
                    <input type="text" name="name" class="tour-form-input" placeholder="Ваше имя" required>
                </div>
                <div class="tour-form-group">
                    <input type="tel" name="phone" class="tour-form-input" placeholder="Ваш телефон" required>
                </div>
                <div class="tour-form-group">
                    <input type="email" name="email" class="tour-form-input" placeholder="Ваш email (необязательно)">
                </div>
                <div class="tour-form-group">
                    <textarea name="message" class="tour-form-textarea" placeholder="Дополнительная информация (необязательно)" rows="4"></textarea>
                </div>
                <button type="submit" class="tour-form-button">
                    Отправить заявку
                </button>
            </form>
        `;
        
        // Обработчик отправки формы
        const form = document.getElementById('tour-booking-form');
        
        // Инициализируем валидацию для формы
        if (typeof initFormValidation !== 'undefined') {
            initFormValidation(form);
        }
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Валидация формы
            if (typeof validateForm !== 'undefined' && !validateForm(form)) {
                showWarning('Пожалуйста, заполните все обязательные поля корректно');
                return;
            }
            
            const formData = new FormData(form);
            const data = {
                name: formData.get('name'),
                phone: formData.get('phone'),
                email: formData.get('email') || null,
                message: formData.get('message') || null,
                tour_id: parseInt(formData.get('tour_id'))
            };
            
            // Дополнительная проверка обязательных полей
            if (!data.name || !data.phone) {
                showWarning('Пожалуйста, заполните имя и телефон');
                if (!data.name) {
                    const nameField = form.querySelector('[name="name"]');
                    if (nameField && typeof showFieldError !== 'undefined') {
                        showFieldError(nameField, 'Это поле обязательно для заполнения');
                    }
                }
                if (!data.phone) {
                    const phoneField = form.querySelector('[name="phone"]');
                    if (phoneField && typeof showFieldError !== 'undefined') {
                        showFieldError(phoneField, 'Это поле обязательно для заполнения');
                    }
                }
                return;
            }
            
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Отправка...';
            
            try {
                const response = await fetch(`${API_URL}/applications`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showSuccess('Спасибо! Ваша заявка успешно отправлена. Мы свяжемся с вами в ближайшее время.');
                    form.reset();
                    // Очищаем все ошибки валидации
                    form.querySelectorAll('.field-error').forEach(field => {
                        clearFieldError(field);
                    });
                } else {
                    showError('Ошибка отправки заявки: ' + (result.error || 'Попробуйте позже'));
                }
            } catch (error) {
                console.error('Ошибка отправки формы:', error);
                showError('Ошибка подключения к серверу. Пожалуйста, попробуйте позже.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }
}

// Показать ошибку
function showError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').textContent = message;
    document.getElementById('error').style.display = 'block';
}

// Функция обновления цены тура
async function updateTourPrice(priceContainer, priceRub, currency) {
    if (!priceContainer || !priceRub) return;
    
    let displayPrice = priceRub;
    let symbol = '₽';
    
    if (currency === 'USD') {
        // Получаем курс валют
        let usdRate = null;
        try {
            const res = await fetch("https://neverend.travel/api/currencies", { 
                cache: "no-store" 
            });
            if (res.ok) {
                const data = await res.json();
                usdRate = data.data?.usd || null;
            }
        } catch (err) {
            console.warn("Курсы не получены:", err.message);
            // Используем примерный курс если API недоступен
            usdRate = 101.23; // Примерный курс из сайта
        }
        
        if (usdRate) {
            displayPrice = Math.round(priceRub / usdRate);
            symbol = '$';
        }
    }
    
    const formattedPrice = displayPrice.toLocaleString('ru-RU', { 
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
    
    priceContainer.innerHTML = `от<br>${formattedPrice}${symbol}`;
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM загружен, начинаем загрузку данных тура');
    loadTourData();
});

// Также пробуем загрузить, если DOM уже готов
if (document.readyState === 'loading') {
    // DOM еще загружается, ждем события DOMContentLoaded
    console.log('Ожидаем загрузки DOM...');
} else {
    // DOM уже готов
    console.log('DOM уже готов, загружаем данные тура');
    loadTourData();
}

