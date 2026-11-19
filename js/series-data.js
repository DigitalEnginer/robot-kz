/**
 * SERIES_DATA — группировка моделей каталога в серии (как в PDF-каталоге).
 * Каталог показывает карточки серий; нажатие на серию открывает все её модели.
 * models: slug'и из ROBOTS_DATA, первая модель — «флагман» серии (её фото на карточке).
 */
const SERIES_DATA = [
  // ---------- UNITREE ----------
  {
    id: "go2", name: "Unitree Go2", brand: "Unitree", cat: "quadruped",
    tagline: "Самый продаваемый робот-собака в мире: 4D-лидар, GPT-ИИ, от базовой Air до исследовательской EDU",
    models: ["go2-pro", "go2-air", "go2-x", "go2-edu", "go2-w"]
  },
  {
    id: "g1", name: "Unitree G1", brand: "Unitree", cat: "humanoid",
    tagline: "Гуманоид массового производства ростом 127 см: до 43 степеней свободы, версии для R&D, спорта и колёсная G1-D",
    models: ["unitree-g1", "unitree-g1-plus", "unitree-g1-edu", "unitree-g1-comp", "unitree-g1-boxing", "unitree-g1-d"]
  },
  {
    id: "h2", name: "Unitree H2", brand: "Unitree", cat: "humanoid",
    tagline: "Полноразмерные гуманоиды нового поколения ростом 180 см",
    models: ["unitree-h2", "unitree-h2-plus", "unitree-h2-d"]
  },
  {
    id: "h1", name: "Unitree H1", brand: "Unitree", cat: "humanoid",
    tagline: "Полноразмерный скоростной гуманоид и обновлённая версия H1-2",
    models: ["unitree-h1", "unitree-h1-2"]
  },
  {
    id: "r1", name: "Unitree R1", brand: "Unitree", cat: "humanoid",
    tagline: "Сверхлёгкий и доступный спортивный гуманоид: бег, кувырки, стойка на руках",
    models: ["unitree-r1", "unitree-r1-a"]
  },
  {
    id: "b2", name: "Unitree B2", brand: "Unitree", cat: "quadruped",
    tagline: "Тяжёлый промышленный квадропед IP67: нагрузка до 40–50 кг, шагающая и колёсная версии",
    models: ["unitree-b2", "unitree-b2-w"]
  },
  {
    id: "a2", name: "Unitree A2", brand: "Unitree", cat: "quadruped",
    tagline: "Промышленный квадропед для инспекции, патрулирования и работы в опасных зонах",
    models: ["unitree-a2", "unitree-a2-w"]
  },
  {
    id: "as2", name: "Unitree As2", brand: "Unitree", cat: "quadruped",
    tagline: "Компактный квадропед нового поколения — шагающая и колёсная версии",
    models: ["unitree-as2", "unitree-as2-w"]
  },
  { id: "dex3", name: "Unitree Dex3-1", brand: "Unitree", cat: "components", tagline: "", models: ["unitree-dex3-1"] },
  { id: "z1", name: "Unitree Z1", brand: "Unitree", cat: "components", tagline: "", models: ["unitree-z1"] },

  // ---------- PUDU ----------
  {
    id: "bellabot", name: "PUDU BellaBot", brand: "PUDU", cat: "delivery",
    tagline: "Флагманский робот-официант с «кошачьим» интерфейсом и 4 лотками",
    models: ["pudu-bellabot", "pudu-bellabot-pro"]
  },
  {
    id: "flashbot", name: "PUDU FlashBot", brand: "PUDU", cat: "delivery",
    tagline: "Автономная доставка между этажами: сам вызывает лифт и уведомляет получателя",
    models: ["pudu-flashbot-max", "pudu-flashbot-arm"]
  },
  { id: "kettybot", name: "PUDU KettyBot Pro", brand: "PUDU", cat: "delivery", tagline: "", models: ["pudu-kettybot-pro"] },
  { id: "pudubot", name: "PUDU PuduBot 2", brand: "PUDU", cat: "delivery", tagline: "", models: ["pudu-pudubot-2"] },
  { id: "cc1", name: "PUDU CC1", brand: "PUDU", cat: "cleaning", tagline: "", models: ["pudu-cc1"] },
  { id: "et1", name: "PUDU ET1", brand: "PUDU", cat: "cleaning", tagline: "", models: ["pudu-et1"] },
  { id: "sh1", name: "PUDU SH1", brand: "PUDU", cat: "cleaning", tagline: "", models: ["pudu-sh1"] },
  { id: "mt1", name: "PUDU MT1", brand: "PUDU", cat: "cleaning", tagline: "", models: ["pudu-mt1"] },
  { id: "bg1", name: "PUDU BG1", brand: "PUDU", cat: "cleaning", tagline: "", models: ["pudu-bg1"] },
  {
    id: "t-series", name: "PUDU T300 / T600", brand: "PUDU", cat: "industrial",
    tagline: "Промышленные AMR-платформы для цеха и склада: грузоподъёмность 300 и 600 кг",
    models: ["pudu-t300", "pudu-t600"]
  },
  { id: "d5", name: "PUDU D5", brand: "PUDU", cat: "quadruped", tagline: "", models: ["pudu-d5"] }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = SERIES_DATA;
}
