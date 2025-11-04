const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config({ path: '.env' });
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// --- КОНФІГУРАЦІЯ ---
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

const NOVAPOSHTA_API_URL = 'https://api.novaposhta.ua/v2.0/json/';
const NOVAPOSHTA_API_KEY = process.env.NOVAPOSHTA_API_KEY;

// --- КОНФІГУРАЦІЯ TELEGRAM ---
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
const TG_CHAT_ID = process.env.TG_CHAT_ID;

if (!NOVAPOSHTA_API_KEY) {
    console.error('API KEY для Нової Пошти не знайдено в файлі .env! Будь ласка, додайте NOVAPOSHTA_API_KEY.');
    process.exit(1);
}

// --- КЕШУВАННЯ В ПАМ'ЯТІ ---
let citiesCache = null; 
const CACHE_LIFETIME = 1000 * 60 * 60 * 24; // Кешувати міста на 24 години

// --- MIDDLEWARE та CORS (без змін) ---
app.use(cors({
    origin: '*', // Дозволяє всі походження (включаючи null)
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // <--- ДОДАНО DELETE ТА PUT!
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());


// =========================================================================
// УНІВЕРСАЛЬНА ФУНКЦІЯ: ВИКОНАННЯ ЗАПИТУ ДО API НОВОЇ ПОШТИ
// =========================================================================
async function fetchNovaPoshta(calledMethod, methodProperties = {}) {
    const response = await fetch(NOVAPOSHTA_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            apiKey: NOVAPOSHTA_API_KEY,
            modelName: 'Address',
            calledMethod: calledMethod,
            methodProperties: methodProperties
        })
    });
    
    // Перевіряємо, чи HTTP-відповідь успішна
    if (!response.ok) {
        // Додайте логування тут
        console.error('Тіло помилкової відповіді:', await response.text());
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    

    const data = await response.json();
    
    if (!data.success) {
        // Логічні помилки API
        const errorMsg = data.errors ? data.errors.join('; ') : 'Unknown API Error';
        
        // --- КРИТИЧНЕ ЛОГУВАННЯ ---
        console.error(`❌ NP API Error: ${errorMsg}`);
        console.error(`   Method: ${calledMethod}, Properties:`, methodProperties);
        // -------------------------
        
        throw new Error(`NovaPoshta API Error: ${errorMsg}`);
    }
    
    return data;
}

/**
 * Надсилає повідомлення про нове замовлення в Telegram.
 */
async function sendTelegramNotification(orderData) {
    if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
        console.error("Помилка: TG_BOT_TOKEN або TG_CHAT_ID не налаштовані.");
        return;
    }

    const { orderId, name, phone, city, warehouse, chair, size } = orderData;

    // Форматуємо повідомлення у Markdown
    const message = `
🛒 *НОВЕ ЗАМОВЛЕННЯ №${orderId}!*
---
*🧑 Клієнт:* ${name}
*📞 Телефон:* [${phone}](tel:${phone})
*📍 Місто:* ${city}
*📦 Відділення НП:* ${warehouse}
*🪑 Товар:* ${chair} (${size})
`;
    
    // URL для відправки повідомлення
    const telegramUrl = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;

    try {
        const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TG_CHAT_ID,
                text: message,
                parse_mode: 'Markdown', // Використовуємо Markdown для форматування
                disable_web_page_preview: true // Приховуємо попередній перегляд посилань
            })
        });

        if (!response.ok) {
            console.error('Помилка Telegram API:', response.status, await response.text());
        } else {
            console.log(`Сповіщення про замовлення ${orderId} успішно надіслано в Telegram.`);
        }

    } catch (error) {
        console.error('Помилка мережі при надсиланні в Telegram:', error);
    }
}

// --- РОУТ: ЗБЕРЕЖЕННЯ ЗАМОВЛЕННЯ В MYSQL (без змін) ---
app.post('/api/orders', async (req, res) => {
    const { name, phone, city, warehouse, chair, size } = req.body;
    // ... (перевірки даних залишаються) ...
    
    let connection;
    try {
        // ... (код підключення та виконання SQL залишається) ...
        
        const [result] = await connection.execute(sql, values);
        const orderId = result.insertId; 
        
        // **********************************************
        // ********* ВИКЛИК СПОВІЩЕННЯ TELEGRAM *********
        // **********************************************
        sendTelegramNotification({ 
            orderId: orderId, 
            name, 
            phone, 
            city, 
            warehouse, 
            chair, 
            size 
        });

        // 3. ПОВЕРТАЄМО ID у відповіді
        res.status(201).json({ 
            success: true, 
            message: 'Замовлення успішно прийнято!', 
            orderId: orderId
        });

    } catch (error) {
        // ... (обробка помилок залишається) ...
    } finally {
        if (connection) await connection.end();
    }
});


// --- РОУТ: ОТРИМАННЯ СПИСКУ МІСТ (З КЕШУВАННЯМ) ---
app.post('/api/novaposhta/cities', async (req, res) => {
    // 1. ПЕРЕВІРКА КЕШУ
    if (citiesCache && (Date.now() - citiesCache.timestamp < CACHE_LIFETIME)) {
        console.log('Використання кешу міст.');
        return res.json({ success: true, data: citiesCache.cities });
    }
    
    // --- ПАГІНАЦІЯ ДЛЯ ОТРИМАННЯ ВСІХ МІСТ ---
    let allCitiesRaw = []; // Змінна для зберігання всіх отриманих даних
    let page = 1;
    const PAGE_LIMIT = 500; // Оптимальний безпечний ліміт

    try {
        let hasMore = true;

        while (hasMore) {
            // 2. ЗАПИТ ДО API ПО СТОРІНКАХ
            const npData = await fetchNovaPoshta('getSettlements', {
                "Limit": PAGE_LIMIT.toString(), 
                "Page": page.toString() 
            });
            
            // Якщо API повернуло 0 результатів, це остання сторінка
            if (npData.data.length === 0) {
                hasMore = false;
            } else {
                allCitiesRaw = allCitiesRaw.concat(npData.data);
                page++;
            }
        }
        
        // 3. ОБРОБКА ТА ФІЛЬТРАЦІЯ (застосовується до ВСІХ отриманих даних)
        const cities = allCitiesRaw
            .filter(city => city.SettlementTypeDescription === "місто" || city.SettlementTypeDescription === "селище міського типу")
            .map(city => ({
                Ref: city.Ref,
                Description: city.Description
            }))
            .sort((a, b) => a.Description.localeCompare(b.Description, 'uk'));

        // 4. ЗБЕРЕЖЕННЯ В КЕШ
        citiesCache = { cities: cities, timestamp: Date.now() };

        res.json({ success: true, data: cities });

    } catch (error) {
        console.error('Помилка при отриманні міст (Пагінація):', error.message);
        // Тут помилка вже не має бути 500 (якщо Нова Пошта жива), 
        // а логічною помилкою (наприклад, недійсний ключ), 
        // яку обробить catch, повертаючи 500 на фронтенд.
        res.status(500).json({ success: false, message: `Помилка сервера: ${error.message}` });
    }
});


// --- РОУТ: ОТРИМАННЯ СПИСКУ ВІДДІЛЕНЬ ---
// server.js

// --- РОУТ: ОТРИМАННЯ СПИСКУ ВІДДІЛЕНЬ ---
app.post('/api/novaposhta/warehouses', async (req, res) => {
    // 1. Отримання, конвертація у рядок та очищення пробілів
    const rawCityRef = req.body.cityRef;
    const cityRef = rawCityRef ? String(rawCityRef).trim() : '';

    if (!cityRef) {
        // Логічна помилка: місто не вибрано
        return res.status(400).json({ success: false, message: 'Необхідно вказати Ref міста.' });
    }

    try {
        // 2. Виклик універсальної функції. Використовуємо SettlementRef
        const npData = await fetchNovaPoshta('getWarehouses', {
            "SettlementRef": cityRef, // <--- КОРЕКТНА ЗМІННА cityRef
            "Page": "1",
            "Limit": "1000"
        });

        // 3. Обробка та повернення даних
        const warehouses = npData.data
             .map(wh => ({ Ref: wh.Ref, Description: wh.Description }))
             .sort((a, b) => a.Description.localeCompare(b.Description, 'uk'));

        res.json({ success: true, data: warehouses });

    } catch (error) {
        // 4. Обробка помилок API
        console.error(`Помилка при отриманні відділень (Ref: ${cityRef}):`, error.message);
        res.status(500).json({ success: false, message: `Помилка сервера: ${error.message}` });
    }
});



// --- ЗАПУСК СЕРВЕРА (без змін) ---
app.listen(PORT, () => {
    console.log(`✅ Backend Server running at http://localhost:${PORT}`);
});

// server.js (НОВИЙ РОУТ ДЛЯ ОТРИМАННЯ ЗАМОВЛЕНЬ)

app.get('/api/orders', async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        
        // SQL-запит для отримання всіх замовлень, відсортованих за ID (від найновіших)
        const sql = `
            SELECT 
                *, 
                DATE_FORMAT(order_date, '%Y-%m-%dT%H:%i:%s.000Z') AS formatted_timestamp 
            FROM orders 
            ORDER BY id DESC
        `;
        
        const [orders] = await connection.execute(sql);
        
        // Успішно повертаємо дані
        res.status(200).json({ success: true, data: orders });

    } catch (error) {
        console.error('Помилка при отриманні замовлень з бази даних:', error);
        res.status(500).json({ success: false, message: 'Помилка сервера при отриманні даних.' });
    } finally {
        if (connection) await connection.end();
    }
});

app.put('/api/orders/:id/status', async (req, res) => {
    const orderId = req.params.id;
    const { newStatus } = req.body; // Очікуємо нове значення статусу

    // Перевірка на коректний статус
    const allowedStatuses = ['Нове', 'В обробці', 'В доставці', 'Виконано', 'Скасовано'];
    if (!allowedStatuses.includes(newStatus)) { // <--- ВИПРАВЛЕНО: Використовуємо allowedStatuses
        return res.status(400).json({ success: false, message: 'Недійсне значення статусу.' });
    }

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const sql = 'UPDATE orders SET status = ? WHERE id = ?';
        
        const [result] = await connection.execute(sql, [newStatus, orderId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: `Замовлення з ID ${orderId} не знайдено.` });
        }
        
        res.status(200).json({ success: true, message: `Статус замовлення ${orderId} оновлено на ${newStatus}` });

    } catch (error) {
        console.error(`Помилка при оновленні статусу замовлення ${orderId}:`, error);
        res.status(500).json({ success: false, message: 'Помилка сервера при оновленні статусу.' });
    } finally {
        if (connection) await connection.end();
    }
});

// --- РОУТ: ВИДАЛЕННЯ ЗАМОВЛЕННЯ ---
app.delete('/api/orders/:id', async (req, res) => {
    const orderId = req.params.id;

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const sql = 'DELETE FROM orders WHERE id = ?';
        
        const [result] = await connection.execute(sql, [orderId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: `Замовлення з ID ${orderId} не знайдено.` });
        }
        
        res.status(200).json({ success: true, message: `Замовлення ${orderId} успішно видалено.` });

    } catch (error) {
        console.error(`Помилка при видаленні замовлення ${orderId}:`, error);
        res.status(500).json({ success: false, message: 'Помилка сервера при видаленні.' });
    } finally {
        if (connection) await connection.end();
    }
});


// --- РОУТ: ОТРИМАННЯ СПИСКУ ЗАМОВЛЕНЬ (ОНОВЛЕНО) ---
// Оновлюємо GET /api/orders, щоб він також повертав поле status
app.get('/api/orders', async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const sql = `
            SELECT 
                *, 
                DATE_FORMAT(order_date, '%Y-%m-%dT%H:%i:%s.000Z') AS formatted_timestamp,
                status  // <--- ДОДАНО: Статус
            FROM orders 
            ORDER BY id DESC
        `;
        const [orders] = await connection.execute(sql);
        res.status(200).json({ success: true, data: orders });

    } catch (error) {
        console.error('Помилка при отриманні замовлень з бази даних:', error);
        res.status(500).json({ success: false, message: 'Помилка сервера при отриманні даних.' });
    } finally {
        if (connection) await connection.end();
    }
});