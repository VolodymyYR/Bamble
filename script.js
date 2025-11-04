document.addEventListener('DOMContentLoaded', () => {
    // =======================================================
    // 0. ГЛОБАЛЬНІ КОНСТАНТИ ТА ЕЛЕМЕНТИ
    // =======================================================
    const BACKEND_URL = 'http://localhost:3000'; // Адреса, де запущено Node.js бекенд

    // Елементи Модалки (потрібні для секції 1)
    const contactModal = document.getElementById('contactModal');
    const closeModalButton = document.getElementById('closeModalButton');
    const openModalButton = document.getElementById('openContactModal'); 
    
    // Елементи Форми (потрібні для секції 3)
    const form = document.getElementById('orderForm');
    const citySelect = document.getElementById('city');
    const warehouseSelect = document.getElementById('warehouse');
    const submitButton = form ? form.querySelector('.submit-button-class') : null; 
    
    // Перевірка на існування елементів форми
    const formElementsExist = form && citySelect && warehouseSelect && submitButton; 
    
    // =======================================================
    // 4. ФУНКЦІОНАЛ ДЛЯ МЕНЕДЖЕРА (ВИВЕДЕНО НА ПОЧАТОК ДЛЯ УНИКНЕННЯ ReferenceError)
    // =======================================================

    const ORDER_STATUSES = ['Нове', 'В обробці', 'В доставці', 'Виконано', 'Скасовано'];

    /**
     * Генерує колір для статусу.
     */
    function getStatusColor(status) {
        switch (status) {
            case 'Нове':
                return '#FF4B3A'; // Акцентний колір
            case 'В обробці':
                return '#FFC107'; // Жовтий
            case 'В доставці':
                return '#2196F3'; // Синій
            case 'Виконано':
                return '#4CAF50'; // Зелений
            case 'Скасовано':
                return '#F44336'; // Червоний
            default:
                return '#4A4A4A'; // Додатковий сірий
        }
    }

    /**
     * Оновлює статус замовлення через API без alert()/confirm().
     */
    async function updateOrderStatus(orderId, newStatus, selectElement) {
        const originalStatus = selectElement.getAttribute('data-original-status') || selectElement.value;
        const row = selectElement.closest('tr');
        
        selectElement.disabled = true;
        selectElement.style.borderColor = '#2196F3'; 
        if (row) row.style.backgroundColor = 'rgba(33, 150, 243, 0.1)';

        try {
            const response = await fetch(`${BACKEND_URL}/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newStatus })
            });
            
            // Якщо сервер повернув 500, result.json() може кинути помилку синтаксису, тому обробляємо акуратно.
            const result = response.ok ? await response.json() : { success: false };

            if (response.ok && result.success) {
                // УСПІХ: Встановлюємо новий статус та колір
                selectElement.setAttribute('data-original-status', newStatus);
                selectElement.style.borderColor = getStatusColor(newStatus);
                selectElement.style.boxShadow = `0 0 5px ${getStatusColor(newStatus)}`;
                if (row) row.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';

            } else {
                // ПОМИЛКА: Відновлюємо початковий статус і показуємо червону рамку
                selectElement.value = originalStatus;
                selectElement.style.borderColor = '#F44336';
                selectElement.style.boxShadow = '0 0 5px #F44336';
                if (row) row.style.backgroundColor = 'rgba(244, 67, 54, 0.1)'; 
                console.error('Помилка оновлення статусу:', result.message || 'Невідома помилка.');
            }

        } catch (error) {
            // ПОМИЛКА МЕРЕЖІ: Відновлюємо початковий статус
            selectElement.value = originalStatus;
            selectElement.style.borderColor = '#F44336';
            selectElement.style.boxShadow = '0 0 5px #F4436';
            if (row) row.style.backgroundColor = 'rgba(244, 67, 54, 0.1)'; 
            console.error('Помилка мережі при оновленні статусу:', error);
        } finally {
            setTimeout(() => {
                selectElement.disabled = false;
                selectElement.style.boxShadow = 'none';
                if (row) row.style.backgroundColor = '';
                selectElement.style.borderColor = getStatusColor(selectElement.value); 
            }, 1500);
        }
    }

    /**
     * Видаляє замовлення через API. Має лише ОДНЕ підтвердження (confirm).
     */
    async function deleteOrder(orderId) {
        if (!confirm(`Ви впевнені, що хочете видалити замовлення ID ${orderId}? Цю дію не можна скасувати!`)) {
            return; 
        }
        
        const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
        
        if (row) {
            row.style.transition = 'background-color 0.3s, opacity 0.5s';
            row.style.opacity = 0.5;
            row.style.backgroundColor = 'rgba(244, 67, 54, 0.3)';
        }

        try {
            const response = await fetch(`${BACKEND_URL}/api/orders/${orderId}`, {
                method: 'DELETE'
            });
            
            const result = response.ok ? await response.json() : { success: false };

            if (response.ok && result.success) {
                if (row) {
                    row.style.opacity = 0;
                    setTimeout(loadOrdersForManager, 500); 
                } else {
                    loadOrdersForManager();
                }
            } else {
                if (row) {
                    row.style.opacity = 1;
                    row.style.backgroundColor = 'rgba(255, 100, 100, 0.5)';
                }
                console.error('Помилка видалення:', result.message || 'Невідома помилка.');
                setTimeout(() => { if (row) row.style.backgroundColor = ''; }, 1500);
            }

        } catch (error) {
            if (row) {
                row.style.opacity = 1;
                row.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
            }
            console.error('Помилка мережі при видаленні замовлення:', error);
            setTimeout(() => { if (row) row.style.backgroundColor = ''; }, 2000);
        }
    }


    /**
     * Завантажує та відображає замовлення в таблиці.
     */
    async function loadOrdersForManager() {
        const ordersContainer = document.getElementById('ordersList'); 
        if (!ordersContainer) return;

        ordersContainer.innerHTML = 'Завантаження замовлень...';

        try {
            const response = await fetch(`${BACKEND_URL}/api/orders`);
            const result = await response.json();

            if (response.ok && result.success && result.data && result.data.length > 0) {
                
                let html = '<h3 style="margin-bottom: 15px;">Список замовлень</h3>';
                html += '<table id="managerOrdersTable" style="width:100%; border-collapse: collapse; font-size: 14px;">';
                
                // Заголовки таблиці
                html += '<tr style="background-color: #f2f2f2;"><th>ID</th><th>Ім\'я</th><th>Телефон</th><th>Місто</th><th>Відділення</th><th>Стілець</th><th>Розмір</th><th>Дата</th><th>Статус</th><th>Дії</th></tr>';
                
                // Рядки з даними
                result.data.forEach(order => {
                    // !!! ВИПРАВЛЕННЯ: Додано timeZone: 'Europe/Kyiv'
                    const date = new Date(order.formatted_timestamp).toLocaleString('uk-UA', { 
                        year: 'numeric', month: '2-digit', day: '2-digit', 
                        hour: '2-digit', minute: '2-digit',
                        timeZone: 'Europe/Kyiv' // <--- ФІКС ЧАСУ
                    });

                    // Створюємо SELECT для зміни статусу
                    let statusSelect = `<select class="status-select" data-order-id="${order.id}" style="border: 1px solid ${getStatusColor(order.status)}; color: #000; background-color: #FFF; padding: 5px; border-radius: 4px;">`;
                    
                    ORDER_STATUSES.forEach(status => {
                        const selected = order.status === status ? 'selected' : '';
                        statusSelect += `<option value="${status}" ${selected}>${status}</option>`;
                    });
                    statusSelect += '</select>';

                    html += `<tr data-order-id="${order.id}">
                                 <td>${order.id}</td>
                                 <td>${order.name}</td>
                                 <td>${order.phone}</td>
                                 <td>${order.city}</td>
                                 <td>${order.warehouse}</td>
                                 <td>${order.chair}</td>
                                 <td>${order.size}</td>
                                 <td>${date}</td>
                                 <td>${statusSelect}</td>
                                 <td>
                                     <button class="delete-btn" data-order-id="${order.id}" style="background-color: #F44336; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px;">❌ Видалити</button>
                                 </td>
                             </tr>`;
                });

                html += '</table>';
                ordersContainer.innerHTML = html;

                // --- ДОДАЄМО СЛУХАЧІ ПОДІЙ ---
                const table = document.getElementById('managerOrdersTable');
                if (table) {
                    // Слухач для зміни статусу (SELECT)
                    table.querySelectorAll('.status-select').forEach(select => {
                        select.setAttribute('data-original-status', select.value); 
                        select.style.borderColor = getStatusColor(select.value); 

                        select.addEventListener('change', (e) => {
                            const selectElement = e.target;
                            const orderId = selectElement.getAttribute('data-order-id');
                            const newStatus = selectElement.value;
                            updateOrderStatus(orderId, newStatus, selectElement); 
                        });
                    });

                    // Слухач для кнопки видалення
                    table.querySelectorAll('.delete-btn').forEach(button => {
                        button.addEventListener('click', (e) => {
                            const orderId = e.target.getAttribute('data-order-id');
                            deleteOrder(orderId);
                        });
                    });
                }

            } else if (result.data && result.data.length === 0) {
                ordersContainer.innerHTML = '<p>Наразі замовлення відсутні.</p>';
            } else {
                ordersContainer.innerHTML = `<p>Помилка завантаження: ${result.message || 'Невідома помилка'}</p>`;
            }

        } catch (error) {
            console.error('Помилка мережі при завантаженні замовлень:', error);
            ordersContainer.innerHTML = '<p>Помилка з\'єднання з бекендом.</p>';
        }
    }


    // --- БЛОК ІНІЦІАЛІЗАЦІЇ МЕНЕДЖЕРА ---
    const ordersContainer = document.getElementById('ordersList');
    const SECRET_KEY = "1234"; 

    if (ordersContainer) { // Викликається лише на сторінці менеджера
        const password = prompt("Введіть пароль менеджера для доступу:");

        if (password === SECRET_KEY) {
            loadOrdersForManager(); // ВИКЛИК ПІСЛЯ ОГОЛОШЕННЯ ФУНКЦІЇ
        } else {
            ordersContainer.innerHTML = '<h3 style="color: red;">Відмовлено в доступі. Невірний пароль.</h3>';
        }
    }


    // =======================================================
    // 1. МОДАЛЬНЕ ВІКНО КОНТАКТІВ
    // (Залишено, як у вашому коді)
    // =======================================================

    // ... (весь код функції showPopup, hidePopup, handleScroll) ...
    const popup = document.getElementById('randomOrderPopup');
    const messageElement = document.getElementById('popupMessage');
    let isPopupVisible = false;

    // --- Випадкові дані ---
    const names = ['Софія', 'Олександр', 'Марія', 'Дмитро', 'Катерина', 'Андрій'];
    const cities = ['Ужгорода', 'Львова', 'Києва', 'Одеси', 'Харкова', 'Дніпра'];
    const products = [
        { name: 'подушка синьо-сіра', gender: 'f' },
        { name: 'чашка з логотипом', gender: 'n' },
        { name: 'світшот чорний', gender: 'm' },
        { name: 'набір свічок', gender: 'm' },
        { name: 'футболка біла', gender: 'f' }
    ];

    function generateRandomMessage() {
        const randomName = names[Math.floor(Math.random() * names.length)];
        const randomCity = cities[Math.floor(Math.random() * cities.length)];
        const randomProduct = products[Math.floor(Math.random() * products.length)];
        
        const nameEndsWithA = randomName.endsWith('а') || randomName.endsWith('я');
        const verbEnding = nameEndsWithA ? 'ла' : 'в';
        const verb = `зроби${verbEnding}`;
        
        const productUnit = randomProduct.gender === 'n' ? 'шт.' : 'шт.';

        return `${randomName} з ${randomCity} ${verb} замовлення: ${randomProduct.name} — 1 ${productUnit}.`;
    }

    function showPopup() {
        if (isPopupVisible) return;
        
        messageElement.textContent = generateRandomMessage();
        popup.classList.add('visible');
        isPopupVisible = true;

        const hideDelay = 2500 + Math.random() * 3000;
        setTimeout(hidePopup, hideDelay);
    }

    function hidePopup() {
        popup.classList.remove('visible');
        isPopupVisible = false;
    }

    function handleScroll() {
        if (isPopupVisible) return;

        const appearanceChance = 0.05; 
        
        if (Math.random() < appearanceChance) {
            const randomDelay = 500 + Math.random() * 1500;
            setTimeout(showPopup, randomDelay);
        }
    }

    window.addEventListener('scroll', handleScroll);


    function closeModal() {
        if (contactModal) {
            contactModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    if (contactModal) {
        function openModal() {
            contactModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        if (openModalButton) {
            openModalButton.addEventListener('click', openModal);
        }
        if (closeModalButton) {
            closeModalButton.addEventListener('click', closeModal);
        }
        contactModal.addEventListener('click', (event) => {
            if (event.target === contactModal) {
                closeModal();
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && contactModal.classList.contains('active')) {
                closeModal();
            }
        });
    }


    // =======================================================
    // 2. УНІВЕРСАЛЬНИЙ СЛАЙДЕР (FADE/SCROLL)
    // (Залишено, як у вашому коді)
    // =======================================================

    function initializeSlider(sliderContainer) {
        const slides = sliderContainer.querySelectorAll('.slider-image');
        const sliderWrapper = sliderContainer.querySelector('.reviews-block__slider-wrapper') || sliderContainer.querySelector('.bloggers-block__slider-wrapper'); 
        const prevButton = sliderContainer.querySelector('.navigation-buttons__prev');
        const nextButton = sliderContainer.querySelector('.navigation-buttons__next');
        
        if (!slides.length || !prevButton || !nextButton) return;

        const isFadeSlider = sliderContainer.classList.contains('dimensions') || sliderContainer.classList.contains('catalog-slider');
        const isScrollSlider = sliderContainer.classList.contains('reviews-block') || sliderContainer.classList.contains('bloggers-block');
        const isBloggerSlider = sliderContainer.classList.contains('bloggers-block');
        
        let currentIndex = 0;
        let isTransitioning = false;
        
        if (isFadeSlider) {
            slides.forEach((slide, index) => {
                if (index === 0) {
                    slide.style.display = 'block';
                    slide.style.opacity = '1';
                } else {
                    slide.style.display = 'none';
                    slide.style.opacity = '0';
                }
            });
        }
        
        function updateFadeSlider() {
            if (isTransitioning) return;
            isTransitioning = true;

            const currentSlide = slides[currentIndex];

            slides.forEach(slide => {
                slide.style.opacity = '0';
                
                slide.addEventListener('transitionend', function handler() {
                    if (this !== slides[currentIndex]) {
                        this.style.display = 'none';
                    }
                    this.removeEventListener('transitionend', handler);
                });
            });

            setTimeout(() => {
                currentSlide.style.display = 'block'; 
                setTimeout(() => { 
                    currentSlide.style.opacity = '1';
                }, 50); 
            }, 0); 


            currentSlide.addEventListener('transitionend', function handler() {
                isTransitioning = false;
                this.removeEventListener('transitionend', handler);
            });
            
            if (!currentSlide.style.transitionDuration || parseFloat(getComputedStyle(currentSlide).transitionDuration) === 0) {
                isTransitioning = false;
            }
        }
        
        if (isScrollSlider) {
            const slide = slides[0];
            const slideWidth = slide.offsetWidth;
            const gap = parseFloat(getComputedStyle(slide.parentElement).gap || 0);

            let scrollAmount;
            if (isBloggerSlider) {
                scrollAmount = (slideWidth * 2) + gap;
            } else {
                scrollAmount = slideWidth + gap;
            }
            
            nextButton.addEventListener('click', () => {
                sliderWrapper.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            });

            prevButton.addEventListener('click', () => {
                sliderWrapper.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            });
            
        } else if (isFadeSlider) {
            prevButton.addEventListener('click', () => {
                if (isTransitioning) return;
                currentIndex = (currentIndex === 0) ? slides.length - 1 : currentIndex - 1;
                updateFadeSlider();
            });

            nextButton.addEventListener('click', () => {
                if (isTransitioning) return;
                currentIndex = (currentIndex === slides.length - 1) ? 0 : currentIndex + 1;
                updateFadeSlider();
            });
        }
    }

    const MAX_IMAGE_HEIGHT = 220; 

    function setupModalButton(slide) {
        const imageContainer = slide.querySelector('.review-slide__image-container');
        const image = slide.querySelector('.review-slide__image');
        const actionArea = slide.querySelector('.review-slide__action-area');
        const button = slide.querySelector('.review-slide__open-modal-button');
        
        if (!imageContainer || !image || !actionArea || !button) return;

        const checkHeight = () => {
            const isOverflowing = image.naturalHeight > MAX_IMAGE_HEIGHT;
            actionArea.style.display = isOverflowing ? 'flex' : 'none';

            const fadeOverlay = slide.querySelector('.review-slide__fade-overlay');
            if (fadeOverlay) {
                fadeOverlay.style.opacity = isOverflowing ? 0.8 : 0;
            }
        };

        if (image.complete) {
            checkHeight();
        } else {
            image.onload = checkHeight;
        }
    }


    function initializeReviewModals() {
        const modalOverlay = document.getElementById('reviewModal');
        const modalImage = document.getElementById('reviewModalImage');
        const closeModalBtn = document.getElementById('closeReviewModal');
        const allSlides = document.querySelectorAll('.review-slide');

        if (!modalOverlay || !modalImage || !closeModalBtn) return;
        
        allSlides.forEach(setupModalButton); 

        function openReviewModal(imageUrl) {
            modalImage.src = imageUrl;
            modalOverlay.classList.add('active');
            document.body.style.overflow = 'hidden'; 
        }

        function closeReviewModal() {
            modalOverlay.classList.remove('active');
            document.body.style.overflow = '';
            modalImage.src = ''; 
        }

        allSlides.forEach(slide => {
            const button = slide.querySelector('.review-slide__open-modal-button');
            if (button) {
                button.addEventListener('click', () => {
                    const imageUrl = button.getAttribute('data-image-url');
                    if (imageUrl) {
                        openReviewModal(imageUrl);
                    }
                });
            }
        });

        closeModalBtn.addEventListener('click', closeReviewModal);
        modalOverlay.addEventListener('click', (event) => {
            if (event.target === modalOverlay) {
                closeReviewModal();
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modalOverlay.classList.contains('active')) {
                closeReviewModal();
            }
        });
    }
    
    const allSliderContainers = document.querySelectorAll('.dimensions, .reviews-block, .bloggers-block, .catalog-slider');
    allSliderContainers.forEach(container => {
        initializeSlider(container);
    });

    initializeReviewModals();
    
    // =======================================================
    // 3. ФОРМА ЗАМОВЛЕННЯ, ТАЙМЕР ТА API НОВОЇ ПОШТИ
    // (Залишено, як у вашому коді)
    // =======================================================

    function updateCustomSelectOptions(selectElement) {
        const customSelect = selectElement.parentNode.querySelector('.custom-select-wrapper');
        const selectedItem = customSelect ? customSelect.querySelector('.custom-select-selected') : null;
        const optionList = customSelect ? customSelect.querySelector('.custom-select-options') : null;

        if (!customSelect || !selectedItem || !optionList) return;

        selectedItem.textContent = selectElement.options[selectElement.selectedIndex]?.textContent || 'Обрати...';

        optionList.innerHTML = ''; 

        const handleOptionClick = (option, optionItem) => {
            // 1. Встановлення значення та виклик події 'change' (залишаємо)
            selectElement.value = option.value;
            
            const event = new Event('change');
            selectElement.dispatchEvent(event);
            
            // 2. >>> ДОДАЙТЕ ЦЕЙ БЛОК ДЛЯ СКИНАННЯ ВІДДІЛЕННЯ ПРИ ВИБОРІ МІСТА
            if (selectElement.id === 'city') {
                warehouseSelect.value = '';
                warehouseSelect.innerHTML = '<option value="" disabled selected>Обрати відділення</option>';
                updateCustomSelectOptions(warehouseSelect); // Оновлюємо візуальний кастомний селект
            }
            // <<< КІНЕЦЬ ДОДАНОГО БЛОКУ
            
            // 3. Візуальне оновлення (залишаємо)
            selectedItem.textContent = option.textContent;
            optionList.querySelector('.selected')?.classList.remove('selected');
            optionItem.classList.add('selected');
            
            optionList.classList.remove('active');
            customSelect.classList.remove('active');
            customSelect.classList.remove('invalid');
        };

        Array.from(selectElement.options).forEach((option, index) => {
            if (option.disabled && index === 0) return; 

            const optionItem = document.createElement('li');
            optionItem.textContent = option.textContent;
            optionItem.setAttribute('data-value', option.value);
            
            if (option.value === selectElement.value) {
                optionItem.classList.add('selected');
            }

            optionItem.addEventListener('click', () => handleOptionClick(option, optionItem));
            
            optionList.appendChild(optionItem);
        });

        if (selectElement.value === "") {
            customSelect.classList.add('invalid');
        } else {
            customSelect.classList.remove('invalid');
        }
    }

    function customizeSelect(selectElement, form) {
        const parentGroup = selectElement.closest('.form-group');
        if (!parentGroup) return;

        if (selectElement.parentNode.querySelector('.custom-select-wrapper')) {
            updateCustomSelectOptions(selectElement);
            return;
        }

        const customSelect = document.createElement('div');
        customSelect.classList.add('custom-select-wrapper');
        customSelect.setAttribute('data-target', selectElement.id);
        customSelect.tabIndex = 0;

        const selectedItem = document.createElement('div');
        selectedItem.classList.add('custom-select-selected');
        selectedItem.textContent = selectElement.options[selectElement.selectedIndex].textContent; 
        customSelect.appendChild(selectedItem);

        const optionList = document.createElement('ul');
        optionList.classList.add('custom-select-options');
        customSelect.appendChild(optionList);

        selectElement.style.display = 'none';
        selectElement.parentNode.insertBefore(customSelect, selectElement);


        selectedItem.addEventListener('click', (e) => {
            e.stopPropagation();
            
            updateCustomSelectOptions(selectElement); 

            if (customSelect.getAttribute('data-disabled') === 'true') {
                return; 
            }

            document.querySelectorAll('.custom-select-wrapper.active').forEach(div => {
                if (div !== customSelect) {
                    div.classList.remove('active');
                    div.querySelector('.custom-select-options')?.classList.remove('active');
                }
            });
            
            optionList.classList.toggle('active');
            customSelect.classList.toggle('active');
            
            if (optionList.classList.contains('active')) {
                optionList.scrollTop = 0;
            }
        });

        document.addEventListener('click', (e) => {
            if (!customSelect.contains(e.target)) {
                optionList.classList.remove('active');
                customSelect.classList.remove('active');
            }
        });

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'class') {
                    if (selectElement.classList.contains('invalid')) {
                        customSelect.classList.add('invalid');
                    } else {
                        customSelect.classList.remove('invalid');
                    }
                }
            });
        });
        observer.observe(selectElement, { attributes: true });
        
        updateCustomSelectOptions(selectElement);
    }

    if (formElementsExist) {
        
        // --- ТАЙМЕР ЗВОРОТНОГО ВІДЛІКУ ---
        const deadline = new Date('November 5, 2025 10:00:00').getTime();

        function updateTimer() {
            const now = new Date().getTime();
            const timeRemaining = deadline - now;

            const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

            const hoursEl = document.getElementById('hours');
            const minutesEl = document.getElementById('minutes');
            const secondsEl = document.getElementById('seconds');
            const timerContainer = document.querySelector('.form-locker__timer');

            if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
            if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
            if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');


            if (timeRemaining < 0) {
                clearInterval(timerInterval);
                if (timerContainer) {
                    timerContainer.innerHTML = '<p style="color:#FFF; font-family: \'Rubik\', sans-serif;">АКЦІЮ ЗАВЕРШЕНО</p>';
                }
            }
        }

        const timerInterval = setInterval(updateTimer, 1000);
        updateTimer(); 


        // --- ВАЛІДАЦІЯ ---
        function validateInput(input) {
            let isValid = true;
            const value = input.value.trim();

            if (input.required && (value === "" || (input.tagName === 'SELECT' && input.value === ""))) {
                isValid = false;
            } 
            else if (input.dataset.validate === 'name' && value.length < 2) {
                isValid = false;
            } 
            else if (input.dataset.validate === 'phone' && !/^(\+38)?0\d{9}$/.test(value.replace(/[\s()-]/g, ''))) {
                isValid = false;
            }

            if (!isValid) {
                input.classList.add('invalid');
            } else {
                input.classList.remove('invalid');
            }
            return isValid;
        }


        // --- ФУНКЦІЇ API НОВОЇ ПОШТИ ---
        async function populateCities() {
            citySelect.innerHTML = '<option value="" disabled selected>Завантаження міст...</option>';
            try {
                const response = await fetch(`${BACKEND_URL}/api/novaposhta/cities`, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                });
                const result = await response.json(); 

                if (response.ok && result.success && result.data && result.data.length > 0) {
                    citySelect.innerHTML = '<option value="" disabled selected>Обрати місто</option>';
                    result.data.forEach(city => {
                        const option = document.createElement('option');
                        option.value = city.Ref; 
                        option.textContent = city.Description; 
                        citySelect.appendChild(option);
                    });
                } else {
                    console.error('Не вдалося завантажити міста з бекенду:', result.message || 'Невідома помилка');
                    citySelect.innerHTML = '<option value="" disabled selected>Не вдалося завантажити міста</option>';
                }
            } catch (error) {
                console.error('Помилка мережі при завантаженні міст:', error);
                citySelect.innerHTML = '<option value="" disabled selected>Помилка завантаження міст</option>';
            }
            citySelect.classList.remove('invalid');

            // !!! ВИКЛИК ПРИ ПЕРЕЗАВАНТАЖЕННІ
            updateCustomSelectOptions(citySelect);
        }

        async function populateWarehouses(selectedCityRef) {
            warehouseSelect.innerHTML = '<option value="" disabled selected>Завантаження відділень...</option>';
            warehouseSelect.disabled = true; 
            
            if (!selectedCityRef) {
                warehouseSelect.innerHTML = '<option value="" disabled selected>Оберіть місто спочатку</option>';
                warehouseSelect.disabled = false;
                updateCustomSelectOptions(warehouseSelect); 
                return;
            }

            try {
                const response = await fetch(`${BACKEND_URL}/api/novaposhta/warehouses`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cityRef: selectedCityRef })
                });
                const result = await response.json();

                if (response.ok && result.success && result.data && result.data.length > 0) {
                    warehouseSelect.innerHTML = '<option value="" disabled selected>Обрати відділення</option>';
                    result.data.forEach(warehouse => {
                        const option = document.createElement('option');
                        option.value = warehouse.Description;
                        option.textContent = warehouse.Description; 
                        warehouseSelect.appendChild(option);
                    });
                } else {
                    console.error('Не вдалося завантажити відділення з бекенду:', result.message || 'Невідома помилка');
                    warehouseSelect.innerHTML = '<option value="" disabled selected>Відділень не знайдено</option>';
                }
            } catch (error) {
                console.error('Помилка мережі при завантаженні відділень:', error);
                warehouseSelect.innerHTML = '<option value="" disabled selected>Помилка завантаження відділень</option>';
            } finally {
                warehouseSelect.disabled = false;
                warehouseSelect.classList.remove('invalid');
                
                updateCustomSelectOptions(warehouseSelect); 
            }
        }
        
        // --- ОБРОБНИКИ ПОДІЙ ФОРМИ ---

        submitButton.addEventListener('click', async function (e) { 
            e.preventDefault(); 
            let formIsValid = true;
            
            if (submitButton) {
                submitButton.disabled = true; 
                submitButton.textContent = 'Оформлення...'; 
            }

            const inputs = form.querySelectorAll('.form-input, .form-select');
            inputs.forEach(input => {
                if (!validateInput(input)) {
                    formIsValid = false;
                }
            });

            if (formIsValid) {
                const formData = {
                    name: document.getElementById('name').value,
                    phone: document.getElementById('phone').value,
                    city: citySelect.options[citySelect.selectedIndex].textContent,
                    warehouse: warehouseSelect.options[warehouseSelect.selectedIndex].textContent,
                    chair: document.getElementById('chair').value,
                    size: document.getElementById('size').value
                };

                try {
                    const response = await fetch(`${BACKEND_URL}/api/orders`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(formData)
                    });
                    
                    const result = await response.json();

                    if (response.ok && result.success) {
                        // Успішне оформлення
                        console.log('Замовлення успішно оформлено. ID: ' + result.orderId);
                        
                        // 1. Скидаємо всі нативні поля форми
                        form.reset(); 
                        
                        // 2. Очищуємо відділення і оновлюємо візуальний кастомний селект
                        warehouseSelect.innerHTML = '<option value="" disabled selected>Обрати відділення</option>';
                        warehouseSelect.value = ''; // Забезпечуємо, що значення буде скинуте
                        updateCustomSelectOptions(warehouseSelect); // !!! ВИПРАВЛЕННЯ: Оновлюємо візуальний дисплей
                        
                        // 3. Перезавантажуємо міста та оновлюємо візуальний кастомний селект міста
                        populateCities().then(() => {
                            // populateCities вже викликає updateCustomSelectOptions для citySelect
                            
                            // Вимикаємо поле відділення візуально
                            const warehouseWrapper = warehouseSelect.closest('.custom-select-wrapper');
                            if (warehouseWrapper) {
                                warehouseWrapper.classList.add('disabled');
                                warehouseWrapper.setAttribute('data-disabled', 'true');
                            }
                        });
                        
                        // 4. Скидаємо та оновлюємо візуально інші кастомні селекти
                        customizeSelect(document.getElementById('chair'), form); 
                        customizeSelect(document.getElementById('size'), form); 

                    } else {
                        const errorMessage = result.message || 'Невідома помилка при оформленні замовлення.';
                        console.error('Помилка при оформленні: ' + errorMessage);
                    }
                } catch (error) {
                    console.error('Помилка мережі або сервера:', error);
                } finally {
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = 'Надіслати замовлення';
                    }
                }
            } else {
                console.error('Будь ласка, заповніть усі поля коректно.');
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Надіслати замовлення';
                }
            }
        });


        citySelect.addEventListener('change', async (e) => {
            const selectedCityRef = e.target.value; 
            await populateWarehouses(selectedCityRef);
            validateInput(citySelect);
            
            const warehouseWrapper = warehouseSelect.closest('.custom-select-wrapper');
            const isCitySelected = citySelect.value && citySelect.value !== '';
            
            if (warehouseWrapper) {
                if (isCitySelected) {
                    warehouseWrapper.classList.remove('disabled');
                    warehouseWrapper.removeAttribute('data-disabled');
                } else {
                    warehouseWrapper.classList.add('disabled');
                    warehouseWrapper.setAttribute('data-disabled', 'true');
                }
            }
        });


        form.querySelectorAll('.form-input, .form-select').forEach(input => {
            input.addEventListener('blur', () => validateInput(input));
            if (input.tagName === 'SELECT') {
                input.addEventListener('change', () => validateInput(input));
            }
        });


        // =======================================================
        // 4. ІНІЦІАЛІЗАЦІЯ ТА СТИЛІЗАЦІЯ
        // =======================================================

        populateCities().then(() => {
            customizeSelect(citySelect, form);
            customizeSelect(warehouseSelect, form);
            customizeSelect(document.getElementById('chair'), form);
            customizeSelect(document.getElementById('size'), form);

            const warehouseWrapper = warehouseSelect.closest('.custom-select-wrapper');
            if (warehouseWrapper) {
                warehouseWrapper.classList.add('disabled');
                warehouseWrapper.setAttribute('data-disabled', 'true');
            }
        });
    } 
});