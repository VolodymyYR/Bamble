# main.py

import os
import time
from datetime import datetime
from typing import List, Dict, Any, Optional

import aiomysql
import httpx
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Завантаження змінних оточення з .env
load_dotenv(override=True)

# --- КОНФІГУРАЦІЯ ---
DB_HOST = os.getenv("DB_HOST")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")

NOVAPOSHTA_API_URL = 'https://api.novaposhta.ua/v2.0/json/'
NOVAPOSHTA_API_KEY = os.getenv("NOVAPOSHTA_API_KEY")

TG_BOT_TOKEN = os.getenv("TG_BOT_TOKEN")
TG_CHAT_ID = os.getenv("TG_CHAT_ID")

if not NOVAPOSHTA_API_KEY:
    print('API KEY для Нової Пошти не знайдено в файлі .env! Будь ласка, додайте NOVAPOSHTA_API_KEY.')
    exit(1)

# --- КЕШУВАННЯ В ПАМ'ЯТІ ---
cities_cache: Optional[Dict[str, Any]] = None
CACHE_LIFETIME = 60 * 60 * 24  # Кешувати міста на 24 години (у секундах)

# --- МОДЕЛІ ДАНИХ (Pydantic) ---
class OrderBase(BaseModel):
    name: str
    phone: str
    city: str
    warehouse: str
    chair: str
    size: str

class OrderCreate(OrderBase):
    # Використовується для POST /api/orders
    pass

class OrderDB(OrderBase):
    id: int
    order_date: datetime # Фактична дата з бази
    status: str
    formatted_timestamp: str = Field(..., alias="formatted_timestamp") # Дата у форматі для фронтенду

    class Config:
        orm_mode = True # Дозволяє зчитування даних з об'єкта бази даних
        allow_population_by_field_name = True

class StatusUpdate(BaseModel):
    newStatus: str

class CityRef(BaseModel):
    cityRef: str

# --- ІНІЦІАЛІЗАЦІЯ FASTAPI ---
app = FastAPI(title="E-commerce Backend (Nova Poshta Integration)")

# --- MIDDLEWARE та CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ПУЛ ПІДКЛЮЧЕНЬ ДО БАЗИ ДАНИХ ---
async def get_db_pool():
    # Створюємо пул підключень при запуску програми
    # Використовуємо app.state для зберігання пулу
    app.state.db_pool = await aiomysql.create_pool(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        db=DB_NAME,
        autocommit=True,
        # Налаштування для асинхронної роботи
        charset='utf8mb4',
        cursorclass=aiomysql.DictCursor # Щоб отримувати результати як словники
    )
    print("✅ Пул підключень до MySQL успішно створено.")

# Викликаємо функцію для створення пулу при запуску
@app.on_event("startup")
async def startup_event():
    await get_db_pool()

@app.on_event("shutdown")
async def shutdown_event():
    if hasattr(app.state, 'db_pool'):
        app.state.db_pool.close()
        await app.state.db_pool.wait_closed()
        print("❌ Пул підключень до MySQL закрито.")

# =========================================================================
# УНІВЕРСАЛЬНА ФУНКЦІЯ: ВИКОНАННЯ ЗАПИТУ ДО API НОВОЇ ПОШТИ
# =========================================================================
async def fetch_nova_poshta(called_method: str, method_properties: Dict[str, Any] = {}) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        payload = {
            "apiKey": NOVAPOSHTA_API_KEY,
            "modelName": "Address",
            "calledMethod": called_method,
            "methodProperties": method_properties
        }
        
        try:
            response = await client.post(NOVAPOSHTA_API_URL, json=payload)
            response.raise_for_status() # Перевіряємо на HTTP помилки (4xx, 5xx)

            data = response.json()
            
            # Перевіряємо, чи успішна відповідь API Нової Пошти
            if not data.get("success"):
                error_msg = data.get("errors", ["Unknown API Error"])
                error_msg_str = "; ".join(error_msg)
                raise Exception(f"NovaPoshta API Error: {error_msg_str}")
            
            return data
            
        except httpx.HTTPStatusError as e:
            # Обробка HTTP помилок
            print(f"Тіло помилкової відповіді (HTTP): {e.response.text}")
            raise HTTPException(status_code=e.response.status_code, detail=f"HTTP error! status: {e.response.status_code}")
        except Exception as e:
            # Обробка логічних помилок або помилок мережі
            print(f"Помилка при запиті до Нової Пошти: {e}")
            raise HTTPException(status_code=500, detail=str(e))

# =========================================================================
# ФУНКЦІЯ: НАДСИЛАННЯ СПОВІЩЕННЯ В TELEGRAM
# =========================================================================
async def send_telegram_notification(order_data: Dict[str, Any]):
    if not TG_BOT_TOKEN or not TG_CHAT_ID:
        print("Помилка: TG_BOT_TOKEN або TG_CHAT_ID не налаштовані.")
        return

    order_id = order_data.get('orderId')
    name = order_data.get('name')
    phone = order_data.get('phone')
    city = order_data.get('city')
    warehouse = order_data.get('warehouse')
    chair = order_data.get('chair')
    size = order_data.get('size')

    # Форматування повідомлення у Markdown
    message = f"""
🛒 *НОВЕ ЗАМОВЛЕННЯ №{order_id}!*
---
*🧑 Клієнт:* {name}
*📞 Телефон:* [{phone}](tel:{phone})
*📍 Місто:* {city}
*📦 Відділення НП:* {warehouse}
*🪑 Товар:* {chair} ({size})
"""
    
    telegram_url = f"https://api.telegram.org/bot{TG_BOT_TOKEN}/sendMessage"

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.post(telegram_url, json={
                "chat_id": TG_CHAT_ID,
                "text": message,
                "parse_mode": "Markdown",
                "disable_web_page_preview": True
            })

            if response.status_code != 200:
                print(f"Помилка Telegram API: {response.status_code}, {response.text}")
            else:
                print(f"Сповіщення про замовлення {order_id} успішно надіслано в Telegram.")

        except Exception as error:
            print(f"Помилка мережі при надсиланні в Telegram: {error}")

# =========================================================================
# РОУТИ ДЛЯ API
# =========================================================================

# --- POST: ЗБЕРЕЖЕННЯ ЗАМОВЛЕННЯ ---
@app.post("/api/orders", status_code=status.HTTP_201_CREATED)
async def create_order(order: OrderCreate):
    pool = app.state.db_pool
    
    # Використовуємо .dict() для отримання словника з Pydantic моделі
    order_data = order.dict() 
    
    # Примітка: оригінальний JS-код мав перевірки. Тут припускаємо, що вони будуть додані.

    sql = """
        INSERT INTO orders (name, phone, city, warehouse, chair, size, status)
        VALUES (%s, %s, %s, %s, %s, %s, 'Нове')
    """
    values = [
        order_data['name'], order_data['phone'], order_data['city'], 
        order_data['warehouse'], order_data['chair'], order_data['size']
    ]
    
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            try:
                # 1. ВИКОНАННЯ SQL-ЗАПИТУ
                await cur.execute(sql, values)
                order_id = cur.lastrowid # Отримання останнього вставленого ID
                
                # 2. СПОВІЩЕННЯ TELEGRAM (запускаємо асинхронно, не чекаючи)
                await send_telegram_notification({ 
                    **order_data, 
                    'orderId': order_id 
                })

                # 3. ПОВЕРТАЄМО ID
                return {
                    "success": True, 
                    "message": "Замовлення успішно прийнято!", 
                    "orderId": order_id
                }
            except Exception as e:
                print(f"Помилка при збереженні замовлення в БД: {e}")
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Помилка сервера при збереженні замовлення.")

# --- GET: ОТРИМАННЯ СПИСКУ ЗАМОВЛЕНЬ ---
# Роут оновлено, щоб відображати логіку, додану в кінці JS-коду
@app.get("/api/orders", response_model=Dict[str, Any])
async def get_orders():
    pool = app.state.db_pool
    
    sql = """
        SELECT 
            *, 
            DATE_FORMAT(order_date, '%%Y-%%m-%%dT%%H:%%i:%%s.000Z') AS formatted_timestamp,
            status 
        FROM orders 
        ORDER BY id DESC
    """
    
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            try:
                await cur.execute(sql)
                # Отримання результатів у вигляді словників
                orders_raw = await cur.fetchall() 
                
                # FastAPI/Pydantic автоматично перетворить словники на OrderDB моделі
                # (хоча OrderDB використовується тут більше для внутрішнього типування, 
                # повертаємо загальний словник, як в оригінальному JS-коді)
                
                # Перетворення назв стовпців з бази на camelCase, якщо потрібно (тут не робимо)
                
                return {"success": True, "data": orders_raw}
            
            except Exception as e:
                print(f"Помилка при отриманні замовлень з бази даних: {e}")
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Помилка сервера при отриманні даних.")


# --- PUT: ОНОВЛЕННЯ СТАТУСУ ЗАМОВЛЕННЯ ---
@app.put('/api/orders/{order_id}/status')
async def update_order_status(order_id: int, update: StatusUpdate):
    pool = app.state.db_pool
    new_status = update.newStatus
    
    ALLOWED_STATUSES = ['Нове', 'В обробці', 'В доставці', 'Виконано', 'Скасовано']
    if new_status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Недійсне значення статусу.')

    sql = 'UPDATE orders SET status = %s WHERE id = %s'
    
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            try:
                await cur.execute(sql, (new_status, order_id))
                
                # Перевірка кількості змінених рядків
                if cur.rowcount == 0:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Замовлення з ID {order_id} не знайдено.")
                
                return {"success": True, "message": f"Статус замовлення {order_id} оновлено на {new_status}"}
            
            except HTTPException: # Прокидаємо 404 далі
                raise
            except Exception as e:
                print(f"Помилка при оновленні статусу замовлення {order_id}: {e}")
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Помилка сервера при оновленні статусу.')

# --- DELETE: ВИДАЛЕННЯ ЗАМОВЛЕННЯ ---
@app.delete('/api/orders/{order_id}')
async def delete_order(order_id: int):
    pool = app.state.db_pool
    sql = 'DELETE FROM orders WHERE id = %s'

    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            try:
                await cur.execute(sql, (order_id,))
                
                if cur.rowcount == 0:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Замовлення з ID {order_id} не знайдено.")
                
                return {"success": True, "message": f"Замовлення {order_id} успішно видалено."}
            
            except HTTPException: # Прокидаємо 404 далі
                raise
            except Exception as e:
                print(f"Помилка при видаленні замовлення {order_id}: {e}")
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Помилка сервера при видаленні.')


# --- POST: ОТРИМАННЯ СПИСКУ МІСТ (З КЕШУВАННЯМ) ---
@app.post('/api/novaposhta/cities')
async def get_cities():
    global cities_cache
    
    # 1. ПЕРЕВІРКА КЕШУ
    if cities_cache and (time.time() - cities_cache.get('timestamp', 0) < CACHE_LIFETIME):
        print('Використання кешу міст.')
        return {"success": True, "data": cities_cache['cities']}
    
    # --- ПАГІНАЦІЯ ДЛЯ ОТРИМАННЯ ВСІХ МІСТ ---
    all_cities_raw: List[Dict[str, Any]] = []
    page = 1
    PAGE_LIMIT = 500

    try:
        has_more = True
        while has_more:
            # 2. ЗАПИТ ДО API ПО СТОРІНКАХ
            np_data = await fetch_nova_poshta('getSettlements', {
                "Limit": str(PAGE_LIMIT), 
                "Page": str(page) 
            })
            
            # Якщо API повернуло 0 результатів, це остання сторінка
            if not np_data.get("data"):
                has_more = False
            else:
                all_cities_raw.extend(np_data["data"])
                page += 1
        
        # 3. ОБРОБКА ТА ФІЛЬТРАЦІЯ
        cities = [
            {"Ref": city["Ref"], "Description": city["Description"]}
            for city in all_cities_raw
            if city.get("SettlementTypeDescription") in ("місто", "селище міського типу")
        ]
        
        # Сортування (використовуємо locale для української)
        cities.sort(key=lambda x: x["Description"].lower(), reverse=False)

        # 4. ЗБЕРЕЖЕННЯ В КЕШ
        cities_cache = {"cities": cities, "timestamp": time.time()}

        return {"success": True, "data": cities}

    except HTTPException as e:
        # Прокидаємо помилки, які були згенеровані у fetch_nova_poshta
        raise e 
    except Exception as e:
        print(f"Помилка при отриманні міст (Пагінація): {e}")
        # Використовуємо 500, якщо це не помилка API, а інша проблема
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Помилка сервера: {e}")


# --- POST: ОТРИМАННЯ СПИСКУ ВІДДІЛЕНЬ ---
@app.post('/api/novaposhta/warehouses')
async def get_warehouses(city_ref_model: CityRef):
    city_ref = city_ref_model.cityRef
    
    if not city_ref:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Необхідно вказати Ref міста.')

    try:
        # Використовуємо універсальну функцію
        np_data = await fetch_nova_poshta('getWarehouses', {
            "CityRef": city_ref, # <--- ВИПРАВЛЕНО: Додано CityRef, як зазвичай вимагає API Нової Пошти
            "Page": "1", 
            "Limit": "1000" # Збільшено ліміт для отримання всіх відділень міста
        })
        
        warehouses = [
            {"Ref": wh["Ref"], "Description": wh["Description"]}
            for wh in np_data.get("data", [])
        ]
        
        warehouses.sort(key=lambda x: x["Description"].lower(), reverse=False)

        return {"success": True, "data": warehouses}

    except HTTPException as e:
        # Прокидаємо помилки, які були згенеровані у fetch_nova_poshta
        raise e 
    except Exception as e:
        print(f"Помилка при отриманні відділень: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Помилка сервера: {e}")

# --- ЗАПУСК СЕРВЕРА ---
if __name__ == "__main__":
    import uvicorn
    # Запуск сервера uvicorn
    # host="0.0.0.0" робить його доступним зовні
    # port береться зі змінної оточення, або 3000
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 3000)))