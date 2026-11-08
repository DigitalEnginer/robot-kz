/**
 * SITE_CONFIG — Единая конфигурация бренда, юридических данных и контактов
 * Доступна в браузере (window.SITE_CONFIG) и в Node.js (CommonJS)
 */
const SITE_CONFIG = {
  brandName: "ORDA ROBOTICS",
  brandShort: "ORDA.KZ",
  legalName: "ТОО «ORDA ROBOTICS»",
  statusBadge: "ОФИЦИАЛЬНЫЙ ПОСТАВЩИК В РК",
  phoneDisplay: "+7 (700) 000-00-00", // Временный плейсхолдер под замену
  phoneRaw: "+77000000000",
  whatsappNumber: "77000000000", // Только цифры для ссылок https://wa.me/
  telegramUrl: "https://t.me/ordarobotics_kz",
  emailSales: "sales@orda-robotics.kz",
  emailSupport: "support@orda-robotics.kz",
  cityPrimary: "Алматы",
  citiesCoverage: "Алматы, Астана и все регионы РК",
  addressFull: "Республика Казахстан, г. Алматы (адрес шоурума уточняется)",
  workHours: "Пн–Пт: 09:00 – 19:00",
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = SITE_CONFIG;
}
