/**
 * XBOT Robotics Kazakhstan - Client Application
 * Implements catalog filtering, native <dialog> modals, ROI calculator, 
 * cart/quote generator, mobile burger navigation, and WhatsApp business integration.
 */

document.addEventListener('DOMContentLoaded', () => {
  // === STATE ===
  let currentCategory = 'all';
  let currentBrand = 'all';
  let currentSearch = '';
  let currentSort = 'popular';
  
  let cart = JSON.parse(localStorage.getItem('xbot_cart') || '[]');

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
  const drawerTotalPrice = document.getElementById('drawerTotalPrice');
  const cartTriggers = document.querySelectorAll('.cart-trigger');
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');

  // Mobile Menu Elements
  const menuToggle = document.getElementById('menuToggle');
  const mainNav = document.getElementById('mainNav');
  const mobileNav = document.getElementById('mobileNav');
  const mobileNavBackdrop = document.getElementById('mobileNavBackdrop');
  const closeMobileNav = document.getElementById('closeMobileNav');

  // Centralized Body Scroll Lock Helper for drawers
  function setBodyLock(lock) {
    if (lock) {
      document.body.classList.add('body-lock');
    } else {
      const isDrawerOpen = cartDrawer?.classList.contains('open');
      const isMobileNavOpen = mobileNav?.classList.contains('open');
      if (!isDrawerOpen && !isMobileNavOpen) {
        document.body.classList.remove('body-lock');
      }
    }
  }

  // ROI Calculator Elements
  const roiIndustryBtns = document.querySelectorAll('.type-btn');
  const sliderStaff = document.getElementById('sliderStaff');
  const sliderSalary = document.getElementById('sliderSalary');
  const staffValBadge = document.getElementById('staffValBadge');
  const salaryValBadge = document.getElementById('salaryValBadge');
  const roiMonthlySavings = document.getElementById('roiMonthlySavings');
  const roiYearlySavings = document.getElementById('roiYearlySavings');
  const roiPaybackMonths = document.getElementById('roiPaybackMonths');
  const roiHoursSaved = document.getElementById('roiHoursSaved');

  // === 1. CATALOG RENDERING & FILTERING ===
  function renderCatalog() {
    if (!robotsGrid) return;

    let filtered = [...ROBOTS_DATA];

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
        (item.full_desc && item.full_desc.toLowerCase().includes(q))
      );
    }

    // Sort
    if (currentSort === 'price-asc') {
      filtered.sort((a, b) => (a.price_kzt || 999999999) - (b.price_kzt || 999999999));
    } else if (currentSort === 'price-desc') {
      filtered.sort((a, b) => (b.price_kzt || 0) - (a.price_kzt || 0));
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
      return `
        <article class="robot-card" data-slug="${robot.slug}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="Открыть подробные характеристики и видео ${robot.name}">
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
              <div class="price-val">${robot.price_label}</div>
              <div class="price-lease">${robot.lease_label}</div>
            </div>
            <div class="card-actions">
              <button class="btn-card-cart" data-action="add-cart" data-slug="${robot.slug}" aria-label="Добавить ${robot.name} в смету КП" title="Добавить в коммерческое предложение">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="12" y1="18" x2="12" y2="12"></line>
                  <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
                <span>+ В смету (КП)</span>
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
    // 1. If clicked specifically on "+ В смету (КП)" button
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
    const robot = ROBOTS_DATA.find(r => r.slug === slug);
    if (!robot || !productDialog) return;

    // Save triggering element to return focus on modal close
    lastModalTrigger = trigger || document.activeElement;

    const specsRows = Object.entries(robot.specs || {}).map(([k, v]) => `
      <tr>
        <th>${k}</th>
        <td>${v}</td>
      </tr>
    `).join('');

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
            <p class="modal-desc">${robot.full_desc || robot.desc || ''}</p>
            
            <h4 style="font-size: 0.96rem; margin-bottom: 10px; color: #fff;">Технические спецификации:</h4>
            <table class="modal-specs-table">
              <tbody>${specsRows}</tbody>
            </table>

            <div style="background: rgba(75, 227, 160, 0.06); border: 1px solid rgba(75, 227, 160, 0.2); border-radius: var(--radius-sm); padding: 12px; margin-top: auto;">
              <div style="font-size: 0.82rem; font-weight: 700; color: var(--accent-mint); margin-bottom: 6px;">Условия поставки в Казахстане:</div>
              <div style="font-size: 0.78rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-mint)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span>В наличии в Алматы / Доставка 1–3 дня по РК</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-mint)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span>Официальная гарантия 12 месяцев + выездной сервис XBOT</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-mint)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span>Обучение операторов с выдачей сертификата</span>
                </div>
              </div>
            </div>

            <div class="modal-kp-explain" style="margin-top: 10px; font-size: 0.76rem; color: var(--text-muted); display: flex; align-items: flex-start; gap: 6px; line-height: 1.4;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-mint)" stroke-width="2" style="flex-shrink: 0; margin-top: 2px;">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              <span><strong>КП (Коммерческое предложение)</strong> — официальный расчет стоимости со спецификацией, гарантией и НДС 12% для бухгалтерии или физлиц.</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <div class="modal-price-box">
            <div class="m-price">${robot.price_label}</div>
            <div class="m-lease">${robot.lease_label}</div>
          </div>
          <div class="modal-actions">
            <a href="https://wa.me/77779117499?text=${encodeURIComponent('Здравствуйте! Интересует робот ' + robot.name + '. Отправьте расчет КП и условия тест-драйва.')}" 
               target="_blank" class="btn-secondary" style="padding: 10px 18px; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.983.541 1.836.828 2.801.829l.005-.001c3.182 0 5.767-2.587 5.768-5.766 0-3.18-2.586-5.765-5.778-5.765zm9.969 5.768c0 5.518-4.482 10-10 10-1.705 0-3.32-.435-4.735-1.196l-5.265 1.381 1.405-5.132c-.859-1.488-1.355-3.218-1.355-5.053 0-5.518 4.482-10 10-10 5.518 0 10 4.482 10 10z"/>
              </svg>
              WhatsApp
            </a>
            <button class="btn-primary" style="padding: 10px 22px; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 8px;" id="modalAddCartBtn" data-slug="${robot.slug}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
              Добавить в смету (КП)
            </button>
          </div>
        </div>
      </div>
    `;

    // Hook buttons inside modal
    document.getElementById('closeModalBtn')?.addEventListener('click', () => productDialog.close());
    document.getElementById('modalAddCartBtn')?.addEventListener('click', () => {
      addToCart(robot.slug);
      productDialog.close();
    });

    // Show modal (native <dialog> with CSS overscroll-behavior handles page scroll containment)
    productDialog.showModal();

    // Ensure focus moves to first interactive control inside modal
    const firstInteractive = productDialog.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstInteractive) {
      firstInteractive.focus();
    }
  }

  // Restore focus to invoker trigger on modal close
  productDialog?.addEventListener('close', () => {
    if (lastModalTrigger && typeof lastModalTrigger.focus === 'function') {
      lastModalTrigger.focus();
      lastModalTrigger = null;
    }
  });

  // Light-dismiss fallback for browsers without 'closedBy' support (Modern Web Guidance)
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

  // === 3. CART / QUOTE DRAWER ===
  function updateCartBadges() {
    const count = cart.length;
    cartCountBadges.forEach(b => b.textContent = count);
    localStorage.setItem('xbot_cart', JSON.stringify(cart));
  }

  function addToCart(slug) {
    const robot = ROBOTS_DATA.find(r => r.slug === slug);
    if (!robot) return;
    
    if (!cart.some(item => item.slug === slug)) {
      cart.push(robot);
      updateCartBadges();
      showToast(`Модель «${robot.name}» добавлена в смету (КП)!`);
    } else {
      showToast(`«${robot.name}» уже в вашей смете (КП)`);
    }
    renderDrawerItems();
  }

  function removeFromCart(slug) {
    cart = cart.filter(item => item.slug !== slug);
    updateCartBadges();
    renderDrawerItems();
    showToast('Модель удалена из сметы');
  }

  function renderDrawerItems() {
    if (!drawerItems) return;

    if (cart.length === 0) {
      drawerItems.innerHTML = `
        <div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">
          <p>В вашей смете пока нет роботов.</p>
          <p style="font-size: 0.84rem; margin-top: 8px;">Выберите интересующие модели в каталоге и нажмите <strong>«+ В смету (КП)»</strong>.</p>
        </div>
      `;
      if (drawerTotalPrice) drawerTotalPrice.textContent = '0 ₸';
      return;
    }

    let totalKzt = 0;
    drawerItems.innerHTML = cart.map(item => {
      totalKzt += (item.price_kzt || 0);
      return `
        <div class="cart-item">
          <img src="${item.image || 'assets/cards/ph-go2-pro-1.webp'}" alt="${item.name}" />
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">${item.price_label}</div>
          </div>
          <button class="cart-item-del" data-slug="${item.slug}" title="Удалить" aria-label="Удалить ${item.name} из КП">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;
    }).join('');

    if (drawerTotalPrice) {
      drawerTotalPrice.textContent = totalKzt > 0 ? totalKzt.toLocaleString('ru-RU') + ' ₸' : 'Индивидуальный расчет';
    }

    // Bind delete buttons
    drawerItems.querySelectorAll('.cart-item-del').forEach(btn => {
      btn.addEventListener('click', () => removeFromCart(btn.dataset.slug));
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
  closeDrawerBtn?.addEventListener('click', closeDrawer);
  drawerBackdrop?.addEventListener('click', closeDrawer);

  // Focus trap for cart drawer
  cartDrawer?.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const focusable = cartDrawer.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Send Cart via WhatsApp
  document.getElementById('sendCartWhatsAppBtn')?.addEventListener('click', () => {
    if (cart.length === 0) {
      showToast('Добавьте хотя бы одного робота в список!');
      return;
    }
    const robotNames = cart.map(c => `• ${c.name} (${c.price_label})`).join('\n');
    const msg = `Здравствуйте, XBOT Robotics! Хочу получить официальное коммерческое предложение и счет на следующие модели:\n\n${robotNames}\n\nПрошу связаться со мной для уточнения деталей поставки по Казахстану.`;
    window.open(`https://wa.me/77779117499?text=${encodeURIComponent(msg)}`, '_blank');
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
    menuToggle.setAttribute('aria-label', 'Закрыть мобильное меню');
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
    menuToggle.setAttribute('aria-label', 'Открыть мобильное меню');
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

  // Close mobile navigation on click outside
  document.addEventListener('click', (e) => {
    const isMobileNavOpen = mobileNav?.classList.contains('open');
    const isMainNavOpen = mainNav?.classList.contains('open');
    if ((isMobileNavOpen || isMainNavOpen) && !mobileNav?.contains(e.target) && !mainNav?.contains(e.target) && !menuToggle?.contains(e.target)) {
      closeMobileMenu();
    }
  });

  // Close menu & smooth scroll when link is clicked
  const allNavLinks = document.querySelectorAll('.nav-links a, .mobile-nav-links a, .mobile-cta-btn');
  allNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      // Close mobile menu
      closeMobileMenu();

      const href = link.getAttribute('href');
      if (href && href.startsWith('#') && href.length > 1) {
        const targetSection = document.querySelector(href);
        if (targetSection) {
          e.preventDefault();
          targetSection.scrollIntoView({ behavior: 'smooth' });
          if (history.pushState) {
            history.pushState(null, '', href);
          }
        }
      }
    });
  });

  // === 5. KEYBOARD ACCESSIBILITY (ESC KEY HANDLING) ===
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      // 1. Close modal dialog if open
      if (productDialog && productDialog.open) {
        productDialog.close();
        return;
      }
      // 2. Close cart drawer if open
      if (cartDrawer && cartDrawer.classList.contains('open')) {
        closeDrawer();
        return;
      }
      // 3. Close mobile navigation if open
      if ((mobileNav && mobileNav.classList.contains('open')) || (mainNav && mainNav.classList.contains('open'))) {
        closeMobileMenu();
        menuToggle?.focus();
        return;
      }
    }
  });

  // === 6. INTERACTIVE ROI CALCULATOR ===
  let currentRoiType = 'cleaning';

  function calculateROI() {
    const staffCount = parseInt(sliderStaff?.value || '4');
    const salary = parseInt(sliderSalary?.value || '220000');

    if (staffValBadge) staffValBadge.textContent = `${staffCount} чел.`;
    if (salaryValBadge) salaryValBadge.textContent = `${salary.toLocaleString('ru-RU')} ₸`;

    // Monthly staff cost (salary + taxes ~20%)
    const monthlyStaffCost = staffCount * salary * 1.2;
    
    // Robot maintenance & electricity estimate
    const robotMonthlyOpex = staffCount * 25000;
    
    // Monthly savings (robots replace ~70% manual routine labor)
    const monthlySavings = Math.round((monthlyStaffCost * 0.7) - robotMonthlyOpex);
    const yearlySavings = monthlySavings * 12;

    // Approximate investment for robots based on staff
    let robotUnitCost = 6200000; // default CC1
    if (currentRoiType === 'delivery') robotUnitCost = 4200000; // BellaBot
    if (currentRoiType === 'warehouse') robotUnitCost = 8900000; // T300

    const totalInvestment = Math.max(1, Math.round(staffCount * 0.5)) * robotUnitCost;
    const paybackMonths = Math.max(2.5, +(totalInvestment / Math.max(monthlySavings, 1)).toFixed(1));

    if (roiMonthlySavings) roiMonthlySavings.textContent = `${monthlySavings.toLocaleString('ru-RU')} ₸`;
    if (roiYearlySavings) roiYearlySavings.textContent = `${yearlySavings.toLocaleString('ru-RU')} ₸`;
    if (roiPaybackMonths) roiPaybackMonths.textContent = `${paybackMonths} мес.`;
    if (roiHoursSaved) roiHoursSaved.textContent = `${staffCount * 140} ч/мес`;
  }

  sliderStaff?.addEventListener('input', calculateROI);
  sliderSalary?.addEventListener('input', calculateROI);

  roiIndustryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      roiIndustryBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRoiType = btn.dataset.type;
      calculateROI();
    });
  });

  // === 7. HERO VISUAL TABS SWITCHER ===
  const heroRobots = [
    {
      name: 'Unitree Go2 Pro',
      badge: 'Хит продаж в Казахстане',
      desc: 'Четвероногий робот с 4D-лидаром, GPT-интеллектом и максимальной проходимостью',
      price: '1 450 000 ₸',
      lease: 'от 72 000 ₸/мес в лизинг',
      img: 'assets/cards/ph-go2-pro-1.webp',
      slug: 'go2-pro'
    },
    {
      name: 'Unitree G1 Humanoid',
      badge: 'Новинка 2026',
      desc: 'Антропоморфный робот-гуманоид массового производства, до 43 степеней свободы',
      price: '7 900 000 ₸',
      lease: 'от 395 000 ₸/мес в лизинг',
      img: 'assets/cards/u-g1.webp',
      slug: 'unitree-g1'
    },
    {
      name: 'PUDU CC1 Pro',
      badge: 'В наличии в Алматы',
      desc: 'Автономный клининговый комбайн 4-в-1 для торговых центров и складов до 12 000 м²',
      price: '6 200 000 ₸',
      lease: 'от 310 000 ₸/мес в лизинг',
      img: 'assets/cards/ph-pudu-cc1-1.webp',
      slug: 'pudu-cc1'
    },
    {
      name: 'PUDU T300 AMR',
      badge: 'Для цехов и заводов',
      desc: 'Промышленная автономная платформа 300 кг для сопряжения с конвейерами цеха',
      price: '8 900 000 ₸',
      lease: 'от 445 000 ₸/мес в лизинг',
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

  // Default bind for hero details btn
  if (heroCardDetailsBtn) {
    heroCardDetailsBtn.onclick = (e) => openProductModal('go2-pro', e.currentTarget);
  }

  // === 8. LEAD FORM SUBMISSION (WITH BACKEND API & WHATSAPP FALLBACK) ===
  const leadForm = document.getElementById('leadForm');
  leadForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('leadName')?.value.trim() || '';
    const company = document.getElementById('leadCompany')?.value.trim() || '';
    const phone = document.getElementById('leadPhone')?.value.trim() || '';
    const city = document.getElementById('leadCity')?.value || 'Алматы';
    const robot = document.getElementById('leadRobot')?.value || 'Не выбрано';
    const messenger = document.querySelector('input[name="messenger"]:checked')?.value || 'WhatsApp';

    // Construct full lead text message
    let text = `Заявка с сайта XBOT Robotics:\nИмя: ${name}`;
    if (company) text += `\nКомпания: ${company}`;
    text += `\nТелефон: ${phone}\nГород: ${city}\nИнтересует: ${robot}\nУдобная связь: ${messenger}`;

    if (cart.length > 0) {
      text += `\n\nВыбранные модели в КП:\n` + cart.map(c => `• ${c.name} (${c.price_label})`).join('\n');
    }

    const whatsappUrl = `https://wa.me/77779117499?text=${encodeURIComponent(text)}`;

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
      cart: cart.map(item => ({ slug: item.slug, name: item.name, price: item.price_label })),
      sourceUrl: window.location.href,
      createdAt: new Date().toISOString()
    };

    // 1. Graceful offline fallback for local file:// protocol (prevents browser console network errors)
    if (window.location.protocol === 'file:') {
      showToast('Заявка принята! Перенаправляем в WhatsApp...');
      leadForm.reset();
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
      window.open(whatsappUrl, '_blank');
      return;
    }

    // 2. HTTP/HTTPS environment: attempt POST /api/leads
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

      if (response.ok) {
        isSuccess = true;
      }
    } catch (_err) {
      // Backend is unavailable or network error - graceful silent fallback
      isSuccess = false;
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    }

    if (isSuccess) {
      showToast('Заявка зафиксирована в CRM! Открываем WhatsApp...');
      leadForm.reset();
      setTimeout(() => {
        window.open(whatsappUrl, '_blank');
      }, 500);
    } else {
      // Server offline / unreachable: immediate fallback without error
      showToast('Сервер оффлайн: перенаправляем в WhatsApp с полным текстом заявки...');
      leadForm.reset();
      window.open(whatsappUrl, '_blank');
    }
  });

  // === 9. TOAST NOTIFICATIONS HELPER ===
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

  // === 10. INITIALIZE ===
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
  calculateROI();
});
