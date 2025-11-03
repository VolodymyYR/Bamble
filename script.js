document.addEventListener('DOMContentLoaded', () => {
    const contactModal = document.getElementById('contactModal');
    const closeModalButton = document.getElementById('closeModalButton');
    // Вам потрібно буде додати елемент, який відкриватиме модальне вікно.
    // Наприклад, іконка телефону в хедері може мати id="openContactModal"
    const openModalButton = document.getElementById('openContactModal'); 

    // Функція для відкриття модального вікна
    function openModal() {
        contactModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Забороняємо прокрутку сторінки
    }

    // Функція для закриття модального вікна
    function closeModal() {
        contactModal.classList.remove('active');
        document.body.style.overflow = ''; // Дозволяємо прокрутку сторінки
    }

    // Додаємо обробник подій для кнопки відкриття (якщо вона існує)
    if (openModalButton) {
        openModalButton.addEventListener('click', openModal);
    }

    // Додаємо обробник подій для кнопки закриття
    if (closeModalButton) {
        closeModalButton.addEventListener('click', closeModal);
    }

    // Додаємо обробник подій для закриття по кліку на фоні
    if (contactModal) {
        contactModal.addEventListener('click', (event) => {
            if (event.target === contactModal) {
                closeModal();
            }
        });
    }

    // Додаємо обробник подій для закриття по натисканню Esc
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && contactModal.classList.contains('active')) {
            closeModal();
        }
    });

    // Приклад: якщо ви хочете, щоб модалка відкривалася при завантаженні для тестування, розкоментуйте:
    // openModal(); 
});

// =======================================================
// Slider for Dimensions Section

document.addEventListener('DOMContentLoaded', () => {
    // 1. ФУНКЦІЯ ІНІЦІАЛІЗАЦІЇ ОДНОГО СЛАЙДЕРА
    function initializeSlider(sliderContainer) {
        // Знаходимо елементи СУВОРО в межах переданого контейнера
        const slides = sliderContainer.querySelectorAll('.slider-image');
        const sliderWrapper = sliderContainer.querySelector('.reviews-block__slider-wrapper') || sliderContainer.querySelector('.bloggers-block__slider-wrapper');
        const prevButton = sliderContainer.querySelector('.navigation-buttons__prev');
        const nextButton = sliderContainer.querySelector('.navigation-buttons__next');
        
        // Якщо немає елементів для роботи, виходимо
        if (!slides.length || !prevButton || !nextButton) return;

        // Визначаємо, який тип слайдера використовуємо
        const isFadeSlider = sliderContainer.classList.contains('dimensions') || sliderContainer.classList.contains('catalog-slider');
        const isScrollSlider = sliderContainer.classList.contains('reviews-block') || sliderContainer.classList.contains('bloggers-block');
        const isBloggerSlider = sliderContainer.classList.contains('bloggers-block');
        
        let currentIndex = 0;
        let isTransitioning = false;
        
        // --- ЛОГІКА ІНІЦІАЛІІЗАЦІЇ (Тільки для FADE-слайдера) ---
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
        
        // --- ЛОГІКА ОНОВЛЕННЯ СЛАЙДЕРА (FADE) ---
        function updateFadeSlider() {
            if (isTransitioning) return;
            isTransitioning = true;

            const currentSlide = slides[currentIndex];

            // 1. Ховаємо ВСІ слайди (починаємо з прозорості)
            slides.forEach(slide => {
                slide.style.opacity = '0';
                
                slide.addEventListener('transitionend', function handler() {
                    if (this !== slides[currentIndex]) {
                        this.style.display = 'none';
                    }
                    this.removeEventListener('transitionend', handler);
                });
            });

            // 2. Показуємо поточний слайд
            setTimeout(() => {
                currentSlide.style.display = 'block'; 
                setTimeout(() => { 
                    currentSlide.style.opacity = '1';
                }, 50); 
            }, 0); 


            // 3. Знімаємо прапорець isTransitioning після завершення анімації
            currentSlide.addEventListener('transitionend', function handler() {
                isTransitioning = false;
                this.removeEventListener('transitionend', handler);
            });
            
            // Запобіжник для випадків, коли transitionend не спрацьовує
             if (!currentSlide.style.transitionDuration || parseFloat(getComputedStyle(currentSlide).transitionDuration) === 0) {
                 isTransitioning = false;
            }
        }
        
        // --- ОБРОБНИКИ ПОДІЙ ДЛЯ КНОПОК ---

        if (isScrollSlider) {
            // ЛОГІКА ПРОКРУТКИ (для reviews-block та bloggers-block)
            const slide = slides[0];
            const slideWidth = slide.offsetWidth;
            // Отримуємо відступ (gap) від батьківського елемента track
            const gap = parseFloat(getComputedStyle(slide.parentElement).gap || 0);

            // Визначаємо величину прокрутки
            let scrollAmount;
            if (isBloggerSlider) {
                // Для блогерів прокручуємо на 2 елементи + 1 відступ
                scrollAmount = (slideWidth * 2) + gap;
            } else {
                // Для відгуків прокручуємо на 1 елемент + 1 відступ
                scrollAmount = slideWidth + gap;
            }
            
            nextButton.addEventListener('click', () => {
                 sliderWrapper.scrollBy({
                    left: scrollAmount,
                    behavior: 'smooth'
                 });
            });

            prevButton.addEventListener('click', () => {
                 sliderWrapper.scrollBy({
                    left: -scrollAmount,
                    behavior: 'smooth'
                 });
            });
            
        } else if (isFadeSlider) {
            // ЛОГІКА FADE (для dimensions)
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

    // 2. АКТИВАЦІЯ: Знаходимо всі слайдери на сторінці та ініціалізуємо їх
    const allSliderContainers = document.querySelectorAll('.dimensions, .reviews-block, .bloggers-block, .catalog-slider');

    allSliderContainers.forEach(container => {
        initializeSlider(container);
    });
});