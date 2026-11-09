/**
 * ORDA ROBOTICS Kazakhstan - Client Application
 * Implements catalog filtering, native <dialog> modals, engineering configurator, 
 * specification/quote drawer, mobile burger navigation, and WhatsApp business integration.
 */

document.addEventListener('DOMContentLoaded', () => {
  // === CONFIG ===
  const CFG = (typeof window !== 'undefined' && window.SITE_CONFIG) ? window.SITE_CONFIG : {
    brandName: "ORDA ROBOTICS",
    brandShort: "ORDA.KZ",
    legalName: "ТОО «ORDA ROBOTICS»",
    statusBadge: "ОФИЦИАЛЬНЫЙ ПОСТАВЩИК В РК",
    phoneDisplay: "+7 (700) 000-00-00",
    phoneRaw: "+77000000000",
    whatsappNumber: "77000000000",
    emailSales: "sales@orda-robotics.kz",
    emailSupport: "support@orda-robotics.kz",
    cityPrimary: "Алматы",
    citiesCoverage: "Алматы, Астана и все регионы РК",
    addressFull: "Республика Казахстан, г. Алматы (адрес шоурума уточняется)",
    workHours: "Пн–Пт: 09:00 – 19:00"
  };

  // === STATE ===
  let currentCategory = 'all';
  let currentBrand = 'all';
  let currentSearch = '';
  let currentSort = 'popular';
  
  // Storage for cart / specification
  let cart = JSON.parse(localStorage.getItem('orda_cart') || localStorage.getItem('xbot_cart') || '[]');

  // Focus tracking for accessibility compliance
  let lastModalTrigger = null;
  let lastDrawerTrigger = null;

  // === DOM ELEMENTS ===
  const robotsGrid = document.getElementById('robotsGrid');
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  const categoryPills = document.querySelectorAll('.pill-btn');
  const brandBtns = document.querySelectorAll('.brand-btn');
  const cartCountBadges = document.querySelectorAll('.cart-count');
  
  // Dialog Elements
  const productDialog = document.getElementById('productDialog');
  const dialogContent = document.getElementById('dialogContent');
  
  // Drawer Elements
  const cartDrawer = document.getElementById('cartDrawer');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  const drawerItems = document.getElementById('drawerItems');
  const drawerTotalUnits = document.getElementById('drawerTotalUnits');
  const cartTriggers = document.querySelectorAll('.cart-trigger');
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');

  // Mobile Menu Elements
  const menuToggle = document.getElementById('menuToggle');
  const mainNav = document.getElementById('mainNav');
  const mobileNav = document.getElementById('mobileNav');
  const mobileNavBackdrop = document.getElementById('mobileNavBackdrop');
  const closeMobileNav = document.getElementById('closeMobileNav');

  // Centralized Scroll Lock Helper on <html> so sticky header on <body> never drops
  function setBodyLock(lock) {
    if (lock) {
      document.documentElement.classList.add('body-lock');
    } else {
      const isDrawerOpen = cartDrawer?.classList.contains('open');
      const isMobileNavOpen = mobileNav?.classList.contains('open');
      if (!isDrawerOpen && !isMobileNavOpen) {
        document.documentElement.classList.remove('body-lock');
      }
    }
  }

  // === 1. CATALOG RENDERING & FILTERING ===
  function renderCatalog() {
    if (!robotsGrid) return;

    let filtered = (typeof ROBOTS_DATA !== 'undefined' ? ROBOTS_DATA : []).filter(r => r.catalog_visible !== false);

    // Category filter
    if (currentCategory !== 'all') {
      filtered = filtered.filter(item => item.cat === currentCategory);
    }

    // Brand filter
    if (currentBrand !== 'all') {
      filtered = filtered.filter(item => item.brand.toLowerCase() === currentBrand.toLowerCase());
    }

    // Search filter
    if (currentSearch.trim()) {
      const q = currentSearch.toLowerCase().trim();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(q) ||
        (item.desc && item.desc.toLowerCase().includes(q)) ||
        (item.full_desc && item.full_desc.toLowerCase().includes(q)) ||
        (item.config_label && item.config_label.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      robotsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 16px; opacity: 0.5;">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.3-4.3"></path>
          </svg>
          <h3 style="color: #fff; margin-bottom: 8px;">Модели не найдены</h3>
          <p>Попробуйте изменить параметры поиска или сбросить фильтры</p>
          <button id="resetFiltersBtn" class="btn-secondary" style="margin-top: 16px; padding: 8px 18px;">Сбросить фильтры</button>
        </div>
      `;
      document.getElementById('resetFiltersBtn')?.addEventListener('click', resetAllFilters);
      return;
    }

    robotsGrid.innerHTML = filtered.map(robot => {
      const specsEntries = Object.entries(robot.specs || {}).slice(0, 4);
      const configTag = robot.config_label ? `<div class="card-config-tag" style="font-size: 0.72rem; color: var(--accent-mint); margin-top: 2px; font-weight: 600;">${robot.config_label}</div>` : '';
      return `
        <article class="robot-card" data-slug="${robot.slug}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="Открыть подробные характеристики ${robot.name}">
          <div class="robot-card-top">
            <span class="card-badge">${robot.badge || 'Официальная поставка'}</span>
            <span class="card-brand">${robot.brand}</span>
          </div>

          <div class="robot-card-img-wrap">
            <img src="${robot.image || 'assets/cards/ph-go2-pro-1.webp'}" alt="${robot.name}" loading="lazy" />
          </div>

          <h3 class="robot-card-name">${robot.name}</h3>
          <p class="robot-card-desc">${robot.desc || robot.full_desc || ''}</p>

          <div class="specs-mini-grid">
            ${specsEntries.map(([k, v]) => `
              <div class="spec-mini-item">
                <span class="spec-mini-lbl">${k}</span>
                <span class="spec-mini-val" title="${v}">${v}</span>
              </div>
            `).join('')}
          </div>

          <div class="robot-card-bottom">
            <div class="price-block">
              <div class="price-val" style="color: var(--accent-mint); font-family: var(--font-mono); font-weight: 800; font-size: 1.15rem;">${robot.price_label || 'По запросу'}</div>
              <div class="price-lease" style="font-size: 0.74rem; color: var(--text-muted);">${robot.price_sub || 'Расчёт с НДС и доставкой по РК'}</div>
              ${configTag}
            </div>
            <div class="card-actions">
              <button class="btn-card-cart" data-action="add-cart" data-slug="${robot.slug}" aria-label="Добавить ${robot.name} в спецификацию КП" title="Добавить в коммерческое предложение">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="12" y1="18" x2="12" y2="12"></line>
                  <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
                <span>+ В смету</span>
              </button>
            </div>
          </div>

          <div class="card-click-hint">
            <span>Подробнее о модели</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"></path></svg>
          </div>
        </article>
      `;
    }).join('');
  }

  function resetAllFilters() {
    currentCategory = 'all';
    currentBrand = 'all';
    currentSearch = '';
    if (searchInput) searchInput.value = '';
    
    categoryPills.forEach(p => p.classList.toggle('active', p.dataset.category === 'all'));
    brandBtns.forEach(b => b.classList.toggle('active', b.dataset.brand === 'all'));
    renderCatalog();
  }

  // Filter events
  categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      categoryPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.dataset.category;
      renderCatalog();
    });
  });

  brandBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      brandBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentBrand = btn.dataset.brand;
      renderCatalog();
    });
  });

  searchInput?.addEventListener('input', (e) => {
    currentSearch = e.target.value;
    renderCatalog();
  });

  sortSelect?.addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderCatalog();
  });

  // Delegate clicks on catalog cards: clicking ANYWHERE on a card opens full info!
  robotsGrid?.addEventListener('click', (e) => {
    // 1. If clicked specifically on "+ В смету" button
    const cartBtn = e.target.closest('button[data-action="add-cart"]');
    if (cartBtn) {
      e.stopPropagation();
      const slug = cartBtn.dataset.slug;
      if (slug) addToCart(slug);
      return;
    }

    // 2. Clicking anywhere on the robot card (photo, title, specs, etc.) opens full modal!
    const card = e.target.closest('.robot-card');
    if (card) {
      const slug = card.dataset.slug;
      if (slug) {
        openProductModal(slug, card);
      }
    }
  });

  // Filter catalog when clicking industry CTA buttons
  document.querySelectorAll('.industry-cta[data-filter-cat]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = btn.dataset.filterCat;
      if (!cat) return;
      currentCategory = cat;
      categoryPills.forEach(p => p.classList.toggle('active', p.dataset.category === cat));
      renderCatalog();
      const catalogEl = document.getElementById('catalog');
      if (catalogEl) {
        catalogEl.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Support Enter / Space keyboard navigation on robot cards
  robotsGrid?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.robot-card');
      if (card && (e.target === card || !e.target.matches('button, a, input'))) {
        e.preventDefault();
        const slug = card.dataset.slug;
        if (slug) openProductModal(slug, card);
      }
    }
  });

  // === 2. MODAL DIALOG (MODERN-WEB-GUIDANCE COMPLIANT) ===
  function openProductModal(slug, trigger = null) {
    const robot = (typeof ROBOTS_DATA !== 'undefined' ? ROBOTS_DATA : []).find(r => r.slug === slug);
    if (!robot || !productDialog) return;

    lastModalTrigger = trigger || document.activeElement;

    let activeEdition = (robot.editions && robot.editions.length > 0) ? robot.editions[0] : null;

    function renderModalContent() {
      const currentPriceLabel = robot.price_label || 'По запросу';
      const currentPriceSub = robot.price_sub || 'Расчёт с НДС и доставкой по РК';
      const currentDesc = activeEdition ? activeEdition.desc : (robot.full_desc || robot.desc || '');
      const currentSpecs = (activeEdition && activeEdition.specs) ? activeEdition.specs : (robot.specs || {});
      const currentName = activeEdition ? `${robot.name} (${activeEdition.name})` : robot.name;

      const specsRows = Object.entries(currentSpecs).map(([k, v]) => `
        <tr>
          <th>${k}</th>
          <td>${v}</td>
        </tr>
      `).join('');

      const editionsHtml = (robot.editions && robot.editions.length > 0) ? `
        <div class="edition-selector-box">
          <span class="edition-selector-lbl">Выберите модификацию / комплектацию:</span>
          <div class="edition-pills-row">
            ${robot.editions.map((ed, idx) => `
              <button type="button" class="edition-pill-btn ${ed.name === activeEdition.name ? 'active' : ''}" data-edition-idx="${idx}">
                ${ed.name}
              </button>
            `).join('')}
          </div>
        </div>
      ` : '';

      const accessoriesHtml = (robot.accessories && robot.accessories.length > 0) ? `
        <div class="modal-accessories-box">
          <h4 class="modal-accessories-title">Ключевые модульные надстройки и аксессуары:</h4>
          <div class="modal-accessories-grid">
            ${robot.accessories.map(acc => `
              <div class="modal-acc-card">
                <img src="${acc.image}" alt="${acc.name}" loading="lazy" />
                <h5>${acc.name}</h5>
                <p>${acc.desc}</p>
              </div>
            `).join('')}
          </div>
        </div>
      ` : '';

      dialogContent.innerHTML = `
        <div class="modal-inner">
          <div class="modal-header">
            <div class="modal-header-title-wrap">
              <span class="card-badge">${robot.badge || 'Официальная поставка'}</span>
              <h3 id="productDialogTitle">${robot.name}</h3>
            </div>
            <button type="button" class="modal-close-btn" id="closeModalBtn" aria-label="Закрыть окно" autofocus>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6 6 18M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="modal-img-wrap">
              <img src="${robot.image || 'assets/cards/ph-go2-pro-1.webp'}" alt="${robot.name}" />
            </div>
            <div class="modal-details">
              ${editionsHtml}

              <p class="modal-desc">${currentDesc}</p>
              
              <h4 style="font-size: 0.96rem; margin-bottom: 10px; color: #fff;">Технические спецификации:</h4>
              <table class="modal-specs-table">
                <tbody>${specsRows}</tbody>
              </table>

              ${accessoriesHtml}

              <div style="background: rgba(75, 227, 160, 0.06); border: 1px solid rgba(75, 227, 160, 0.2); border-radius: var(--radius-sm); padding: 12px; margin-top: 16px;">
                <div style="font-size: 0.82rem; font-weight: 700; color: var(--accent-mint); margin-bottom: 6px;">Условия поставки в Казахстане:</div>
                <div style="font-size: 0.78rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-mint)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>В наличии в Алматы / Доставка 1–3 дня по всему Казахстану</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-mint)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>Официальная гарантия 12 месяцев + авторизованный сервис ${CFG.brandName}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-mint)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>Обучение операторов и инженеров заказчика с выдачей сертификата</span>
                  </div>
                </div>
              </div>

              <div class="modal-kp-explain" style="margin-top: 10px; font-size: 0.76rem; color: var(--text-muted); display: flex; align-items: flex-start; gap: 6px; line-height: 1.4;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-mint)" stroke-width="2" style="flex-shrink: 0; margin-top: 2px;">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 16v-4"></path>
                  <path d="M12 8h.01"></path>
                </svg>
                <span><strong>КП (Коммерческое предложение)</strong> — официальный расчет стоимости со спецификацией, гарантией и НДС 12% для юридических и физических лиц.</span>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <div class="modal-price-box">
              <div class="m-price">${currentPriceLabel}</div>
              <div class="m-lease">${currentPriceSub}</div>
            </div>
            <div class="modal-actions">
              <a href="https://wa.me/${CFG.whatsappNumber}?text=${encodeURIComponent('Здравствуйте! Интересует робот ' + currentName + ' от ' + CFG.brandName + '. Прошу отправить расчет КП и условия поставки.')}" 
                 target="_blank" class="btn-secondary" style="padding: 10px 18px; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.983.541 1.836.828 2.801.829l.005-.001c3.182 0 5.767-2.587 5.768-5.766 0-3.18-2.586-5.765-5.778-5.765zm9.969 5.768c0 5.518-4.482 10-10 10-1.705 0-3.32-.435-4.735-1.196l-5.265 1.381 1.405-5.132c-.859-1.488-1.355-3.218-1.355-5.053 0-5.518 4.482-10 10-10 5.518 0 10 4.482 10 10z"/>
                </svg>
                WhatsApp
              </a>
              <button class="btn-primary" style="padding: 10px 22px; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 8px;" id="modalAddCartBtn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="12" y1="18" x2="12" y2="12"></line>
                  <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
                + В смету
              </button>
            </div>
          </div>
        </div>
      `;

      document.getElementById('closeModalBtn')?.addEventListener('click', () => productDialog.close());

      dialogContent.querySelectorAll('.edition-pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.editionIdx, 10);
          if (robot.editions && robot.editions[idx]) {
            activeEdition = robot.editions[idx];
            renderModalContent();
          }
        });
      });

      document.getElementById('modalAddCartBtn')?.addEventListener('click', () => {
        if (activeEdition) {
          addToCart(robot.slug, {
            slug: robot.slug,
            customId: `${robot.slug}-${activeEdition.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            name: `${robot.name} (${activeEdition.name})`,
            price_label: robot.price_label || 'По запросу',
            image: robot.image,
            badge: robot.badge
          });
        } else {
          addToCart(robot.slug);
        }
        productDialog.close();
      });
    }

    renderModalContent();
    productDialog.showModal();

    const firstInteractive = productDialog.querySelector('button, [href], input, select, textarea');
    if (firstInteractive) firstInteractive.focus();
  }

  // Restore focus to invoker trigger on modal close
  productDialog?.addEventListener('close', () => {
    if (lastModalTrigger && typeof lastModalTrigger.focus === 'function') {
      lastModalTrigger.focus();
      lastModalTrigger = null;
    }
  });

  // Light-dismiss fallback
  if (!('closedBy' in HTMLDialogElement.prototype) && productDialog) {
    const outside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    productDialog.addEventListener('pointerdown', (e) => {
      pressedOutside = outside(e, productDialog);
    });
    productDialog.addEventListener('pointerup', (e) => {
      if (pressedOutside && outside(e, productDialog)) {
        productDialog.close();
      }
    });
  }

  // === 3. SPECIFICATION / QUOTE DRAWER ===
  function updateCartBadges() {
    const totalUnits = cart.reduce((sum, it) => sum + (it.quantity || 1), 0);
    cartCountBadges.forEach(b => b.textContent = totalUnits);
    localStorage.setItem('orda_cart', JSON.stringify(cart));
  }

  function addToCart(slug, customItem = null) {
    const robot = (typeof ROBOTS_DATA !== 'undefined' ? ROBOTS_DATA : []).find(r => r.slug === slug);
    if (!robot && !customItem) return;
    
    const itemToAdd = customItem || robot;
    const itemKey = itemToAdd.customId || itemToAdd.slug;

    const existing = cart.find(it => (it.customId || it.slug) === itemKey);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
      showToast(`«${itemToAdd.name || robot.name}» (количество: ${existing.quantity} шт.)`);
    } else {
      cart.push({
        slug: robot ? robot.slug : itemToAdd.slug,
        customId: itemKey,
        name: itemToAdd.name || robot.name,
        price_label: itemToAdd.price_label || 'По запросу',
        image: itemToAdd.image || (robot ? robot.image : 'assets/cards/ph-go2-pro-1.webp'),
        badge: itemToAdd.badge || (robot ? robot.badge : 'Официальная поставка'),
        quantity: 1
      });
      showToast(`«${itemToAdd.name || robot.name}» добавлена в спецификацию!`);
    }

    updateCartBadges();
    renderDrawerItems();
  }

  function changeItemQty(key, delta) {
    const item = cart.find(it => (it.customId || it.slug) === key);
    if (!item) return;

    item.quantity = (item.quantity || 1) + delta;
    if (item.quantity <= 0) {
      cart = cart.filter(it => (it.customId || it.slug) !== key);
      showToast('Позиция удалена из спецификации');
    }
    updateCartBadges();
    renderDrawerItems();
  }

  function removeFromCart(key) {
    cart = cart.filter(item => (item.customId || item.slug) !== key);
    updateCartBadges();
    renderDrawerItems();
    showToast('Позиция удалена из спецификации');
  }

  function renderDrawerItems() {
    if (!drawerItems) return;

    if (cart.length === 0) {
      drawerItems.innerHTML = `
        <div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">
          <p>В вашей спецификации пока нет моделей.</p>
          <p style="font-size: 0.84rem; margin-top: 8px;">Выберите интересующие модели в каталоге и нажмите <strong>«+ В смету»</strong>.</p>
        </div>
      `;
      if (drawerTotalUnits) drawerTotalUnits.textContent = '0 ед.';
      return;
    }

    const totalUnits = cart.reduce((sum, it) => sum + (it.quantity || 1), 0);

    drawerItems.innerHTML = cart.map(item => {
      const key = item.customId || item.slug;
      const qty = item.quantity || 1;
      return `
        <div class="cart-item">
          <img src="${item.image || 'assets/cards/ph-go2-pro-1.webp'}" alt="${item.name}" />
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price" style="color: var(--accent-mint); font-weight: 700;">${item.price_label || 'По запросу'}</div>
            
            <div class="cart-item-qty">
              <button type="button" class="qty-btn" data-action="minus" data-key="${key}" aria-label="Уменьшить количество">-</button>
              <span class="qty-val">${qty} шт.</span>
              <button type="button" class="qty-btn" data-action="plus" data-key="${key}" aria-label="Увеличить количество">+</button>
            </div>
          </div>
          <button class="cart-item-del" data-key="${key}" title="Удалить" aria-label="Удалить ${item.name} из спецификации">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;
    }).join('');

    if (drawerTotalUnits) {
      drawerTotalUnits.textContent = `${totalUnits} ед.`;
    }

    // Bind quantity buttons
    drawerItems.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        const action = btn.dataset.action;
        changeItemQty(key, action === 'plus' ? 1 : -1);
      });
    });

    // Bind delete buttons
    drawerItems.querySelectorAll('.cart-item-del').forEach(btn => {
      btn.addEventListener('click', () => removeFromCart(btn.dataset.key));
    });
  }

  function openDrawer(trigger = null) {
    lastDrawerTrigger = trigger || document.activeElement;
    renderDrawerItems();
    cartDrawer?.classList.add('open');
    drawerBackdrop?.classList.add('open');
    setBodyLock(true);
    closeDrawerBtn?.focus();
  }

  function closeDrawer() {
    cartDrawer?.classList.remove('open');
    drawerBackdrop?.classList.remove('open');
    setBodyLock(false);
    if (lastDrawerTrigger && typeof lastDrawerTrigger.focus === 'function') {
      lastDrawerTrigger.focus();
      lastDrawerTrigger = null;
    }
  }

  cartTriggers.forEach(t => t.addEventListener('click', (e) => openDrawer(e.currentTarget)));
  closeDrawerBtn?.addEventListener('click', (e) => { e.preventDefault(); closeDrawer(); });
  drawerBackdrop?.addEventListener('click', closeDrawer);

  // Send Cart via WhatsApp
  document.getElementById('sendCartWhatsAppBtn')?.addEventListener('click', () => {
    if (cart.length === 0) {
      showToast('Добавьте хотя бы одну модель в спецификацию!');
      return;
    }
    const robotLines = cart.map(c => `• ${c.name} — ${c.quantity || 1} шт. (${c.price_label || 'По запросу'})`).join('\n');
    const totalUnits = cart.reduce((sum, it) => sum + (it.quantity || 1), 0);
    const msg = `Здравствуйте, ${CFG.brandName}! Прошу подготовить официальное коммерческое предложение и счет на следующие позиции:\n\n${robotLines}\n\nВсего оборудования: ${totalUnits} ед.\nПрошу рассчитать с НДС 12% и доставкой по Казахстану.`;
    window.open(`https://wa.me/${CFG.whatsappNumber}?text=${encodeURIComponent(msg)}`, '_blank');
  });

  // === 4. MOBILE BURGER MENU ===
  function openMobileMenu() {
    if (!menuToggle) return;
    if (mobileNav) {
      mobileNav.classList.add('open');
      mobileNav.setAttribute('aria-hidden', 'false');
    }
    if (mobileNavBackdrop) {
      mobileNavBackdrop.classList.add('open');
    }
    if (mainNav) {
      mainNav.classList.add('open');
    }
    menuToggle.classList.add('active');
    menuToggle.setAttribute('aria-expanded', 'true');
    setBodyLock(true);
  }

  function closeMobileMenu() {
    if (!menuToggle) return;
    if (mobileNav) {
      mobileNav.classList.remove('open');
      mobileNav.setAttribute('aria-hidden', 'true');
    }
    if (mobileNavBackdrop) {
      mobileNavBackdrop.classList.remove('open');
    }
    if (mainNav) {
      mainNav.classList.remove('open');
    }
    menuToggle.classList.remove('active');
    menuToggle.setAttribute('aria-expanded', 'false');
    setBodyLock(false);
  }

  function toggleMobileMenu() {
    const isOpen = (mobileNav && mobileNav.classList.contains('open')) || (mainNav && mainNav.classList.contains('open'));
    if (isOpen) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  }

  menuToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMobileMenu();
  });

  closeMobileNav?.addEventListener('click', closeMobileMenu);
  mobileNavBackdrop?.addEventListener('click', closeMobileMenu);

  document.addEventListener('click', (e) => {
    const isMobileNavOpen = mobileNav?.classList.contains('open');
    const isMainNavOpen = mainNav?.classList.contains('open');
    if ((isMobileNavOpen || isMainNavOpen) && !mobileNav?.contains(e.target) && !mainNav?.contains(e.target) && !menuToggle?.contains(e.target)) {
      closeMobileMenu();
    }
  });

  // Close menu & smooth scroll when link is clicked + Scrollspy + Stuck header state
  const navSectionLinks = document.querySelectorAll('.nav-links a, .mobile-nav-links a');
  const supportsScrollTargetGroup = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('scroll-target-group: auto');

  function setManualActiveNav(href) {
    navSectionLinks.forEach(link => {
      const isMatch = Boolean(href) && link.getAttribute('href') === href;
      link.classList.toggle('target-current', isMatch);
      link.classList.toggle('active', isMatch);
      link.setAttribute('aria-current', isMatch ? 'true' : 'false');
    });
  }

  const allNavLinks = document.querySelectorAll('.nav-links a, .mobile-nav-links a, .mobile-cta-btn, .brand-logo');
  allNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      closeMobileMenu();
      const href = link.getAttribute('href');
      if (href === '#') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (!supportsScrollTargetGroup) setManualActiveNav(null);
        if (history.pushState) {
          history.pushState(null, '', window.location.pathname + window.location.search);
        }
        return;
      }
      if (href && href.startsWith('#') && href.length > 1) {
        const targetSection = document.querySelector(href);
        if (targetSection) {
          e.preventDefault();
          if (!supportsScrollTargetGroup) {
            setManualActiveNav(href);
          } else {
            navSectionLinks.forEach(item => {
              item.setAttribute('aria-current', item.getAttribute('href') === href ? 'true' : 'false');
            });
          }
          targetSection.scrollIntoView({ behavior: 'smooth' });
          if (history.pushState) {
            history.pushState(null, '', href);
          }
        }
      }
    });
  });

  // Scrollspy (Native CSS scroll-target-group when supported, IntersectionObserver fallback otherwise)
  if (supportsScrollTargetGroup) {
    let scrollSyncRaf = 0;
    const syncAriaCurrent = () => {
      const currentLink = document.querySelector('#mainNav a:target-current, .mobile-nav-links a:target-current');
      const activeHref = currentLink ? currentLink.getAttribute('href') : null;
      navSectionLinks.forEach(link => {
        const isMatch = Boolean(activeHref) && link.getAttribute('href') === activeHref;
        link.setAttribute('aria-current', isMatch ? 'true' : 'false');
        if (link.closest('.mobile-nav-links')) {
          link.classList.toggle('target-current', isMatch);
        }
      });
    };
    const scheduleSync = () => {
      if (scrollSyncRaf) return;
      scrollSyncRaf = requestAnimationFrame(() => {
        scrollSyncRaf = 0;
        syncAriaCurrent();
      });
    };
    syncAriaCurrent();
    document.addEventListener('scrollend', syncAriaCurrent);
    window.addEventListener('scroll', scheduleSync, { passive: true });
    menuToggle?.addEventListener('click', syncAriaCurrent);
  } else {
    const sectionTargets = Array.from(document.querySelectorAll('#mainNav a[href^="#"]'))
      .map(link => document.querySelector(link.getAttribute('href')))
      .filter(Boolean);

    if (sectionTargets.length > 0 && 'IntersectionObserver' in window) {
      const sectionObserver = new IntersectionObserver((entries) => {
        if (window.scrollY < 160) {
          setManualActiveNav(null);
          return;
        }
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            if (id) setManualActiveNav(`#${id}`);
          }
        });
      }, { rootMargin: '-22% 0px -60% 0px', threshold: 0 });

      sectionTargets.forEach(sec => sectionObserver.observe(sec));

      window.addEventListener('scroll', () => {
        if (window.scrollY < 160) {
          setManualActiveNav(null);
        }
      }, { passive: true });
    }
  }

  // Fallback for Firefox/Safari where container-type: scroll-state is not yet supported
  const siteHeader = document.getElementById('siteHeader') || document.querySelector('.site-header');
  const supportsScrollState = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('container-type: scroll-state');
  if (siteHeader && !supportsScrollState) {
    if ('IntersectionObserver' in window) {
      const headerObserver = new IntersectionObserver(([entry]) => {
        entry.target.classList.toggle('is-stuck', entry.intersectionRatio < 1);
      }, {
        threshold: [1],
        rootMargin: '-1px 0px 0px 0px'
      });
      headerObserver.observe(siteHeader);
    } else {
      window.addEventListener('scroll', () => {
        siteHeader.classList.toggle('is-stuck', window.scrollY > 4);
      }, { passive: true });
    }
  }

  // Escape key handling
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      if (productDialog && productDialog.open) {
        productDialog.close();
        return;
      }
      if (cartDrawer && cartDrawer.classList.contains('open')) {
        closeDrawer();
        return;
      }
      if ((mobileNav && mobileNav.classList.contains('open')) || (mainNav && mainNav.classList.contains('open'))) {
        closeMobileMenu();
        menuToggle?.focus();
        return;
      }
    }
  });

  // === 5. ENGINEERING CONFIGURATOR (DYNAMIC LOGIC) ===
  let cfgState = {
    sphere: 'cleaning',
    scale: 'small',
    features: ['narrow']
  };

  const scaleOptions = {
    cleaning: [
      { id: 'small', label: '100 – 800 м² (компактный)' },
      { id: 'medium', label: '800 – 5 000 м² (средний)' },
      { id: 'large', label: 'более 5 000 м² (крупный флот)' }
    ],
    horeca: [
      { id: 'small', label: 'до 200 м² (кафе / кофейня)' },
      { id: 'medium', label: '200 – 1 000 м² (ресторан)' },
      { id: 'large', label: 'Отель / мультиэтажный комплекс' }
    ],
    amr: [
      { id: 'small', label: 'до 20 кг (детали / лотки)' },
      { id: 'medium', label: 'до 300 кг (T300 конвейер / тележки)' },
      { id: 'large', label: 'до 600 кг (T600 / Lifting Rack)' }
    ],
    rnd: [
      { id: 'small', label: 'Базовый SDK (Go2 EDU / Python)' },
      { id: 'medium', label: 'Промышленный IP67 (Unitree B2 / D5)' },
      { id: 'large', label: 'Гуманоидный комплекс (Unitree G1 / R1)' }
    ],
    event: [
      { id: 'small', label: 'Робособака (трюки / фотозона)' },
      { id: 'medium', label: '18.5" Промо-экран (KettyBot Pro)' },
      { id: 'large', label: 'Спортивный гуманоид (Unitree R1)' }
    ]
  };

    const sphereRecommendations = {
    'cleaning-small': {
      name: 'PUDU ET1 (Компактный поломой)',
      desc: 'Идеален для площадей 100–800 м². Горячая мойка 85°C и автоматическая рабочая станция 8-в-1 для автономного слива, сушки и дезинфекции.',
      image: 'assets/cards/ph-pudu-et1-1.webp',
      slug: 'pudu-et1',
      spec1: 'до 800 м²/ч',
      spec2: 'Горячая мойка 85°C',
      spec3: 'Док-станция 8-в-1 • автослив и залив'
    },
    'cleaning-medium': {
      name: 'PUDU CC1 Pro (Клининговый комбайн 4-в-1)',
      desc: 'Флагман для торговых и бизнес-центров до 5 000 м². Одновременное мытье, подметание, скраббер и сушка пола.',
      image: 'assets/cards/ph-pudu-cc1-1.webp',
      slug: 'pudu-cc1',
      spec1: '1 000 м²/ч',
      spec2: 'Уборка 4-в-1 (мытьё, сушка, скраббер)',
      spec3: 'до 12 000 м²/день флотом'
    },
    'cleaning-large': {
      name: 'PUDU CC1 Pro + PUDU BG1',
      desc: 'Комплексный клининговый флот для логистических терминалов и мега-моллов свыше 5 000 м² с единой системой координации.',
      image: 'assets/cards/ph-pudu-cc1-1.webp',
      slug: 'pudu-cc1',
      spec1: 'до 12 000 м²/день',
      spec2: 'Централизованная координация флота',
      spec3: 'Автономная рабочая станция'
    },
    'horeca-small': {
      name: 'PuduBot 2 (с защитным кейсом)',
      desc: 'Компактная доставка до 400 заказов в день. Закрытый гигиеничный кейс Protection Case с магнитными створками.',
      image: 'assets/cards/ph-pudu-pudubot-2-1.webp',
      slug: 'pudu-pudubot-2',
      spec1: 'до 400 заказов/день',
      spec2: 'Заменяет до 5 официантов',
      spec3: 'До 20 кг • до 6 ч работы'
    },
    'horeca-medium': {
      name: 'PUDU BellaBot Pro',
      desc: 'Премиальный робот-официант с мимикой, мультимодальным голосовым диалогом и 4 уровнями подносов с подсветкой.',
      image: 'assets/cards/ph-pudu-bellabot-1.webp',
      slug: 'pudu-bellabot',
      spec1: 'до 400 заказов/день',
      spec2: '4 независимых лотка с подсветкой',
      spec3: 'до 40 кг • до 24 ч работы'
    },
    'horeca-large': {
      name: 'PUDU FlashBot Max (Межэтажная доставка)',
      desc: 'Автономная интеграция с лифтовыми контроллерами и системами отелей для круглосуточного рум-сервиса без персонала.',
      image: 'assets/cards/ph-pudu-flashbot-max-1.webp',
      slug: 'pudu-flashbot-max',
      spec1: 'Интеграция с лифтовыми контроллерами',
      spec2: 'Автономный рум-сервис 24/7',
      spec3: 'Закрытый бокс 30 л • до 12 ч'
    },
    'amr-small': {
      name: 'PUDU T300 AMR (Многоярусный лоток Tray)',
      desc: 'Автономная тележка для межоперационной доставки коробов и компонентов в цехах с узкими проходами от 80 см.',
      image: 'assets/cards/ph-pudu-t300-1.webp',
      slug: 'pudu-t300',
      spec1: 'Узкие проходы от 80 см',
      spec2: 'Многоярусный лоток Tray',
      spec3: 'до 100 кг на ярус • точность ±10 мм'
    },
    'amr-medium': {
      name: 'PUDU T300 AMR (Роликовый конвейер)',
      desc: 'Автоматическая стыковка с производственными конвейерами (±10 мм) для бесперебойного перемещения тары.',
      image: 'assets/cards/ph-pudu-t300-1.webp',
      slug: 'pudu-t300',
      spec1: 'Автоматическая стыковка с конвейером',
      spec2: 'Интеграция с заводской WMS/ERP',
      spec3: 'Грузоподъёмность 300 кг'
    },
    'amr-large': {
      name: 'PUDU T300 / T600 (Подъемная стойка Lifting Rack)',
      desc: 'Тяжелый тягач с ножничным или серво-подъемником для паллет до 600 кг внутри заводских складов.',
      image: 'assets/cards/ph-pudu-t300-1.webp',
      slug: 'pudu-t300',
      spec1: 'Подъёмная стойка Lifting Rack',
      spec2: 'Транспортировка паллет до 600 кг',
      spec3: 'Грузоподъёмность 300/600 кг'
    },
    'rnd-small': {
      name: 'Unitree Go2 EDU (Открытая платформа ROS2)',
      desc: 'Полный доступ к ROS2, Python и C++ API, чтение токов моторов и 4D LiDAR для лабораторий и ВУЗов Казахстана.',
      image: 'assets/cards/ph-go2-pro-1.webp',
      slug: 'go2-pro',
      spec1: 'Скорость до 3.7 м/с',
      spec2: 'Открытый стек ROS2 / Python / C++',
      spec3: '4D-LiDAR 360°x90° • нагрузка до 8-10 кг'
    },
    'rnd-medium': {
      name: 'Unitree B2 / PUDU D5 (Промышленный класс IP67)',
      desc: 'Работа при -20°C...+55°C, защита IP67, автономность до 5 часов и преодоление уклонов до 45° для патрулирования промзон.',
      image: 'assets/cards/u-b2.webp',
      slug: 'unitree-b2',
      spec1: 'Патруль промзон IP67 (уклоны 45°)',
      spec2: 'Работа от -20°C до +55°C',
      spec3: 'Нагрузка 40–50 кг • до 5 ч работы'
    },
    'rnd-large': {
      name: 'Unitree G1 Humanoid (Робот-гуманоид 43 DoF)',
      desc: 'Антропоморфная платформа ростом 127 см с манипуляторами Dex3-1, GPT-интеллектом и передовой динамической стабилизацией.',
      image: 'assets/cards/u-g1.webp',
      slug: 'unitree-g1',
      spec1: 'Рост 127 см / вес 35 кг',
      spec2: 'до 43 степеней свободы',
      spec3: 'Манипуляторы Dex3-1 • GPT диалог'
    },
    'event-small': {
      name: 'Unitree Go2 Pro (Шоу и фотозона)',
      desc: 'Синхронные сальто, танцы, интерактивный голосовой диалог с гостями и максимальное внимание прессы на выставках.',
      image: 'assets/cards/ph-go2-pro-1.webp',
      slug: 'go2-pro',
      spec1: 'Скорость до 3.7 м/с',
      spec2: 'Интерактивное шоу, сальто и трюки',
      spec3: 'Аренда с сертифицированным оператором'
    },
    'event-medium': {
      name: 'PUDU KettyBot Pro (18.5" HD Промо-экран)',
      desc: 'Робот-промоутер для трансляции ваших видеороликов, навигации по стенду форума и раздачи welcome-дринков.',
      image: 'assets/cards/ph-pudu-kettybot-pro-1.webp',
      slug: 'pudu-kettybot-pro',
      spec1: '18.5" вертикальный рекламный HD-экран',
      spec2: 'Круизный обход и лидогенерация',
      spec3: 'Поднос для напитков • до 8 ч'
    },
    'event-large': {
      name: 'Unitree R1 (Спортивный гуманоид)',
      desc: 'Сверхлегкий атлетичный гуманоид весом 25–29 кг с 20–26 степенями свободы для акробатики, бега и WOW-презентаций.',
      image: 'assets/cards/u-r1.webp',
      slug: 'unitree-r1',
      spec1: 'Спортивная динамика до 3.3 м/с',
      spec2: 'Акробатика, сальто и бег (20–26 DoF)',
      spec3: 'Сверхлегкий вес 25–29 кг'
    }
  };

    function updateConfiguratorRecommendation() {
    const key = `${cfgState.sphere}-${cfgState.scale}`;
    const rec = sphereRecommendations[key] || sphereRecommendations[`${cfgState.sphere}-small`] || sphereRecommendations['cleaning-small'];

    // Dynamic catalog lookup for 100% working image & fallback
    const robotMatch = (typeof ROBOTS_DATA !== 'undefined' ? ROBOTS_DATA : []).find(r => r.slug === rec.slug);
    const finalImage = (robotMatch && robotMatch.image) ? robotMatch.image : rec.image;

    const titleEl = document.getElementById('cfgResultTitle');
    const descEl = document.getElementById('cfgResultDesc');
    const imgEl = document.getElementById('cfgResultImg');
    const spec1El = document.getElementById('cfgResultSpec1');
    const spec2El = document.getElementById('cfgResultSpec2');
    const spec3El = document.getElementById('cfgResultSpec3');
    const waBtn = document.getElementById('cfgWhatsAppBtn');
    const addBtn = document.getElementById('cfgAddSpecBtn');

    if (titleEl) titleEl.textContent = rec.name;
    if (descEl) descEl.textContent = rec.desc;
    if (imgEl) {
      imgEl.src = finalImage;
      imgEl.alt = rec.name;
    }
    if (spec1El) spec1El.textContent = rec.spec1;
    if (spec2El) spec2El.textContent = rec.spec2;
    if (spec3El) spec3El.textContent = rec.spec3;

    if (waBtn) {
      const msg = `Здравствуйте, ${CFG.brandName}! Я подобрал решение в инженерном конфигураторе на сайте:\n• Рекомендация: ${rec.name}\n• Сфера: ${cfgState.sphere}\n• Масштаб/нагрузка: ${cfgState.scale}\n• Особенности: ${cfgState.features.join(', ')}\n\nПрошу отправить технико-экономическое обоснование (ТЭО) и официальное КП с НДС 12%.`;
      waBtn.href = `https://wa.me/${CFG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
    }

    if (addBtn) {
      addBtn.onclick = () => {
        addToCart(rec.slug);
      };
    }
  }

  function renderScaleOptions() {
    const scaleGroup = document.getElementById('cfgScaleGroup');
    if (!scaleGroup) return;

    const opts = scaleOptions[cfgState.sphere] || scaleOptions.cleaning;
    scaleGroup.innerHTML = opts.map((opt, i) => `
      <button type="button" class="cfg-tag-btn ${opt.id === cfgState.scale ? 'active' : ''}" data-scale="${opt.id}">
        ${opt.label}
      </button>
    `).join('');

    scaleGroup.querySelectorAll('.cfg-tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        scaleGroup.querySelectorAll('.cfg-tag-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        cfgState.scale = btn.dataset.scale;
        updateConfiguratorRecommendation();
      });
    });
  }

  // Step 1: Sphere Click
  document.querySelectorAll('#cfgSphereGroup .cfg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#cfgSphereGroup .cfg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      cfgState.sphere = btn.dataset.sphere;
      cfgState.scale = 'small'; // reset to first
      renderScaleOptions();
      updateConfiguratorRecommendation();
    });
  });

  // Step 3: Features Click (multi-select)
  document.querySelectorAll('#cfgFeatureGroup .cfg-feat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const feat = btn.dataset.feature;
      if (btn.classList.contains('active')) {
        if (!cfgState.features.includes(feat)) cfgState.features.push(feat);
      } else {
        cfgState.features = cfgState.features.filter(f => f !== feat);
      }
      updateConfiguratorRecommendation();
    });
  });

  // Initial configurator setup
  renderScaleOptions();
  updateConfiguratorRecommendation();

  // === 6. HERO VISUAL TABS SWITCHER (AUTHENTIC B2B STATUS) ===
    const heroRobots = [
    {
      name: 'Unitree Go2 Pro',
      badge: 'Хит продаж в Казахстане',
      desc: 'Четвероногий робот с 4D-лидаром, GPT-интеллектом и максимальной проходимостью',
      price: 'По запросу',
      lease: 'Расчёт КП за 15 минут • Лизинг для юрлиц РК',
      img: 'assets/cards/ph-go2-pro-1.webp',
      slug: 'go2-pro'
    },
    {
      name: 'Unitree G1 Humanoid',
      badge: 'Новинка 2026',
      desc: 'Антропоморфный робот-гуманоид массового производства, до 43 степеней свободы',
      price: 'По запросу',
      lease: 'Расчёт КП за 15 минут • Лизинг для юрлиц РК',
      img: 'assets/cards/u-g1.webp',
      slug: 'unitree-g1'
    },
    {
      name: 'PUDU CC1 Pro',
      badge: 'В наличии в Алматы',
      desc: 'Автономный клининговый комбайн 4-в-1 для торговых центров и складов до 12 000 м²',
      price: 'По запросу',
      lease: 'Расчёт КП за 15 минут • Лизинг для юрлиц РК',
      img: 'assets/cards/ph-pudu-cc1-1.webp',
      slug: 'pudu-cc1'
    },
    {
      name: 'PUDU T300 AMR',
      badge: 'Для цехов и заводов',
      desc: 'Промышленная автономная платформа 300 кг для сопряжения с конвейерами цеха',
      price: 'По запросу',
      lease: 'Расчёт КП за 15 минут • Лизинг для юрлиц РК',
      img: 'assets/cards/ph-pudu-t300-1.webp',
      slug: 'pudu-t300'
    }
  ];

  const heroCardName = document.getElementById('heroCardName');
  const heroCardBadge = document.getElementById('heroCardBadge');
  const heroCardDesc = document.getElementById('heroCardDesc');
  const heroCardPrice = document.getElementById('heroCardPrice');
  const heroCardLease = document.getElementById('heroCardLease');
  const heroCardImg = document.getElementById('heroCardImg');
  const heroCardDetailsBtn = document.getElementById('heroCardDetailsBtn');
  const heroTabBtns = document.querySelectorAll('.hero-tab-btn');

  heroTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      heroTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const idx = parseInt(btn.dataset.idx || '0');
      const r = heroRobots[idx];
      if (r) {
        if (heroCardName) heroCardName.textContent = r.name;
        if (heroCardBadge) heroCardBadge.textContent = r.badge;
        if (heroCardDesc) heroCardDesc.textContent = r.desc;
        if (heroCardPrice) heroCardPrice.textContent = r.price;
        if (heroCardLease) heroCardLease.textContent = r.lease;
        if (heroCardImg) {
          heroCardImg.style.opacity = '0';
          setTimeout(() => {
            heroCardImg.src = r.img;
            heroCardImg.style.opacity = '1';
          }, 150);
        }
        if (heroCardDetailsBtn) {
          heroCardDetailsBtn.onclick = (e) => openProductModal(r.slug, e.currentTarget);
        }
      }
    });
  });

  if (heroCardDetailsBtn) {
    heroCardDetailsBtn.onclick = (e) => openProductModal('go2-pro', e.currentTarget);
  }

  // === 7. LEAD FORM SUBMISSION (ORDA ROBOTICS INTEGRATION) ===
  const leadForm = document.getElementById('leadForm');
  leadForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('leadName')?.value.trim() || '';
    const company = document.getElementById('leadCompany')?.value.trim() || '';
    const phone = document.getElementById('leadPhone')?.value.trim() || '';
    const city = document.getElementById('leadCity')?.value || CFG.cityPrimary;
    const robot = document.getElementById('leadRobot')?.value || 'Не выбрано';
    const messenger = document.querySelector('input[name="messenger"]:checked')?.value || 'WhatsApp';

    let text = `Заявка с сайта ${CFG.brandName} (${CFG.brandShort}):\nИмя: ${name}`;
    if (company) text += `\nКомпания: ${company}`;
    text += `\nТелефон: ${phone}\nГород поставки: ${city}\nИнтересует: ${robot}\nУдобная связь: ${messenger}`;

    if (cart.length > 0) {
      text += `\n\nВыбранные модели в спецификации:\n` + cart.map(c => `• ${c.name} — ${c.quantity || 1} шт. (${c.price_label || 'По запросу'})`).join('\n');
    }

    const whatsappUrl = `https://wa.me/${CFG.whatsappNumber}?text=${encodeURIComponent(text)}`;

    const submitBtn = leadForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправка...';
    }

    const leadPayload = {
      name,
      company,
      phone,
      city,
      robot,
      messenger,
      cart: cart.map(item => ({ slug: item.slug, name: item.name, quantity: item.quantity || 1, price: item.price_label })),
      sourceUrl: window.location.href,
      createdAt: new Date().toISOString()
    };

    if (window.location.protocol === 'file:') {
      showToast('Заявка сформирована! Перенаправляем в WhatsApp...');
      leadForm.reset();
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
      window.open(whatsappUrl, '_blank');
      return;
    }

    let isSuccess = false;
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(leadPayload)
      });
      if (response.ok) isSuccess = true;
    } catch (_err) {
      isSuccess = false;
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    }

    if (isSuccess) {
      showToast('Заявка зафиксирована в CRM! Открываем WhatsApp...');
    } else {
      showToast('Открываем WhatsApp с заполненной заявкой...');
    }
    leadForm.reset();
    setTimeout(() => {
      window.open(whatsappUrl, '_blank');
    }, 400);
  });

  // === 8. TOAST NOTIFICATIONS HELPER ===
  const toastContainer = document.getElementById('toastContainer');
  function showToast(message) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--accent-mint)">
        <path d="M20 6 9 17l-5-5"></path>
      </svg>
      <span>${message}</span>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // === 9. INITIALIZE ===
  function updateSearchPlaceholder() {
    if (!searchInput) return;
    if (window.innerWidth < 640) {
      searchInput.placeholder = 'Поиск по каталогу...';
    } else {
      searchInput.placeholder = 'Поиск по названию или параметрам...';
    }
  }
  updateSearchPlaceholder();
  window.addEventListener('resize', updateSearchPlaceholder);

  updateCartBadges();
  renderCatalog();
});
