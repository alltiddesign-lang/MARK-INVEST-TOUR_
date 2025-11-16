// Обработка подписки на уведомления о новых турах
// Оборачиваем в IIFE, чтобы не засорять глобальную область и не конфликтовать с другими скриптами
(function () {
const API_URL = window.API_URL || '/api';

// Инициализация формы подписки
function initSubscriptionForm() {
    const subscriptionForm = document.getElementById('subscription-form');
    if (!subscriptionForm) return;
    
    const emailInput = subscriptionForm.querySelector('input[type="email"]');
    
    // Предотвращаем автоматическую прокрутку браузера при валидации HTML5
    if (emailInput) {
        let isPreventingScroll = false;
        
        // Переопределяем scrollIntoView, чтобы предотвратить автоматическую прокрутку
        const originalScrollIntoView = emailInput.scrollIntoView;
        emailInput.scrollIntoView = function() {
            if (!isPreventingScroll) {
                // Разрешаем прокрутку только если мы не предотвращаем её
                if (originalScrollIntoView) {
                    originalScrollIntoView.apply(this, arguments);
                }
            }
            // Иначе игнорируем вызов - не прокручиваем
        };
        
        // Переопределяем reportValidity для предотвращения прокрутки браузера
        if (emailInput.reportValidity) {
            const originalReportValidity = emailInput.reportValidity.bind(emailInput);
            emailInput.reportValidity = function() {
                if (!emailInput.validity.valid) {
                    isPreventingScroll = true;
                    const scrollPosition = window.scrollY || window.pageYOffset;
                    
                    // Вызываем оригинальный метод, но сразу восстанавливаем прокрутку
                    const result = originalReportValidity();
                    
                    // Восстанавливаем позицию прокрутки
                    requestAnimationFrame(() => {
                        window.scrollTo({
                            top: scrollPosition,
                            behavior: 'instant'
                        });
                        isPreventingScroll = false;
                    });
                    
                    return result;
                }
                return originalReportValidity();
            };
        }
        
        // Предотвращаем прокрутку при валидации HTML5 (событие invalid)
        emailInput.addEventListener('invalid', (e) => {
            isPreventingScroll = true;
            // Сохраняем текущую позицию прокрутки
            const scrollPosition = window.scrollY || window.pageYOffset;
            
            // Восстанавливаем позицию прокрутки после короткой задержки
            requestAnimationFrame(() => {
                window.scrollTo({
                    top: scrollPosition,
                    behavior: 'instant'
                });
                isPreventingScroll = false;
            });
        }, { passive: false });
    }
    
    subscriptionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation(); // Предотвращаем всплытие события
        
        const submitButton = subscriptionForm.querySelector('button[type="submit"]');
        const email = emailInput ? emailInput.value.trim() : '';
        
        // Сохраняем текущую позицию прокрутки перед валидацией
        const scrollPosition = window.scrollY || window.pageYOffset;
        
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            if (typeof showFieldError !== 'undefined') {
                showFieldError(emailInput, 'Введите корректный email адрес');
            } else if (typeof showWarning !== 'undefined') {
                showWarning('Введите корректный email адрес');
            } else {
                alert('Введите корректный email адрес');
            }
            
            // Восстанавливаем позицию прокрутки сразу после показа ошибки
            requestAnimationFrame(() => {
                window.scrollTo({
                    top: scrollPosition,
                    behavior: 'instant'
                });
            });
            
            return;
        }
        
        // Блокируем кнопку
        if (submitButton) {
            submitButton.disabled = true;
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Подписка...';
            
            try {
                const response = await fetch(`${API_URL}/subscriptions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    if (typeof showSuccess !== 'undefined') {
                        showSuccess('Спасибо! Вы успешно подписались на уведомления о новых турах.');
                    } else {
                        alert('Спасибо! Вы успешно подписались на уведомления о новых турах.');
                    }
                    subscriptionForm.reset();
                    
                    // Очищаем ошибки валидации
                    if (typeof clearFieldError !== 'undefined') {
                        clearFieldError(emailInput);
                    }
                } else {
                    if (typeof showError !== 'undefined') {
                        showError(result.error || 'Ошибка при подписке');
                    } else {
                        alert(result.error || 'Ошибка при подписке');
                    }
                }
            } catch (error) {
                console.error('Ошибка подписки:', error);
                if (typeof showError !== 'undefined') {
                    showError('Ошибка подключения к серверу');
                } else {
                    alert('Ошибка подключения к серверу');
                }
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = originalText;
                }
            }
        }
    });
    
    // Инициализируем валидацию
    if (typeof initFormValidation !== 'undefined') {
        initFormValidation(subscriptionForm);
    }
}

// Инициализация при загрузке страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSubscriptionForm);
} else {
    initSubscriptionForm();
}

// Экспортируем функцию в глобальную область, если нужно вызывать из других скриптов
window.initSubscriptionForm = initSubscriptionForm;
})();

