-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: bamble_orders
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `city` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `warehouse` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chair` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `size` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Нове',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES (1,'Володимир','0669959327','Андрушівка','Поштомат \"Нова Пошта\" №21603: Французький бульвар, 22/к3, під’їзд №3 (ТІЛЬКИ ДЛЯ МЕШКАНЦІВ)','racoon','2','2025-11-03 22:59:50','Нове'),(2,'Володимир','0669959327','Андрушівка','Поштомат \"Нова Пошта\" №21603: Французький бульвар, 22/к3, під’їзд №3 (ТІЛЬКИ ДЛЯ МЕШКАНЦІВ)','racoon','2','2025-11-03 22:59:50','Нове'),(3,'Володимир','0669959327','Аули','Поштомат \"Нова Пошта\" №26681: вул. Покровська, 21а, біля відділення №2','wolf','2','2025-11-03 23:01:43','Нове'),(4,'Володимир','0669959327','Аули','Поштомат \"Нова Пошта\" №26681: вул. Покровська, 21а, біля відділення №2','wolf','2','2025-11-03 23:01:43','Нове'),(5,'Володимир','0669959327','Аули','Поштомат \"Нова Пошта\" №26249: вул. Клочківська, 226 (маг. \"Десятка\")','racoon','2','2025-11-03 23:06:40','Нове'),(6,'Володимир','0669959327','Аули','Поштомат \"Нова Пошта\" №26249: вул. Клочківська, 226 (маг. \"Десятка\")','racoon','2','2025-11-03 23:06:40','Нове'),(7,'VolodumurYR','0669959327','Бабанка','Поштомат \"Нова Пошта\" №24720: вул. Калинова, 1, під\'їзд №5 (ТІЛЬКИ ДЛЯ МЕШКАНЦІВ)','wolf','2','2025-11-03 23:07:01','Нове'),(8,'VolodumurYR','0669959327','Бабанка','Поштомат \"Нова Пошта\" №24720: вул. Калинова, 1, під\'їзд №5 (ТІЛЬКИ ДЛЯ МЕШКАНЦІВ)','wolf','2','2025-11-03 23:07:01','Нове'),(9,'Володимир','0669959327','Бабаї','Поштомат \"Нова Пошта\" №24720: вул. Калинова, 1, під\'їзд №5 (ТІЛЬКИ ДЛЯ МЕШКАНЦІВ)','racoon','2','2025-11-03 23:10:46','Виконано'),(10,'Володимир','0669959327','Бабаї','Поштомат \"Нова Пошта\" №24720: вул. Калинова, 1, під\'їзд №5 (ТІЛЬКИ ДЛЯ МЕШКАНЦІВ)','racoon','2','2025-11-03 23:10:46','В доставці');
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-04 17:10:12
