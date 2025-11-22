// Интеграция с API для загрузки туров и отправки форм

// Инициализация глобального API_URL (один раз на весь сайт)
if (typeof window.API_URL === 'undefined' || !window.API_URL) {
    window.API_URL = '/api';
}

// Локальная ссылка внутри модуля, не создающая новый глобальный идентификатор
const API_URL = window.API_URL;

// Глобальная переменная для хранения всех туров
window.allTours = [];
window.currentPage = 1;
window.toursPerPage = 6;

// Загрузка туров из API и отображение их на странице
async function loadToursFromAPI() {
    try {
        const logger = window.Logger || { log: console.log, error: console.error };
        logger.log('Загрузка туров из API...');
        
        // Используем TourService если доступен, иначе fallback на прямой fetch
        let tours;
        if (window.TourService) {
            tours = await window.TourService.loadTours();
        } else {
            const response = await fetch(`${API_URL}/tours?status=active`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            tours = await response.json();
        }
        
        logger.log('Получены туры из API:', tours);
        
        if (!tours || tours.length === 0) {
            logger.log('Туры не найдены или пустой массив');
            return;
        }

        // Сохраняем все туры в глобальной переменной
        window.allTours = tours;
        window.currentPage = 1;

        logger.log(`Загружаем ${tours.length} туров в интерфейс...`);
        
        // Загружаем туры в Swiper слайдер
        loadToursToSwiper(tours);
        
        // Загружаем туры в сетку с travelCard с пагинацией
        loadToursToGrid(tours, 1);
        
        // Создаем пагинацию если туров больше 6 (с небольшой задержкой, чтобы карточки успели загрузиться)
        // Затем создаем кнопку "Смотреть все" после пагинации
        if (tours.length > window.toursPerPage) {
            setTimeout(() => {
                createPagination(tours.length);
                // Добавляем кнопку "Смотреть все" после создания пагинации
                setTimeout(() => {
                    addViewAllButton();
                }, 50);
            }, 100);
        } else {
            // Если туров меньше или равно 6, пагинация не нужна, но показываем кнопку "Смотреть все"
            setTimeout(() => {
                addViewAllButton();
            }, 100);
        }
        
        logger.log('Туры успешно загружены в интерфейс');

        // Защищаем карточки от переинициализации Tilda
        setTimeout(() => {
            if (typeof protectDynamicCards === 'function') {
                protectDynamicCards();
            }
        }, 500);

        // Переинициализируем анимации GSAP для новых карточек
        if (typeof gsap !== 'undefined' && typeof initTravelCardAnimations === 'function') {
            setTimeout(() => {
                initTravelCardAnimations();
            }, 500);
        }
        
        // Настраиваем обработчики для новых карточек
        setTimeout(() => {
            if (typeof setupTourCardButtons === 'function') {
                setupTourCardButtons();
            }
        }, 500);
    } catch (error) {
        const logger = window.Logger || { error: console.error };
        logger.error('Ошибка загрузки туров:', error);
    }
}

// Загрузка туров в Swiper слайдер
function loadToursToSwiper(tours) {
    const swiperWrapper = document.querySelector('.swiper-wrapper');
    if (!swiperWrapper) {
        console.log('Swiper контейнер не найден, пропускаем загрузку в слайдер');
        return;
    }
    
    console.log('Загрузка туров в Swiper слайдер');

    // Убеждаемся, что контейнер Swiper имеет класс uc-preorder для применения стилей
    const swiperContainer = swiperWrapper.closest('.swiper');
    if (swiperContainer) {
        const parentContainer = swiperContainer.closest('.uc-preorder') || swiperContainer.parentElement;
        if (parentContainer && !parentContainer.classList.contains('uc-preorder')) {
            parentContainer.classList.add('uc-preorder');
        }
    }

    // Удаляем статические карточки preorderCard, оставляем только туры из БД
    const staticCards = swiperWrapper.querySelectorAll('.preorderCard:not([data-dynamic-card="true"])');
    staticCards.forEach(card => {
        card.remove();
    });
    
    // Также удаляем статические слайды
    swiperWrapper.querySelectorAll('.swiper-slide').forEach(slide => {
        const staticCard = slide.querySelector('.preorderCard:not([data-dynamic-card="true"])');
        if (staticCard) {
            slide.remove();
        }
    });

    // Сортируем туры по дате начала (от ранних к поздним)
    const sortedTours = window.TourService && window.TourService.sortToursByDate
        ? window.TourService.sortToursByDate(tours)
        : [...tours].sort((a, b) => {
            const dateA = a.date_start ? new Date(a.date_start).getTime() : 0;
            const dateB = b.date_start ? new Date(b.date_start).getTime() : 0;
            return dateA - dateB;
        });

    // Создаем карточки туров из API
    sortedTours.forEach(tour => {
        const card = createPreorderCard(tour);
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.setAttribute('data-slide-id', tour.id);
        
        // Устанавливаем стили для слайда для правильных отступов (spaceBetween: 10)
        slide.style.setProperty('width', '350px', 'important');
        slide.style.setProperty('flex-shrink', '0', 'important');
        slide.style.setProperty('margin-right', '10px', 'important');
        slide.style.setProperty('box-sizing', 'border-box', 'important');
        slide.setAttribute('data-dynamic-slide', 'true');
        
        slide.appendChild(card);
        swiperWrapper.appendChild(slide);
        
        // Добавляем обработчики hover для динамических карточек
        setupCardHover(card);
        
        // Защищаем карточку и слайд сразу после создания
        protectDynamicCards();
        protectDynamicSlides();
    });

    // Переинициализируем Swiper после добавления новых карточек
    if (typeof Swiper !== 'undefined') {
        const swiperContainer = swiperWrapper.closest('.swiper');
        if (swiperContainer && swiperContainer.swiper) {
            swiperContainer.swiper.update();
            swiperContainer.swiper.slideTo(0);
        } else if (swiperContainer) {
            // Если Swiper еще не инициализирован, инициализируем его
            setTimeout(() => {
                if (swiperContainer.swiper) {
                    swiperContainer.swiper.update();
                    swiperContainer.swiper.slideTo(0);
                }
            }, 100);
        }
    }
}

// Загрузка туров в сетку с travelCard с поддержкой пагинации (новый Grid-подход)
function loadToursToGrid(tours, page = 1) {
    const travelGridContainer = document.querySelector('[data-group-id="175278397639235650"]');
    if (!travelGridContainer) {
        console.error('Контейнер для туров не найден: [data-group-id="175278397639235650"]');
        return;
    }

    console.log('Загрузка туров в сетку, контейнер найден');

    // Удаляем статические карточки, оставляем только туры из БД
    const staticTravelCards = travelGridContainer.querySelectorAll('.travelCard:not([data-dynamic-card="true"])');
    staticTravelCards.forEach(card => {
        card.remove();
    });
    
    // Также удаляем существующие динамические карточки перед добавлением новых
    // НО НЕ удаляем пагинацию!
    const existingDynamicCards = travelGridContainer.querySelectorAll('[data-dynamic-card="true"]');
    existingDynamicCards.forEach(card => {
        card.remove();
    });

    // Сортируем туры по дате начала (от ранних к поздним)
    const sortedTours = window.TourService && window.TourService.sortToursByDate
        ? window.TourService.sortToursByDate(tours)
        : [...tours].sort((a, b) => {
            const dateA = a.date_start ? new Date(a.date_start).getTime() : 0;
            const dateB = b.date_start ? new Date(b.date_start).getTime() : 0;
            return dateA - dateB;
        });

    // Вычисляем туры для текущей страницы (максимум 6)
    const startIndex = (page - 1) * window.toursPerPage;
    const endIndex = startIndex + window.toursPerPage;
    const toursToDisplay = sortedTours.slice(startIndex, endIndex);
    
    console.log(`Создаем ${toursToDisplay.length} карточек туров для страницы ${page} (${startIndex + 1}-${Math.min(endIndex, sortedTours.length)} из ${sortedTours.length})`);
    
    // Получаем molecule контейнер или создаем его
    let molecule = travelGridContainer.querySelector('.tn-molecule[id="molecule-175278397639235650"]');
    if (!molecule) {
        molecule = document.createElement('div');
        molecule.className = 'tn-molecule';
        molecule.id = 'molecule-175278397639235650';
        travelGridContainer.appendChild(molecule);
    }
    
    // Убеждаемся, что пагинация не находится внутри molecule (перемещаем её, если нужно)
    const existingPagination = document.getElementById('tours-pagination');
    if (existingPagination && molecule.contains(existingPagination)) {
        // Перемещаем пагинацию за пределы molecule
        molecule.removeChild(existingPagination);
        travelGridContainer.appendChild(existingPagination);
    }
    
    toursToDisplay.forEach((tour, index) => {
        console.log(`Создание карточки ${index + 1}/${toursToDisplay.length} для тура ${tour.id}: "${tour.title}"`);
        
        const card = createTravelCard(tour);
        if (card) {
            molecule.appendChild(card);
            console.log(`✓ Карточка добавлена в DOM для тура ${tour.id}`);
            
            // Добавляем обработчики hover для динамических карточек
            if (typeof setupCardHover === 'function') {
                setupCardHover(card);
            }
        } else {
            console.error(`✗ Не удалось создать карточку для тура ${tour.id}`);
        }
    });
    
    const createdCards = molecule.querySelectorAll('[data-dynamic-card="true"]');
    console.log(`Всего карточек в контейнере: ${createdCards.length}`);
    
    // Защищаем карточки после создания
    if (typeof protectDynamicCards === 'function') {
        protectDynamicCards();
    }
    
    // Обновляем цены после создания карточек, если функция переключения валюты уже загружена
    setTimeout(() => {
        // Проверяем, есть ли функция обновления цен
        if (typeof window.updateCurrencyPrices === 'function') {
            window.updateCurrencyPrices();
        } else {
            // Альтернативный способ - диспатчим событие
            window.dispatchEvent(new CustomEvent('toursLoaded'));
        }
    }, 1000);
}

// Создание пагинации (под карточками туров)
function createPagination(totalTours) {
    const travelGridContainer = document.querySelector('[data-group-id="175278397639235650"]');
    if (!travelGridContainer) return;
    
    // Удаляем существующую пагинацию
    const existingPagination = document.getElementById('tours-pagination');
    if (existingPagination) {
        existingPagination.remove();
    }
    
    const totalPages = Math.ceil(totalTours / window.toursPerPage);
    if (totalPages <= 1) return;
    
    // Создаем контейнер для пагинации
    const paginationContainer = document.createElement('div');
    paginationContainer.id = 'tours-pagination';
    
    // Создаем кнопки страниц
    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = 'pagination-page-btn';
        pageButton.type = 'button';
        pageButton.style.cssText = `
            min-width: 40px;
            height: 40px;
            padding: 8px 12px;
            background-color: ${i === window.currentPage ? 'rgba(255, 47, 75, 0.8)' : 'rgba(31, 31, 31, 0.8)'};
            color: #ffffff;
            border: 1px solid ${i === window.currentPage ? 'rgba(255, 47, 75, 0.5)' : 'rgba(255, 255, 255, 0.1)'};
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: ${i === window.currentPage ? '600' : '400'};
            transition: all 0.3s ease;
            position: relative;
            z-index: 1001;
            pointer-events: auto;
            outline: none;
        `;
        
        pageButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.currentPage = i;
            loadToursToGrid(window.allTours, i);
            updatePagination();
            // Не прокручиваем страницу, пагинация остается на месте
        });
        
        pageButton.addEventListener('mouseenter', () => {
            if (i !== window.currentPage) {
                pageButton.style.backgroundColor = 'rgba(255, 47, 75, 0.4)';
            }
        });
        
        pageButton.addEventListener('mouseleave', () => {
            if (i !== window.currentPage) {
                pageButton.style.backgroundColor = 'rgba(31, 31, 31, 0.8)';
            }
        });
        
        paginationContainer.appendChild(pageButton);
    }
    
    // Вставляем пагинацию за пределы travelGridContainer, в родительский #rec1170228026
    // Это гарантирует, что пагинация всегда будет статичной и не зависит от количества карточек
    const parentSection = travelGridContainer.closest('#rec1170228026');
    if (parentSection) {
        // Вставляем пагинацию после travelGridContainer
        parentSection.appendChild(paginationContainer);
    } else {
        // Fallback: вставляем в travelGridContainer
        travelGridContainer.appendChild(paginationContainer);
    }
}

// Обновление пагинации
function updatePagination() {
    const paginationContainer = document.getElementById('tours-pagination');
    if (!paginationContainer) return;
    
    const buttons = paginationContainer.querySelectorAll('.pagination-page-btn');
    buttons.forEach((btn, index) => {
        const pageNum = index + 1;
        if (pageNum === window.currentPage) {
            btn.style.backgroundColor = 'rgba(255, 47, 75, 0.8)';
            btn.style.fontWeight = '600';
            btn.style.borderColor = 'rgba(255, 47, 75, 0.5)';
        } else {
            btn.style.backgroundColor = 'rgba(31, 31, 31, 0.8)';
            btn.style.fontWeight = '400';
            btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        }
    });
}

// Добавление кнопки "Смотреть все" в группу заголовка справа
function addViewAllButton() {
    // Удаляем существующую кнопку если есть
    const existingButton = document.getElementById('view-all-tours-btn');
    if (existingButton) {
        existingButton.remove();
    }
    
    // Ищем и скрываем SVG элемент 1748270103491
    const svgElement = document.querySelector('[data-elem-id="1748270103491"]');
    if (svgElement) {
        svgElement.style.display = 'none';
    }
    
    // Пытаемся найти элемент по классу
    const svgElementByClass = document.querySelector('.tn-elem__11702280261748270103491');
    if (svgElementByClass) {
        svgElementByClass.style.display = 'none';
    }
    
    // Ищем группу с заголовком (data-group-id="174827010347951270")
    const headerGroup = document.querySelector('[data-group-id="174827010347951270"]');
    if (!headerGroup) {
        console.warn('addViewAllButton: группа заголовка не найдена');
        return;
    }
    console.log('addViewAllButton: группа заголовка найдена', headerGroup);
    
    // Создаем кнопку "Смотреть все"
    const button = document.createElement('a');
    button.id = 'view-all-tours-btn';
    button.href = '/all-tours.html';
    button.textContent = 'Смотреть все';
    button.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 14px 32px;
        background: linear-gradient(135deg, rgba(255, 47, 75, 0.8) 0%, rgba(255, 47, 75, 0.6) 100%);
        color: #ffffff;
        text-decoration: none;
        border-radius: 24px;
        font-size: 15px;
        font-weight: 500;
        letter-spacing: 0.05em;
        transition: all 0.3s ease;
        border: 1px solid rgba(255, 47, 75, 0.3);
        cursor: pointer;
        position: relative;
        z-index: 1000;
        pointer-events: auto;
        white-space: nowrap;
    `;
    
    button.addEventListener('mouseenter', () => {
        button.style.background = 'linear-gradient(135deg, rgba(255, 47, 75, 1) 0%, rgba(255, 47, 75, 0.8) 100%)';
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 4px 12px rgba(255, 47, 75, 0.4)';
    });
    
    button.addEventListener('mouseleave', () => {
        button.style.background = 'linear-gradient(135deg, rgba(255, 47, 75, 0.8) 0%, rgba(255, 47, 75, 0.6) 100%)';
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = 'none';
    });
    
    // Обработчик клика - используем простой переход
    // Пробуем несколько способов для максимальной совместимости
    button.addEventListener('click', function(e) {
        console.log('Кнопка "Смотреть все" нажата (addEventListener)');
        e.stopPropagation(); // Останавливаем всплытие события
        
        const targetUrl = window.location.origin + '/all-tours.html';
        console.log('Переход на:', targetUrl);
        
        // Используем window.location.assign для надежности
        try {
            window.location.assign(targetUrl);
        } catch (err) {
            console.error('Ошибка при переходе:', err);
            // Fallback - используем href напрямую
            window.location.href = targetUrl;
        }
    }, true); // Используем capture phase для перехвата события раньше
    
    // Также добавляем прямой обработчик через onclick как резервный вариант
    button.onclick = function(e) {
        console.log('Кнопка "Смотреть все" нажата (onclick)');
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const targetUrl = window.location.origin + '/all-tours.html';
        window.location.href = targetUrl;
        return false;
    };
    
    // Вставляем кнопку в конец molecule (справа)
    const groupMolecule = headerGroup.querySelector('#molecule-174827010347951270');
    if (groupMolecule) {
        groupMolecule.appendChild(button);
        console.log('addViewAllButton: кнопка добавлена в molecule', button);
        
        // Убеждаемся, что группа использует flexbox с горизонтальным выравниванием
        groupMolecule.style.cssText += `
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            width: 100% !important;
        `;
    } else {
        // Фолбэк: вставляем в headerGroup
        headerGroup.appendChild(button);
        console.log('addViewAllButton: кнопка добавлена в headerGroup (фолбэк)', button);
    }
    
    // Проверяем, что кнопка действительно в DOM
    setTimeout(() => {
        const checkButton = document.getElementById('view-all-tours-btn');
        if (checkButton) {
            console.log('addViewAllButton: кнопка успешно добавлена в DOM', checkButton);
            console.log('addViewAllButton: href кнопки:', checkButton.href);
        } else {
            console.error('addViewAllButton: кнопка не найдена в DOM после добавления!');
        }
    }, 100);
}

// Настройка hover эффекта для карточки
function setupCardHover(card) {
    card.addEventListener('mouseenter', () => {
        card.classList.add('hovered');
    });

    card.addEventListener('mouseleave', () => {
        card.classList.remove('hovered');
    });
}

// Создание HTML карточки для Swiper (preorderCard) - точная копия оригинальной структуры
function createPreorderCard(tour) {
    // Форматируем даты
    let dateText = '';
    if (tour.date_start && tour.date_end) {
        const startDate = new Date(tour.date_start);
        const endDate = new Date(tour.date_end);
        dateText = `${startDate.getDate()} - ${endDate.getDate()} ${endDate.toLocaleDateString('ru-RU', { month: 'long' })} ${endDate.getFullYear()}`;
    } else if (tour.date_start) {
        const startDate = new Date(tour.date_start);
        dateText = `${startDate.getDate()} ${startDate.toLocaleDateString('ru-RU', { month: 'long' })} ${startDate.getFullYear()}`;
    }
    
    // Получаем URL изображения (абсолютный путь)
    const imageUrl = tour.image_url ? (tour.image_url.startsWith('/') ? tour.image_url : `/${tour.image_url}`) : '/assets/images/hero_background-min.jpg';
    
    // Генерируем уникальные ID
    const uniqueId = Date.now() + Math.random() * 1000000;
    const groupId = Math.floor(uniqueId);
    const moleculeId1 = Math.floor(uniqueId * 10);
    const moleculeId2 = Math.floor(uniqueId * 20);
    const moleculeId3 = Math.floor(uniqueId * 30);
    const elemId1 = Math.floor(uniqueId * 100);
    const elemId2 = Math.floor(uniqueId * 200);
    const elemId3 = Math.floor(uniqueId * 300);
    const groupClassId = Math.floor(uniqueId * 1000);
    const elemClassId1 = Math.floor(uniqueId * 2000);
    const elemClassId2 = Math.floor(uniqueId * 3000);
    const elemClassId3 = Math.floor(uniqueId * 4000);
    
    // Создаем карточку с точной структурой оригинала
    const card = document.createElement('div');
    card.className = `t396__group tn-group preorderCard tn-group__${groupClassId} t396__group-flex`;
    card.setAttribute('data-tour-id', tour.id);
    card.setAttribute('data-fields', 'top,left,container');
    card.setAttribute('data-group-id', groupId.toString());
    card.setAttribute('data-group-type-value', 'physical');
    card.setAttribute('data-group-top-value', '208');
    card.setAttribute('data-group-left-value', '20');
    card.setAttribute('data-group-padding', '0 0 0 0');
    card.setAttribute('data-group-flex', 'auto');
    card.setAttribute('data-group-flexdirection', 'column');
    card.setAttribute('data-group-flexalignitems', 'flex-start');
    card.setAttribute('data-group-widthmode', 'fixed');
    card.setAttribute('data-group-heightmode', 'fixed');
    card.setAttribute('data-group-height-value', '520');
    card.setAttribute('data-group-width-value', '350');
    card.setAttribute('data-group-topunits-value', 'px');
    card.setAttribute('data-group-leftunits-value', 'px');
    card.setAttribute('data-group-top-res-360-value', '210');
    card.setAttribute('data-group-left-res-360-value', '30');
    card.setAttribute('data-group-width-res-360-value', '340');
    card.setAttribute('data-group-widthmode-res-360', 'fixed');
    card.setAttribute('data-group-top-res-640-value', '270');
    
    // Применяем стили к основной карточке для точного соответствия статическим карточкам
    // В слайдере карточки не должны иметь position: absolute, так как Swiper управляет позиционированием
    // Используем setProperty с important для защиты от переинициализации Tilda
    card.style.setProperty('width', '350px', 'important');
    card.style.setProperty('height', '520px', 'important');
    card.style.setProperty('flex-shrink', '0', 'important');
    card.style.setProperty('margin', '0', 'important');
    card.style.setProperty('position', 'relative', 'important');
    card.style.setProperty('top', '0', 'important');
    card.style.setProperty('left', '0', 'important');
    card.style.setProperty('right', 'auto', 'important');
    card.style.setProperty('bottom', 'auto', 'important');
    card.style.setProperty('transform', 'none', 'important');
    card.style.setProperty('opacity', '1', 'important');
    card.style.setProperty('visibility', 'visible', 'important');
    card.style.setProperty('border-radius', '24px', 'important');
    card.style.setProperty('overflow', 'hidden', 'important');
    card.style.setProperty('margin-top', '0', 'important');
    card.style.setProperty('margin-bottom', '0', 'important');
    
    // Защищаем от переинициализации Tilda - добавляем специальный атрибут
    card.setAttribute('data-dynamic-card', 'true');
    card.setAttribute('data-tilda-ignore', 'true');
    
    card.innerHTML = `<div class="tn-molecule t-bgimg" id="molecule-${moleculeId1}" data-original="${imageUrl}" style="width: 100%; height: 100%; position: relative; background-image: url('${imageUrl}'); background-position: center center; background-size: cover; background-repeat: no-repeat; border-color: transparent; border-style: solid; border-width: 0px; box-sizing: border-box; border-radius: 24px 24px 24px 24px; transition: background-color 0.3s ease-in-out, color 0.3s ease-in-out, border-color 0.3s ease-in-out, box-shadow 0.2s ease-in-out;"> <div class="t396__group tn-group t396__elem-flex t396__group-flex" data-fields="top,left,container" data-group-id="${Math.floor(uniqueId * 11)}" data-group-type-value="physical" data-group-top-value="208" data-group-left-value="20" data-group-padding="24px 24px 24px 24px" data-group-flex="auto" data-group-flexdirection="column" data-group-flexalignitems="flex-start" data-group-widthmode="fill" data-group-heightmode="fill" data-group-height-value="518" data-group-width-value="348" data-group-topunits-value="px" data-group-leftunits-value="px" data-group-top-res-360-value="129" data-group-left-res-360-value="30" data-group-height-res-360-value="599" data-group-width-res-360-value="338" data-group-heightmode-res-360="fixed" data-group-top-res-640-value="189" data-group-height-res-640-value="599" data-group-width-res-640-value="348" data-group-heightmode-res-640="fixed" style="z-index: 3; position: absolute; top: 0px; left: 0px; width: 100%; height: 100%; flex-shrink: 0; margin: 0 0 0 0; padding: 24px 24px 24px 24px; box-sizing: border-box; border-radius: 24px 24px 24px 24px; overflow: hidden;"> <div class="tn-molecule" id="molecule-${moleculeId2}" style="width: 100%; height: 100%; position: relative; display: flex; overflow: visible visible; flex-direction: column; row-gap: 0px; align-items: flex-start; justify-content: flex-end; align-content: flex-end; padding: 0px 0px 0px 0px; border-color: transparent; border-style: solid; box-sizing: border-box; border-radius: 0px; transition: background-color 0.3s ease-in-out, color 0.3s ease-in-out, border-color 0.3s ease-in-out, box-shadow 0.2s ease-in-out;"> <div class="t396__group tn-group t396__elem-flex t396__group-flex" data-fields="top,left,container" data-group-id="${Math.floor(uniqueId * 12)}" data-group-type-value="physical" data-group-top-value="562" data-group-left-value="44" data-group-flex="auto" data-group-flexdirection="column" data-group-flexalignitems="center" data-group-widthmode="fill" data-group-heightmode="hug" data-group-height-value="84" data-group-width-value="298" data-group-topunits-value="px" data-group-leftunits-value="px" data-group-top-res-360-value="564" data-group-left-res-360-value="54" data-group-height-res-360-value="84" data-group-width-res-360-value="288" data-group-top-res-640-value="624" data-group-height-res-640-value="84" data-group-width-res-640-value="298" style="z-index: 3; position: relative; bottom: 0px; left: 0px; width: 100%; height: auto; flex-shrink: 0; margin: 0 0 0 0; align-self: center;"> <div class="tn-molecule" id="molecule-${moleculeId3}" style="width: 100%; height: 100%; position: relative; display: flex; overflow: visible visible; flex-direction: column; row-gap: 8px; align-items: center; justify-content: flex-start; align-content: flex-start; padding: 0px 0px 0px 0px; border-color: transparent; border-style: solid; box-sizing: border-box; border-radius: 0px; transition: background-color 0.3s ease-in-out, color 0.3s ease-in-out, border-color 0.3s ease-in-out, box-shadow 0.2s ease-in-out;"> ${dateText ? `<div class="t396__elem tn-elem t396__elem-flex tn-elem__${elemClassId1}" data-elem-id="${elemId1}" data-elem-type="text" data-field-top-value="562" data-field-left-value="44" data-field-height-value="18" data-field-width-value="298" data-field-axisy-value="top" data-field-axisx-value="left" data-field-container-value="grid" data-field-topunits-value="px" data-field-leftunits-value="px" data-field-heightunits-value="px" data-field-widthunits-value="px" data-field-textfit-value="autoheight" data-field-widthmode-value="fill" data-field-heightmode-value="hug" data-field-fontsize-value="14" data-field-top-res-360-value="564" data-field-left-res-360-value="54" data-field-height-res-360-value="162" data-field-width-res-360-value="288" data-field-top-res-640-value="624" data-field-height-res-640-value="108" data-field-width-res-640-value="298" style="color: #ffffff; text-align: center; z-index: 3; position: relative; top: 0px; left: 0px; width: 100%; flex-shrink: 0; height: auto; margin: 0 0 0 0;"> <div class="tn-atom" field="tn_text" style="vertical-align: middle; color: #ffffff; font-size: 14px; font-family: 'TTHoves', Arial, sans-serif; line-height: 1.2; font-weight: 400; letter-spacing: -0.5px; background-position: center center; border-color: transparent; border-style: solid; transition: background-color 0.3s ease-in-out, color 0.3s ease-in-out, border-color 0.3s ease-in-out, box-shadow 0.2s ease-in-out;">${dateText}</div> </div>` : ''} <div class="t396__elem tn-elem t396__elem-flex tn-elem__${elemClassId2}" data-elem-id="${elemId2}" data-elem-type="text" data-field-top-value="588" data-field-left-value="44" data-field-height-value="58" data-field-width-value="298" data-field-axisy-value="top" data-field-axisx-value="left" data-field-container-value="grid" data-field-topunits-value="px" data-field-leftunits-value="px" data-field-heightunits-value="px" data-field-widthunits-value="px" data-field-textfit-value="autoheight" data-field-widthmode-value="fill" data-field-heightmode-value="hug" data-field-fontsize-value="24" data-field-top-res-360-value="590" data-field-left-res-360-value="54" data-field-height-res-360-value="58" data-field-width-res-360-value="288" data-field-top-res-640-value="650" data-field-height-res-640-value="58" data-field-width-res-640-value="298" style="color: #ffffff; text-align: center; z-index: 3; position: relative; top: 0px; left: 0px; width: 100%; flex-shrink: 0; height: auto; margin: 0 0 0 0;"> <div class="tn-atom" field="tn_text" style="vertical-align: middle; color: #ffffff; font-size: 24px; font-family: 'TTHoves', Arial, sans-serif; line-height: 1.2; font-weight: 500; letter-spacing: -0.5px; background-position: center center; border-color: transparent; border-style: solid; transition: background-color 0.3s ease-in-out, color 0.3s ease-in-out, border-color 0.3s ease-in-out, box-shadow 0.2s ease-in-out;">${tour.title || tourText}</div> </div> </div> </div> <div class="t396__elem tn-elem t396__elem-flex tn-elem__${elemClassId3}" data-elem-id="${elemId3}" data-elem-type="button" data-field-top-value="670" data-field-left-value="44" data-field-height-value="30" data-field-width-value="90" data-field-axisy-value="top" data-field-axisx-value="left" data-field-container-value="grid" data-field-topunits-value="px" data-field-leftunits-value="px" data-field-heightunits-value="px" data-field-widthunits-value="px" data-field-widthmode-value="fixed" data-field-heightmode-value="fixed" data-field-fontsize-value="14" data-field-top-res-360-value="672" data-field-left-res-360-value="54" data-field-top-res-640-value="732" style="color: #1f1f1f; text-align: center; z-index: 3; position: relative; top: 8px; left: 0px; width: 140px; flex-shrink: 0; height: 40px; margin: 0 auto 0 auto; align-self: center;"> <a class="tn-atom" href="#preorder" data-tour-id="${tour.id}" style="color: #1f1f1f; font-size: 16px; font-family: 'TTHoves', Arial, sans-serif; line-height: 1.2; font-weight: 500; letter-spacing: -0.5px; border-width: 1px; border-radius: 32px 32px 32px 32px; background-color: #ffffff; background-position: center center; border-color: transparent; border-style: solid; transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out, border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out; display: flex; justify-content: center; align-items: center; text-decoration: none; width: 100%; height: 100%;"> <div class="tn-atom__button-content" style="column-gap: 10px;"> <span>Предзаказ</span> </div> </a> </div> </div> </div> </div>`;
    
    return card;
}

// Создание HTML карточки для сетки (travelCard) - новый формат
function createTravelCard(tour) {
    const logger = window.Logger || { log: console.log, error: console.error };
    logger.log('createTravelCard вызвана для тура:', tour?.id, tour?.title);
    
    if (!tour || !tour.id) {
        logger.error('createTravelCard: некорректные данные тура', tour);
        return null;
    }
    
    // Используем TravelCard компонент если доступен, иначе fallback на старую логику
    if (window.TravelCard) {
        try {
            const travelCard = new window.TravelCard(tour);
            return travelCard.create();
        } catch (err) {
            logger.error('Ошибка создания TravelCard:', err);
            // Fallback на старую логику
        }
    }
    
    // Fallback: старая логика создания карточки
    // Форматируем даты
    let dateText = '';
    if (window.DateUtils && window.DateUtils.formatTourDate) {
        dateText = window.DateUtils.formatTourDate(tour.date_start, tour.date_end);
    } else {
        if (tour.date_start && tour.date_end) {
            const startDate = new Date(tour.date_start);
            const endDate = new Date(tour.date_end);
            dateText = `${startDate.getDate()} - ${endDate.getDate()} ${endDate.toLocaleDateString('ru-RU', { month: 'long' })} ${endDate.getFullYear()}`;
        } else if (tour.date_start) {
            const startDate = new Date(tour.date_start);
            dateText = `${startDate.getDate()} ${startDate.toLocaleDateString('ru-RU', { month: 'long' })} ${startDate.getFullYear()}`;
        }
    }
    
    // Получаем переводы
    const translations = window.i18n && window.i18n.getTranslations ? window.i18n.getTranslations() : {};
    const fromText = translations.common?.from || 'от';
    const tourText = translations.calendar?.tour || 'Тур';
    
    // Форматируем цену - используем несколько цен, если они есть, иначе базовую цену
    let priceText = '';
    let minPrice = null;
    
    if (tour.prices && tour.prices.length > 0) {
        // Находим минимальную цену из всех цен
        minPrice = Math.min(...tour.prices.map(p => p.price || 0));
        if (minPrice > 0) {
            priceText = `${fromText} ${minPrice.toLocaleString('ru-RU')} ₽`;
        }
    } else if (tour.price) {
        // Используем базовую цену для обратной совместимости
        minPrice = tour.price;
        priceText = `${fromText} ${tour.price.toLocaleString('ru-RU')} ₽`;
    }
    
    // Получаем URL изображения (абсолютный путь)
    const imageUrl = tour.image_url ? (tour.image_url.startsWith('/') ? tour.image_url : `/${tour.image_url}`) : '/assets/images/hero_background-min.jpg';
    
    // Формируем URL для перехода на страницу тура
    const tourUrl = `/tour/${tour.id}`;
    
    // Создаем простую карточку с новым форматом
    const card = document.createElement('div');
    card.className = 'travelCard';
    card.setAttribute('data-tour-id', tour.id);
    card.setAttribute('data-dynamic-card', 'true');
    card.setAttribute('data-tilda-ignore', 'true');
    card.setAttribute('data-tour-url', tourUrl);
    
    // Создаем изображение
    const imageDiv = document.createElement('div');
    imageDiv.className = 'tour-card-image lazy-image';
    imageDiv.setAttribute('data-bg', imageUrl);
    
    // Создаем контент карточки
    const contentDiv = document.createElement('div');
    contentDiv.className = 'tour-card-content';
    
    // Мета-информация (дата и цена)
    const metaDiv = document.createElement('div');
    metaDiv.className = 'tour-card-meta';
    if (dateText) {
        const dateSpan = document.createElement('span');
        dateSpan.className = 'tour-card-date';
        dateSpan.textContent = dateText;
        metaDiv.appendChild(dateSpan);
    }
    if (dateText && priceText) {
        const separatorSpan = document.createElement('span');
        separatorSpan.className = 'tour-card-separator';
        separatorSpan.textContent = ' • ';
        metaDiv.appendChild(separatorSpan);
    }
    if (priceText) {
        const priceSpan = document.createElement('span');
        priceSpan.className = 'tour-card-price price';
        if (minPrice) {
            priceSpan.setAttribute('data-price-rub', minPrice);
        }
        priceSpan.textContent = priceText;
        metaDiv.appendChild(priceSpan);
    }
    contentDiv.appendChild(metaDiv);
    
    // Название
    const titleDiv = document.createElement('div');
    titleDiv.className = 'tour-card-title';
    titleDiv.textContent = tour.title || tourText;
    contentDiv.appendChild(titleDiv);
    
    // Описание
    if (tour.short_description) {
        const descDiv = document.createElement('div');
        descDiv.className = 'tour-card-description';
        descDiv.textContent = tour.short_description;
        contentDiv.appendChild(descDiv);
    }
    
    // Собираем карточку
    card.appendChild(imageDiv);
    card.appendChild(contentDiv);
    
    // Добавляем обработчик клика на всю карточку
    card.addEventListener('click', (e) => {
        if (e.target.closest('a, button')) {
            return;
        }
        
        try {
            if (typeof window.trackTourClick === 'function') {
                window.trackTourClick(tour.id);
            }
        } catch (err) {
            // Игнорируем ошибки аналитики
        }
        
        window.location.href = tourUrl;
    });
    
    // Инициализируем lazy loading для изображения
    setTimeout(() => {
        if (imageDiv) {
            initLazyImage(imageDiv);
        }
    }, 0);
    
    return card;
}

// Lazy loading для изображений
function initLazyImage(imgElement) {
    if (!imgElement || !('IntersectionObserver' in window)) {
        // Fallback для старых браузеров - загружаем сразу
        const bgUrl = imgElement.getAttribute('data-bg');
        if (bgUrl) {
            imgElement.style.backgroundImage = `url('${bgUrl}')`;
            imgElement.style.opacity = '1';
        }
        return;
    }
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const bgUrl = entry.target.getAttribute('data-bg');
                if (bgUrl) {
                    const img = new Image();
                    img.onload = () => {
                        entry.target.style.backgroundImage = `url('${bgUrl}')`;
                        entry.target.style.opacity = '1';
                        entry.target.style.transition = 'opacity 0.3s ease-in-out';
                    };
                    img.onerror = () => {
                        entry.target.style.opacity = '1';
                    };
                    img.src = bgUrl;
                }
                observer.unobserve(entry.target);
            }
        });
    }, {
        rootMargin: '50px' // Начинаем загрузку за 50px до появления в viewport
    });
    
    imageObserver.observe(imgElement);
}

// Защита динамических слайдов от изменения позиции
function protectDynamicSlides() {
    const slides = document.querySelectorAll('[data-dynamic-slide="true"]');
    slides.forEach(slide => {
        slide.style.setProperty('width', '350px', 'important');
        slide.style.setProperty('flex-shrink', '0', 'important');
        slide.style.setProperty('margin-right', '10px', 'important');
        slide.style.setProperty('margin-top', '0', 'important');
        slide.style.setProperty('margin-bottom', '0', 'important');
        slide.style.setProperty('top', 'auto', 'important');
        slide.style.setProperty('left', 'auto', 'important');
        slide.style.setProperty('transform', 'none', 'important');
        slide.style.setProperty('box-sizing', 'border-box', 'important');
        slide.style.setProperty('align-self', 'flex-start', 'important');
        
        // Защищаем карточку внутри слайда
        const card = slide.querySelector('.preorderCard[data-dynamic-card="true"]');
        if (card) {
            card.style.setProperty('position', 'relative', 'important');
            card.style.setProperty('top', '0', 'important');
            card.style.setProperty('left', '0', 'important');
            card.style.setProperty('transform', 'none', 'important');
            card.style.setProperty('margin-top', '0', 'important');
            card.style.setProperty('margin-bottom', '0', 'important');
        }
    });
}

// Защита динамических карточек от переинициализации Tilda
function protectDynamicCards() {
    const cards = document.querySelectorAll('[data-dynamic-card="true"]');
    cards.forEach(card => {
        // Восстанавливаем критические стили
        if (card.classList.contains('travelCard')) {
            // Новый формат карточек - используем Grid
            card.style.setProperty('position', 'relative', 'important');
            card.style.setProperty('width', '100%', 'important');
            card.style.setProperty('max-width', '353px', 'important');
            card.style.setProperty('height', 'auto', 'important');
            card.style.setProperty('min-height', '520px', 'important');
            card.style.setProperty('top', 'auto', 'important');
            card.style.setProperty('left', 'auto', 'important');
            card.style.setProperty('background-color', '#393a3f', 'important');
            card.style.setProperty('border-radius', '24px', 'important');
            card.style.setProperty('overflow', 'hidden', 'important');
        } else if (card.classList.contains('preorderCard')) {
            card.style.setProperty('width', '350px', 'important');
            card.style.setProperty('height', '520px', 'important');
            card.style.setProperty('position', 'relative', 'important');
            card.style.setProperty('top', '0', 'important');
            card.style.setProperty('left', '0', 'important');
            card.style.setProperty('right', 'auto', 'important');
            card.style.setProperty('bottom', 'auto', 'important');
            card.style.setProperty('transform', 'none', 'important');
            card.style.setProperty('border-radius', '24px', 'important');
            card.style.setProperty('overflow', 'hidden', 'important');
            card.style.setProperty('margin-top', '0', 'important');
            card.style.setProperty('margin-bottom', '0', 'important');
        }
        card.style.setProperty('opacity', '1', 'important');
        card.style.setProperty('visibility', 'visible', 'important');
        card.style.setProperty('flex-shrink', '0', 'important');
        card.style.setProperty('margin', '0', 'important');
    });
}

// Инициализация анимаций для карточек туров
function initTravelCardAnimations() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    
    // Находим только динамически созданные карточки (с data-tour-id)
    const elements = document.querySelectorAll('.preorderCard[data-tour-id], .travelCard[data-tour-id]');
    
    // Отключаем анимации для динамических карточек, чтобы они не пропадали
    // Вместо этого просто убеждаемся, что они видимы
    elements.forEach((elem) => {
        // Устанавливаем видимость напрямую, без анимации
        gsap.set(elem, { opacity: 1, visibility: 'visible', y: 0, clearProps: 'all' });
        
        // Защищаем от изменения стилей Tilda
        protectDynamicCards();
    });
}

// Флаг для предотвращения двойной отправки
const submittingForms = new WeakSet();

// Вспомогательная функция для проверки, является ли форма Tilda формой
function isTildaForm(form) {
    // Форма подписки не является формой Tilda - обрабатывается отдельно через subscription.js
    if (form.id === 'subscription-form' || form.classList.contains('subscription-form')) {
        return false;
    }
    return form.closest('.t-popup') || 
           form.closest('[data-tilda-formskey]') ||
           form.querySelector('.tn-atom__form') ||
           form.closest('[data-elem-type="form"]') ||
           (form.querySelector('[name="name"]') || form.querySelector('[name="Name"]') || form.querySelector('[name="phone"]') || form.querySelector('[name="Phone"]')) ||
           form.classList.contains('js-form-proccess') ||
           form.classList.contains('js-send-form-error');
}

// Вспомогательная функция для поиска поля формы
function findFormField(form, names, types = [], placeholders = []) {
    for (const name of names) {
        const field = form.querySelector(`[name="${name}"]`);
        if (field) return field;
    }
    for (const type of types) {
        const field = form.querySelector(`input[type="${type}"]`);
        if (field) return field;
    }
    for (const placeholder of placeholders) {
        const field = form.querySelector(`input[placeholder*="${placeholder}" i]`);
        if (field) return field;
    }
    return form.querySelector('input[data-name], input[id*="name" i], input[id*="phone" i], input[id*="email" i]');
}

// Вспомогательная функция для закрытия попапа вручную
function closePopupManually(modal) {
    modal.classList.remove('t-popup_show');
    modal.style.display = 'none';
    
    // Ищем фон попапа - он может быть nextElementSibling или в родительском контейнере
    let popupBG = modal.nextElementSibling;
    if (!popupBG || !popupBG.classList.contains('t-popup__bg')) {
        const t1093Container = modal.closest('.t1093');
        if (t1093Container) {
            popupBG = t1093Container.querySelector('.t-popup__bg');
        }
    }
    
    if (popupBG && popupBG.classList.contains('t-popup__bg')) {
        popupBG.classList.remove('t-popup__bg-active');
        popupBG.style.display = 'none';
    }
    
    document.body.style.overflow = '';
    document.body.classList.remove('t-body_scroll-lock');
}

// Функция для обработки отправки формы
async function handleFormSubmit(form, event) {
    if (submittingForms.has(form)) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        }
        return true;
    }
    
    if (!isTildaForm(form)) return false;

    // Помечаем форму как отправляемую
    submittingForms.add(form);

    if (event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    }

        // Собираем данные формы
        const formData = new FormData(form);
    const nameField = findFormField(form, ['name', 'Name', 'NAME'], ['text'], ['имя', 'Имя', 'name']);
    const phoneField = findFormField(form, ['phone', 'Phone', 'PHONE'], ['tel'], ['телефон', 'Телефон', 'phone']);
    const emailField = findFormField(form, ['email', 'Email', 'EMAIL'], ['email']);
    const directionField = form.querySelector('[name*="direction" i], select[data-name="direction"], select[id*="direction" i]');
    const messageField = form.querySelector('[name*="message" i], textarea');
    
        const data = {
        name: (nameField?.value || formData.get('name') || formData.get('Name') || formData.get('NAME') || '').trim(),
        phone: (phoneField?.value || formData.get('phone') || formData.get('Phone') || formData.get('PHONE') || '').trim(),
        email: (emailField?.value || formData.get('email') || formData.get('Email') || formData.get('EMAIL') || '').trim(),
        direction: (directionField?.value || formData.get('direction') || formData.get('Direction') || formData.get('DIRECTION') || '').trim(),
        message: (messageField?.value || formData.get('message') || formData.get('Message') || formData.get('MESSAGE') || '').trim()
        };

        // Получаем ID тура, если кнопка была нажата на карточке тура
        const submitButton = form.querySelector('button[type="submit"]') || form.querySelector('input[type="submit"]');
        const clickedButton = document.activeElement;
        const tourCard = clickedButton?.closest('.preorderCard') || 
                        clickedButton?.closest('.travelCard') || 
                        clickedButton?.closest('[data-tour-id]') ||
                        submitButton?.closest('.preorderCard') ||
                        submitButton?.closest('.travelCard') ||
                        submitButton?.closest('[data-tour-id]');
        if (tourCard) {
            const tourId = tourCard.getAttribute('data-tour-id') || 
                          clickedButton?.getAttribute('data-tour-id') ||
                          submitButton?.getAttribute('data-tour-id');
            if (tourId) {
                data.tour_id = parseInt(tourId);
            }
        }

        // Проверяем обязательные поля (кроме формы подписки)
        const isSubscriptionForm = form.id === 'subscription-form' || form.classList.contains('subscription-form');
        if (!isSubscriptionForm && (!data.name || !data.phone)) {
            submittingForms.delete(form);
            if (!data.name && !data.phone && !data.email && !data.direction && !data.message) {
                return true;
            }
            setTimeout(() => {
                if (typeof showWarning !== 'undefined') {
                    showWarning('Пожалуйста, заполните имя и телефон');
                } else {
                    alert('Пожалуйста, заполните имя и телефон');
                }
            }, 0);
            return true;
        }

        // Отправляем на наш API
        try {
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
        const originalText = submitBtn?.textContent || 'Отправить';
            
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Отправка...';
            }

            const response = await fetch(`${API_URL}/applications`, {
                method: 'POST',
            headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                if (typeof showSuccess !== 'undefined') {
                    showSuccess('Спасибо! Ваша заявка успешно отправлена. Мы свяжемся с вами в ближайшее время.');
                } else {
                    alert('Спасибо! Ваша заявка успешно отправлена. Мы свяжемся с вами в ближайшее время.');
                }
                form.reset();
                
                // Очищаем все ошибки валидации
                form.querySelectorAll('.field-error').forEach(field => {
                    if (typeof clearFieldError !== 'undefined') {
                        clearFieldError(field);
                    }
                });
                
                // Закрываем модальное окно, если оно открыто
                const modal = form.closest('.t-popup');
                if (modal) {
                    // Используем функцию Tilda для правильного закрытия
                    if (typeof t1093__closePopup !== 'undefined') {
                        // Находим хук попапа
                        const hook = modal.getAttribute('data-tooltip-hook') || '#preorder';
                        const openPopupList = window.tPopupObj?.openPopUpList || [];
                        const popupIndex = openPopupList.indexOf(hook);
                        if (popupIndex !== -1) {
                            t1093__closePopup(false, popupIndex, true);
                        } else {
                            // Если не нашли в списке, закрываем напрямую
                            closePopupManually(modal);
                        }
                    } else {
                        // Fallback: закрываем вручную
                        closePopupManually(modal);
                    }
                }
            } else {
                if (typeof showError !== 'undefined') {
                    showError('Ошибка отправки заявки: ' + (result.error || 'Попробуйте позже'));
                } else {
                    alert('Ошибка отправки заявки: ' + (result.error || 'Попробуйте позже'));
                }
            }

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        
        // Удаляем флаг через небольшую задержку
        setTimeout(() => {
            submittingForms.delete(form);
        }, 2000);
        } catch (error) {
            console.error('Ошибка отправки формы:', error);
            if (typeof showError !== 'undefined') {
                showError('Ошибка подключения к серверу. Пожалуйста, попробуйте позже.');
            } else {
                alert('Ошибка подключения к серверу. Пожалуйста, попробуйте позже.');
            }
            
        const submitBtn = form.querySelector('button[type="submit"]') || form.querySelector('input[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Отправить';
        }
        
        // Удаляем флаг при ошибке
        submittingForms.delete(form);
    }
    
    return true; // Форма обработана
}

// Перехват AJAX запросов Tilda
function interceptTildaAjax() {
    // Отслеживаем активную форму перед отправкой
    let activeForm = null;
    
    // Отслеживаем клики по кнопкам отправки для определения активной формы
    document.addEventListener('click', function(e) {
        const button = e.target.closest('button[type="submit"], input[type="submit"], .t-submit');
        const form = button?.closest('form');
        if (form) {
            activeForm = form;
            setTimeout(() => { activeForm = null; }, 1000);
        }
    }, true);
    
    // Перехватываем XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this._url = url;
        this._method = method;
        return originalXHROpen.apply(this, [method, url, ...args]);
    };
    
    XMLHttpRequest.prototype.send = function(data) {
        // Проверяем, является ли это запросом формы Tilda
        if (this._url && (this._url.includes('tilda.cc') || this._url.includes('tilda.ws') || this._url.includes('tildacdn.com'))) {
            let formToHandle = activeForm;
            
            if (!formToHandle) {
                formToHandle = Array.from(document.querySelectorAll('form')).find(f => isTildaForm(f));
            }
            
            if (formToHandle && !submittingForms.has(formToHandle)) {
                handleFormSubmit(formToHandle, null);
                return;
            }
        }
        return originalXHRSend.apply(this, [data]);
    };
    
    // Перехватываем fetch
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        const urlString = typeof url === 'string' ? url : url.toString();
        // Проверяем, является ли это запросом формы Tilda
        if (urlString && (urlString.includes('tilda.cc') || urlString.includes('tilda.ws') || urlString.includes('tildacdn.com'))) {
            let formToHandle = activeForm;
            
            if (!formToHandle) {
                formToHandle = Array.from(document.querySelectorAll('form')).find(f => isTildaForm(f));
            }
            
            if (formToHandle && !submittingForms.has(formToHandle)) {
                handleFormSubmit(formToHandle, null);
                return Promise.reject(new Error('Tilda form intercepted'));
            }
        }
        return originalFetch.apply(this, [url, options]);
    };
}

// Перехват отправки форм Tilda и отправка на наш API
function interceptTildaForms() {
    // Перехватываем AJAX запросы Tilda
    interceptTildaAjax();
    
    // Перехватываем событие submit на этапе capture
    document.addEventListener('submit', async function(e) {
        const form = e.target;
        if (form && form.tagName === 'FORM') {
            await handleFormSubmit(form, e);
        }
    }, true);
    
    // Перехватываем клики по кнопкам отправки
    document.addEventListener('click', async function(e) {
        const button = e.target.closest('button[type="submit"], input[type="submit"], .t-submit, button[class*="submit" i], [onclick*="submit" i]');
        let form = button?.closest('form');
        if (!form && button?.tagName === 'BUTTON' && button.type !== 'button') {
            form = document.querySelector('form');
        }

        if (form) {
            if (submittingForms.has(form)) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return;
            }
            
            if (isTildaForm(form)) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                await handleFormSubmit(form, e);
                return false;
            }
        }
    }, true); // capture phase
    
    // Отключаем стандартную отправку форм Tilda
    const disableTildaFormActions = () => {
        document.querySelectorAll('form').forEach(form => {
            if (isTildaForm(form)) {
                if (form.action && (form.action.includes('tilda') || form.action.includes('tildacdn'))) {
                    form.removeAttribute('action');
                    form.setAttribute('action', 'javascript:void(0);');
                }
                form.onsubmit = function(e) {
                    if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                    }
                    handleFormSubmit(form, e);
                    return false;
                };
                form.addEventListener('submit', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    handleFormSubmit(form, e);
                }, true);
            }
        });
    };
    
    // Вызываем сразу и повторяем после загрузки Tilda
    disableTildaFormActions();
    
    // Наблюдаем за динамически создаваемыми формами
    const formObserver = new MutationObserver(function(mutations) {
        let shouldDisable = false;
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) { // Element node
                    if (node.tagName === 'FORM' || node.querySelector('form')) {
                        shouldDisable = true;
                    }
                }
            });
        });
        if (shouldDisable) disableTildaFormActions();
    });
    
    // Наблюдаем за изменениями в DOM
    formObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Ждем инициализации Tilda форм и повторяем
    if (typeof t_onReady !== 'undefined') {
        t_onReady(() => {
            [500, 1500, 3000].forEach(delay => setTimeout(disableTildaFormActions, delay));
        });
    } else {
        [1000, 2000, 4000].forEach(delay => setTimeout(disableTildaFormActions, delay));
    }
}

// Обработка кликов по кнопкам "Подробнее" на карточках туров
function setupTourCardButtons() {
    document.addEventListener('click', function(e) {
        const button = e.target.closest('a[href="#preorder"]');
        if (!button) return;

        const tourId = button.getAttribute('data-tour-id') || 
                      button.closest('.preorderCard')?.getAttribute('data-tour-id') ||
                      button.closest('.travelCard')?.getAttribute('data-tour-id');
        
        if (tourId) {
            // Сохраняем ID тура для формы
            sessionStorage.setItem('selectedTourId', tourId);
        }
    });
}

// Инициализация перехвата форм - запускаем СРАЗУ, до загрузки Tilda
// Это критично, чтобы перехватить формы до того, как Tilda их инициализирует
interceptTildaForms();

// Инициализация при загрузке страницы
// Удаление статических карточек при инициализации
function removeStaticCardsOnInit() {
    // Удаляем статические карточки из сетки (только те, что не помечены как динамические)
    const travelGridContainer = document.querySelector('[data-group-id="175278397639235650"]');
    if (travelGridContainer) {
        const staticTravelCards = travelGridContainer.querySelectorAll('.travelCard:not([data-dynamic-card="true"])');
        staticTravelCards.forEach(card => {
            // Дополнительная проверка - удаляем только если карточка действительно статическая
            if (!card.hasAttribute('data-dynamic-card')) {
                card.remove();
            }
        });
    }
    
    // Удаляем статические карточки из Swiper слайдера
    const swiperWrapper = document.querySelector('.swiper-wrapper');
    if (swiperWrapper) {
        const staticCards = swiperWrapper.querySelectorAll('.preorderCard:not([data-dynamic-card="true"])');
        staticCards.forEach(card => {
            // Дополнительная проверка - удаляем только если карточка действительно статическая
            if (!card.hasAttribute('data-dynamic-card')) {
                card.remove();
            }
        });
        
        // Удаляем статические слайды
        swiperWrapper.querySelectorAll('.swiper-slide').forEach(slide => {
            const staticCard = slide.querySelector('.preorderCard:not([data-dynamic-card="true"])');
            if (staticCard && !staticCard.hasAttribute('data-dynamic-card')) {
                slide.remove();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Проверяем, не находимся ли мы на странице all-tours.html
    const isAllToursPage = window.location.pathname.includes('all-tours.html');
    
    if (isAllToursPage) {
        console.log('DOMContentLoaded: страница all-tours.html, пропускаем автоматическую загрузку туров');
        // На странице all-tours.html загрузка туров происходит через loadAllTours()
        // Просто инициализируем вспомогательные функции
        interceptTildaForms();
        setupTourCardButtons();
        return;
    }
    
    console.log('DOMContentLoaded: инициализация загрузки туров');
    
    // Удаляем статические карточки сразу при загрузке страницы
    removeStaticCardsOnInit();
    
    const waitForSwiper = () => {
        const swiperWrapper = document.querySelector('.swiper-wrapper');
        const travelGridContainer = document.querySelector('[data-group-id="175278397639235650"]');
        
        console.log('Проверка контейнеров:', {
            swiperWrapper: !!swiperWrapper,
            travelGridContainer: !!travelGridContainer
        });
        
        if (swiperWrapper || travelGridContainer) {
            console.log('Загружаем все туры через loadToursFromAPI()');
            loadToursFromAPI();
        } else {
            console.log('Контейнеры не найдены, повторная попытка через 500ms');
            setTimeout(waitForSwiper, 500);
        }
    };
    
    setTimeout(waitForSwiper, 1000);
    
    if (typeof t_onReady !== 'undefined') {
        t_onReady(() => {
            console.log('t_onReady: повторная попытка загрузки туров');
            setTimeout(waitForSwiper, 500);
        });
    }
    
    interceptTildaForms();
    setupTourCardButtons();
    
    // Наблюдаем за изменениями стилей карточек и новыми карточками
    const styleObserver = new MutationObserver((mutations) => {
        let shouldProtect = false;
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const target = mutation.target;
                if (target.hasAttribute('data-dynamic-card') || target.hasAttribute('data-dynamic-slide')) {
                    shouldProtect = true;
                }
            } else if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        if (node.hasAttribute('data-dynamic-card') || node.querySelector('[data-dynamic-card]')) {
                            shouldProtect = true;
                            // Наблюдаем за новой карточкой
                            if (node.hasAttribute('data-dynamic-card')) {
                                styleObserver.observe(node, {
                                    attributes: true,
                                    attributeFilter: ['style', 'class']
                                });
                                node._observed = true;
                            }
                        }
                        // Также проверяем слайды
                        if (node.hasAttribute('data-dynamic-slide')) {
                            shouldProtect = true;
                        }
                    }
                });
            }
        });
        if (shouldProtect) {
            protectDynamicCards();
            protectDynamicSlides();
            // Обновляем наблюдение за новыми карточками
            document.querySelectorAll('[data-dynamic-card="true"]').forEach(card => {
                if (!card._observed) {
                    styleObserver.observe(card, {
                        attributes: true,
                        attributeFilter: ['style', 'class']
                    });
                    card._observed = true;
                }
            });
            // Обновляем наблюдение за новыми слайдами
            document.querySelectorAll('[data-dynamic-slide="true"]').forEach(slide => {
                if (!slide._observed) {
                    styleObserver.observe(slide, {
                        attributes: true,
                        attributeFilter: ['style', 'class']
                    });
                    slide._observed = true;
                }
            });
        }
    });
    
    // Наблюдаем за контейнерами карточек и самими карточками
    const containers = document.querySelectorAll('.swiper-wrapper, [data-group-id="175278397639235650"]');
    containers.forEach(container => {
        styleObserver.observe(container, {
            childList: true,
            subtree: true
        });
    });
    
    // Наблюдаем за всеми существующими динамическими карточками
    document.querySelectorAll('[data-dynamic-card="true"]').forEach(card => {
        styleObserver.observe(card, {
            attributes: true,
            attributeFilter: ['style', 'class']
        });
        card._observed = true;
    });
    
    // Наблюдаем за всеми существующими динамическими слайдами
    document.querySelectorAll('[data-dynamic-slide="true"]').forEach(slide => {
        styleObserver.observe(slide, {
            attributes: true,
            attributeFilter: ['style', 'class']
        });
        slide._observed = true;
    });
    
    // Периодически проверяем и защищаем карточки и слайды (чаще для preorderCard)
    setInterval(() => {
        protectDynamicCards();
        protectDynamicSlides();
    }, 300);

    // Защищаем при скролле
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            protectDynamicCards();
            protectDynamicSlides();
        }, 100);
    }, { passive: true });

    // Защищаем при ресайзе
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            protectDynamicCards();
            protectDynamicSlides();
        }, 100);
    }, { passive: true });
    
    setTimeout(() => {
        const tourId = sessionStorage.getItem('selectedTourId');
        if (tourId) sessionStorage.removeItem('selectedTourId');
    }, 2000);
});

// Экспортируем функции для использования в других скриптах
window.tourAPI = {
    loadTours: loadToursFromAPI,
    createPreorderCard: createPreorderCard,
    createTravelCard: createTravelCard,
    loadToursToSwiper: loadToursToSwiper,
    loadToursToGrid: loadToursToGrid
};

// Делаем функции глобальными для доступа из других скриптов
window.loadToursToSwiper = loadToursToSwiper;
window.loadToursToGrid = loadToursToGrid;
window.loadToursFromAPI = loadToursFromAPI;
window.protectDynamicCards = protectDynamicCards;
window.initTravelCardAnimations = initTravelCardAnimations;
window.setupTourCardButtons = setupTourCardButtons;
window.createTravelCard = createTravelCard;
window.setupCardHover = setupCardHover;
window.initLazyImage = initLazyImage;

