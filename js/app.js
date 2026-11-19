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

  // === 1. CATALOG RENDERING: SERIES → MODELS ===
  const ALL_ROBOTS = (typeof ROBOTS_DATA !== 'undefined') ? ROBOTS_DATA : [];
  const SERIES = (typeof SERIES_DATA !== 'undefined') ? SERIES_DATA : [];
  const robotBySlug = (slug) => ALL_ROBOTS.find(r => r.slug === slug);
  const seriesOfSlug = (slug) => SERIES.find(s => s.models.includes(slug));
  const seriesModels = (series) => series.models.map(robotBySlug).filter(Boolean);
  const shortName = (name) => String(name || '').replace(/^(Unitree|PUDU)\s+/i, '');
  const pluralModels = (n) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return `${n} модель`;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} модели`;
    return `${n} моделей`;
  };

  let currentSeriesId = null;
  // Page mode: the catalog page has the category filter; the home page shows a short "popular" list
  const IS_CATALOG_PAGE = Boolean(document.querySelector('#catalog .catalog-toolbar'));
  const FEATURED_SERIES = ['go2', 'g1', 'h2', 'bellabot', 'cc1', 't-series'];
  const catalogUrlForSeries = (id) => `catalog.html#series-${id}`;
  const seriesViewEl = document.getElementById('seriesView');
  const catalogToolbarEl = document.querySelector('#catalog .catalog-toolbar');
  const catalogHeaderEl = document.querySelector('#catalog .section-header');
  const buyerStepsEl = document.querySelector('#catalog .buyer-steps');

  const ADD_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>`;
  const CHEVRON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"></path></svg>`;

  function robotCardHTML(robot) {
    // Two meaningful specs per card; generic rows (brand, category, warranty) live in the modal only
    const GENERIC_SPECS = ['Производитель', 'Категория', 'Гарантия', 'Сервисный центр'];
    const specsEntries = Object.entries(robot.specs || {}).filter(([k]) => !GENERIC_SPECS.includes(k)).slice(0, 2);
    const configTag = robot.config_label ? `<div class="card-config-tag">${robot.config_label}</div>` : '';
    return `
      <article class="robot-card" data-slug="${robot.slug}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="Открыть характеристики ${robot.name}">
        <div class="robot-card-top">
          ${robot.badge ? `<span class="card-badge">${robot.badge}</span>` : '<span></span>'}
          <span class="card-brand">${robot.brand}</span>
        </div>
        <div class="robot-card-img-wrap">
          <img src="${robot.image || 'assets/cards/ph-go2-pro-1.webp'}" alt="${robot.name}" loading="lazy" />
        </div>
        <h3 class="robot-card-name">${robot.name}</h3>
        <p class="robot-card-desc">${robot.desc || robot.full_desc || ''}</p>
        <div class="specs-mini-grid"${specsEntries.length ? '' : ' hidden'}>
          ${specsEntries.map(([k, v]) => `
            <div class="spec-mini-item">
              <span class="spec-mini-lbl">${k}</span>
              <span class="spec-mini-val" title="${v}">${v}</span>
            </div>`).join('')}
        </div>
        <div class="robot-card-bottom">
          <div class="price-block">
            <div class="price-val">${robot.price_label || 'По запросу'}</div>
            <div class="price-lease">${robot.price_sub || 'Расчёт с НДС и доставкой по РК'}</div>
            ${configTag}
          </div>
          <div class="card-actions">
            <button class="btn-card-cart" data-action="add-cart" data-slug="${robot.slug}" aria-label="Добавить ${robot.name} в подборку для КП" title="Добавить в подборку для коммерческого предложения">
              ${ADD_ICON}<span>В подборку</span>
            </button>
          </div>
        </div>
        <div class="card-click-hint"><span>Подробнее о модели</span>${CHEVRON}</div>
      </article>`;
  }

  function seriesCardHTML(series) {
    const models = seriesModels(series);
    if (models.length === 0) return '';
    // A one-model series behaves like a plain product card (opens the modal directly)
    if (models.length === 1) return robotCardHTML(models[0]);

    const lead = models[0];
    const chips = models.map(m => `<span class="series-chip">${shortName(m.name)}</span>`).join('');
    return `
      <article class="robot-card series-card" data-series="${series.id}" tabindex="0" role="button" aria-label="Открыть серию ${series.name}: ${pluralModels(models.length)}">
        <div class="robot-card-top">
          <span class="card-badge series-badge">Серия · ${pluralModels(models.length)}</span>
          <span class="card-brand">${series.brand}</span>
        </div>
        <div class="robot-card-img-wrap">
          <img src="${lead.image || 'assets/cards/ph-go2-pro-1.webp'}" alt="${series.name}" loading="lazy" />
        </div>
        <h3 class="robot-card-name">${series.name}</h3>
        <p class="robot-card-desc">${series.tagline || lead.desc || ''}</p>
        <div class="series-chips" aria-label="Модели серии">${chips}</div>
        <div class="robot-card-bottom series-card-bottom">
          <div class="price-block">
            <div class="price-val">По запросу</div>
            <div class="price-lease">Цены и комплектации — в КП</div>
          </div>
          <span class="btn-series-open">Все модели ${CHEVRON}</span>
        </div>
      </article>`;
  }

  function renderSeriesView() {
    const series = SERIES.find(s => s.id === currentSeriesId);
    if (!series) { currentSeriesId = null; return renderCatalog(); }
    const models = seriesModels(series);

    if (catalogToolbarEl) catalogToolbarEl.hidden = true;
    if (catalogHeaderEl) catalogHeaderEl.hidden = true;
    if (buyerStepsEl) buyerStepsEl.hidden = true;
    if (seriesViewEl) {
      seriesViewEl.hidden = false;
      seriesViewEl.innerHTML = `
        <nav class="series-crumbs" aria-label="Навигация по каталогу">
          <a href="#catalog" class="series-back" data-action="close-series">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m15 18-6-6 6-6"></path></svg>
            Все роботы
          </a>
          <span aria-hidden="true">/</span>
          <span>${series.name}</span>
        </nav>
        <div class="series-head">
          <span class="section-tag">${series.brand} · ${pluralModels(models.length)}</span>
          <h2 class="section-title">${series.name}</h2>
          ${series.tagline ? `<p class="section-desc">${series.tagline}</p>` : ''}
        </div>`;
    }
    robotsGrid.innerHTML = models.map(robotCardHTML).join('');
  }

  function renderCatalog() {
    if (!robotsGrid) return;
    if (currentSeriesId) return renderSeriesView();

    if (seriesViewEl) { seriesViewEl.hidden = true; seriesViewEl.innerHTML = ''; }
    if (catalogToolbarEl) catalogToolbarEl.hidden = false;
    if (catalogHeaderEl) catalogHeaderEl.hidden = false;
    if (buyerStepsEl) buyerStepsEl.hidden = false;

    let list = SERIES.filter(s => seriesModels(s).length > 0);
    if (!IS_CATALOG_PAGE) {
      list = FEATURED_SERIES.map(id => SERIES.find(s => s.id === id)).filter(Boolean);
    }
    if (currentCategory !== 'all') list = list.filter(s => s.cat === currentCategory);
    if (currentBrand !== 'all') list = list.filter(s => s.brand.toLowerCase() === currentBrand.toLowerCase());

    if (list.length === 0) {
      robotsGrid.innerHTML = `
        <div class="catalog-empty">
          <h3>Модели не найдены</h3>
          <p>Попробуйте выбрать другую категорию</p>
          <button id="resetFiltersBtn" class="btn-secondary">Показать все</button>
        </div>`;
      document.getElementById('resetFiltersBtn')?.addEventListener('click', resetAllFilters);
      return;
    }
    robotsGrid.innerHTML = list.map(seriesCardHTML).join('');
  }

  // Smooth scroll only for short hops; long jumps (e.g. catalog → form on a phone) are instant
  function smartScrollTo(top) {
    const far = Math.abs(top - window.scrollY) > window.innerHeight * 2.5;
    window.scrollTo({ top, behavior: far ? 'instant' : 'smooth' });
  }

  function scrollToCatalogTop() {
    const catalogEl = document.getElementById('catalog');
    if (!catalogEl) return;
    const header = document.querySelector('.site-header, header');
    const offset = header ? header.getBoundingClientRect().height + 8 : 80;
    smartScrollTo(catalogEl.getBoundingClientRect().top + window.scrollY - offset);
  }

  function openSeries(id) {
    if (!SERIES.some(s => s.id === id)) return;
    if (!IS_CATALOG_PAGE) {
      window.location.href = catalogUrlForSeries(id);
      return;
    }
    if (location.hash !== `#series-${id}`) {
      history.pushState({ series: id }, '', `#series-${id}`);
    }
    currentSeriesId = id;
    renderCatalog();
    scrollToCatalogTop();
  }

  function closeSeries({ updateUrl = true } = {}) {
    if (!currentSeriesId) return;
    currentSeriesId = null;
    if (updateUrl && location.hash.startsWith('#series-')) {
      history.replaceState(null, '', '#catalog');
    }
    renderCatalog();
  }

  function syncSeriesFromUrl() {
    if (!IS_CATALOG_PAGE) return;
    const m = location.hash.match(/^#series-([a-z0-9-]+)$/i);
    const id = m && SERIES.some(s => s.id === m[1]) ? m[1] : null;
    if (id === currentSeriesId) return;
    currentSeriesId = id;
    renderCatalog();
    if (id) scrollToCatalogTop();
  }
  window.addEventListener('popstate', syncSeriesFromUrl);
  window.addEventListener('hashchange', syncSeriesFromUrl);

  seriesViewEl?.addEventListener('click', (e) => {
    const back = e.target.closest('[data-action="close-series"]');
    if (!back) return;
    e.preventDefault();
    closeSeries();
    scrollToCatalogTop();
  });

  function resetAllFilters() {
    currentCategory = 'all';
    currentBrand = 'all';
    currentSearch = '';
    if (searchInput) searchInput.value = '';
    
    categoryPills.forEach(p => p.classList.toggle('active', p.dataset.category === 'all'));
    brandBtns.forEach(b => b.classList.toggle('active', b.dataset.brand === 'all'));
    closeSeries();
    renderCatalog();
  }

  // Filter events
  categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      categoryPills.forEach(p => { p.classList.remove('active'); p.setAttribute('aria-pressed', 'false'); });
      pill.classList.add('active');
      pill.setAttribute('aria-pressed', 'true');
      if (history.replaceState) {
        const u = new URL(window.location.href);
        if (pill.dataset.category === 'all') u.searchParams.delete('cat'); else u.searchParams.set('cat', pill.dataset.category);
        u.hash = '';
        history.replaceState(null, '', u.pathname + u.search);
      }
      currentCategory = pill.dataset.category;
      closeSeries();
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

    // 2. Series card → show every model of the series
    const seriesCard = e.target.closest('.series-card');
    if (seriesCard) {
      openSeries(seriesCard.dataset.series);
      return;
    }

    // 3. Clicking anywhere on a model card opens the full modal
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
      closeSeries();
      renderCatalog();
      scrollToCatalogTop();
    });
  });

  // Support Enter / Space keyboard navigation on robot cards
  robotsGrid?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.robot-card');
      if (card && (e.target === card || !e.target.matches('button, a, input'))) {
        e.preventDefault();
        if (card.dataset.series) { openSeries(card.dataset.series); return; }
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

      const ownSeries = seriesOfSlug(robot.slug);
      const seriesLinkHtml = (ownSeries && ownSeries.models.length > 1 && currentSeriesId !== ownSeries.id) ? `
        <button type="button" class="modal-series-link" data-series="${ownSeries.id}">
          <span>Серия ${ownSeries.name} · все ${pluralModels(ownSeries.models.length)}</span>
          ${CHEVRON}
        </button>` : '';

      dialogContent.innerHTML = `
        <div class="modal-inner">
          <div class="modal-header">
            <div class="modal-header-title-wrap">
              ${robot.badge ? `<span class="card-badge">${robot.badge}</span>` : ''}
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
              ${seriesLinkHtml}
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
                    <span>Поставка по всему Казахстану — сроки и наличие уточняем в КП</span>
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
                 target="_blank" rel="noopener" class="btn-secondary modal-wa-btn" aria-label="Спросить про ${robot.name} в WhatsApp">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.983.541 1.836.828 2.801.829l.005-.001c3.182 0 5.767-2.587 5.768-5.766 0-3.18-2.586-5.765-5.778-5.765zm9.969 5.768c0 5.518-4.482 10-10 10-1.705 0-3.32-.435-4.735-1.196l-5.265 1.381 1.405-5.132c-.859-1.488-1.355-3.218-1.355-5.053 0-5.518 4.482-10 10-10 5.518 0 10 4.482 10 10z"/>
                </svg>
                <span class="modal-wa-text">WhatsApp</span>
              </a>
              <button type="button" class="btn-secondary modal-add-btn" id="modalAddCartBtn">${ADD_ICON}<span>В подборку</span></button>
              <button type="button" class="btn-primary modal-quote-btn" id="modalQuoteBtn">Получить КП</button>
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

      const currentCartItem = () => activeEdition ? {
        slug: robot.slug,
        customId: `${robot.slug}-${activeEdition.name.toLowerCase().replace(/[^a-zа-я0-9]/gi, '-')}`,
        name: `${robot.name} (${activeEdition.name})`,
        price_label: robot.price_label || 'По запросу',
        image: robot.image,
        badge: robot.badge
      } : null;

      document.getElementById('modalAddCartBtn')?.addEventListener('click', () => {
        addToCart(robot.slug, currentCartItem());
        productDialog.close();
      });

      document.getElementById('modalQuoteBtn')?.addEventListener('click', () => {
        addToCart(robot.slug, currentCartItem(), { onlyIfMissing: true, silent: true });
        lastModalTrigger = null; // we navigate away — don't jump back to the card
        productDialog.close();
        goToQuoteForm();
      });

      dialogContent.querySelector('.modal-series-link')?.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.series;
        lastModalTrigger = null;
        productDialog.close();
        openSeries(id);
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

  function addToCart(slug, customItem = null, { onlyIfMissing = false, silent = false } = {}) {
    const robot = (typeof ROBOTS_DATA !== 'undefined' ? ROBOTS_DATA : []).find(r => r.slug === slug);
    if (!robot && !customItem) return;
    
    const itemToAdd = customItem || robot;
    const itemKey = itemToAdd.customId || itemToAdd.slug;

    const existing = cart.find(it => (it.customId || it.slug) === itemKey);
    if (existing && onlyIfMissing) {
      // already in the selection — keep quantity as is
    } else if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
      if (!silent) showToast(`«${itemToAdd.name || robot.name}» — в подборке ${existing.quantity} шт.`);
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
      if (!silent) showToast(`«${itemToAdd.name || robot.name}» добавлен в подборку для КП`);
    }

    updateCartBadges();
    renderDrawerItems();
    renderQuoteSelection();
  }

  function changeItemQty(key, delta) {
    const item = cart.find(it => (it.customId || it.slug) === key);
    if (!item) return;

    item.quantity = (item.quantity || 1) + delta;
    if (item.quantity <= 0) {
      cart = cart.filter(it => (it.customId || it.slug) !== key);
      showToast('Позиция удалена из подборки');
    }
    updateCartBadges();
    renderDrawerItems();
    renderQuoteSelection();
  }

  function removeFromCart(key) {
    cart = cart.filter(item => (item.customId || item.slug) !== key);
    updateCartBadges();
    renderDrawerItems();
    renderQuoteSelection();
    showToast('Позиция удалена из подборки');
  }

  function renderDrawerItems() {
    if (!drawerItems) return;

    if (cart.length === 0) {
      drawerItems.innerHTML = `
        <div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">
          <p>В подборке пока нет моделей.</p>
          <p style="font-size: 0.84rem; margin-top: 8px;">Откройте серию в каталоге и нажмите <strong>«В подборку»</strong> у нужной модели.</p>
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

  // === 3b. QUOTE REQUEST FLOW (подборка → форма КП → «что дальше») ===
  const quoteSelectionEl = document.getElementById('quoteSelection');
  const leadRobotGroup = document.getElementById('leadRobotGroup');

  function renderQuoteSelection() {
    if (!quoteSelectionEl) return;
    if (cart.length === 0) {
      quoteSelectionEl.hidden = true;
      quoteSelectionEl.innerHTML = '';
      if (leadRobotGroup) leadRobotGroup.hidden = false;
      return;
    }
    const total = cart.reduce((sum, it) => sum + (it.quantity || 1), 0);
    quoteSelectionEl.hidden = false;
    if (leadRobotGroup) leadRobotGroup.hidden = true;
    quoteSelectionEl.innerHTML = `
      <div class="quote-sel-head">
        <span>Ваша подборка · ${total} ед.</span>
        <button type="button" class="quote-sel-edit" data-action="edit-selection">Изменить</button>
      </div>
      <ul class="quote-sel-list">
        ${cart.map(it => `<li><img src="${it.image || 'assets/cards/ph-go2-pro-1.webp'}" alt="" /><span>${it.name}</span><b>${it.quantity || 1} шт.</b></li>`).join('')}
      </ul>`;
  }

  quoteSelectionEl?.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="edit-selection"]')) openDrawer(e.target);
  });

  function goToQuoteForm() {
    if (cartDrawer?.classList.contains('open')) closeDrawer();
    if (!document.getElementById('leadForm')) {
      window.location.href = 'index.html#contact';
      return;
    }
    showLeadForm();
    renderQuoteSelection();
    const contact = document.getElementById('contact');
    const formCard = document.querySelector('#contact .form-card') || contact;
    if (!formCard) return;
    const header = document.querySelector('.site-header, header');
    const offset = header ? header.getBoundingClientRect().height + 12 : 80;
    smartScrollTo(formCard.getBoundingClientRect().top + window.scrollY - offset);
    // Late layout shifts (fonts, lazy images) can move the form after a long jump — re-align once settled
    [200, 650].forEach((ms) => setTimeout(() => {
      const drift = formCard.getBoundingClientRect().top - offset;
      if (Math.abs(drift) > 40) window.scrollTo({ top: window.scrollY + drift, behavior: 'instant' });
    }, ms));
    setTimeout(() => document.getElementById('leadName')?.focus({ preventScroll: true }), 700);
  }

  document.getElementById('drawerQuoteBtn')?.addEventListener('click', goToQuoteForm);
  closeDrawerBtn?.addEventListener('click', (e) => { e.preventDefault(); closeDrawer(); });
  drawerBackdrop?.addEventListener('click', closeDrawer);

  // Send Cart via WhatsApp
  document.getElementById('sendCartWhatsAppBtn')?.addEventListener('click', () => {
    if (cart.length === 0) {
      showToast('Добавьте хотя бы одну модель в подборку');
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
  const IS_HOME_PAGE = /(^\/$|\/index\.html$)/.test(window.location.pathname);
  const sameDocHash = (href) => {
    if (!href) return null;
    if (href.startsWith('#')) return href;
    const m = href.match(/^(?:\.\/)?index\.html(#.+)$/);
    return (m && IS_HOME_PAGE) ? m[1] : null;
  };
  const navSectionLinks = [...document.querySelectorAll('.nav-links a, .mobile-nav-links a')].filter(a => (a.getAttribute('href') || '').includes('#'));
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
      const href = sameDocHash(link.getAttribute('href')) || link.getAttribute('href');
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
    const sectionTargets = Array.from(document.querySelectorAll('#mainNav a'))
      .map(link => sameDocHash(link.getAttribute('href')))
      .filter(Boolean)
      .map(h => document.querySelector(h))
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

  // === 7. LEAD FORM SUBMISSION → SUCCESS SCREEN ===
  const leadForm = document.getElementById('leadForm');
  const leadSuccess = document.getElementById('leadSuccess');
  const formIntro = document.querySelector('#contact .form-card-intro');

  const NEXT_STEPS = (Array.isArray(CFG.leadNextSteps) && CFG.leadNextSteps.length) ? CFG.leadNextSteps : [
    `Менеджер свяжется с вами в рабочее время (${CFG.workHours || 'Пн–Пт: 09:00 – 19:00'}) и уточнит задачу`,
    'Подготовим официальное КП: спецификация, НДС 12%, доставка и пусконаладка по РК',
    'Согласуем демонстрацию — выезд инженера в Алматы или онлайн-демо для регионов'
  ];

  function showLeadForm() {
    if (!leadForm || !leadSuccess) return;
    leadSuccess.hidden = true;
    leadForm.hidden = false;
    if (formIntro) formIntro.hidden = false;
  }

  function showLeadSuccess({ saved, whatsappUrl, name }) {
    if (!leadForm || !leadSuccess) return;
    leadForm.hidden = true;
    if (formIntro) formIntro.hidden = true;
    leadSuccess.hidden = false;
    leadSuccess.innerHTML = `
      <div class="lead-success-icon" aria-hidden="true">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M20 6 9 17l-5-5"></path></svg>
      </div>
      <h3 tabindex="-1">${saved ? 'Заявка принята' : 'Отправьте заявку в WhatsApp'}${name && saved ? ', ' + name : ''}</h3>
      <p>${saved
        ? 'Спасибо! Мы получили ваш запрос на коммерческое предложение.'
        : 'Сервер сейчас недоступен — продублируйте заявку в WhatsApp, мы уже заполнили текст.'}</p>
      <div class="lead-next-title">Что будет дальше</div>
      <ol class="lead-next-steps">${NEXT_STEPS.map(t => `<li>${t}</li>`).join('')}</ol>
      <div class="lead-success-actions">
        <a href="${whatsappUrl}" target="_blank" rel="noopener" class="${saved ? 'btn-secondary' : 'btn-primary'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.983.541 1.836.828 2.801.829l.005-.001c3.182 0 5.767-2.587 5.768-5.766 0-3.18-2.586-5.765-5.778-5.765zm9.969 5.768c0 5.518-4.482 10-10 10-1.705 0-3.32-.435-4.735-1.196l-5.265 1.381 1.405-5.132c-.859-1.488-1.355-3.218-1.355-5.053 0-5.518 4.482-10 10-10 5.518 0 10 4.482 10 10z"/></svg>
          ${saved ? 'Ускорить ответ в WhatsApp' : 'Отправить в WhatsApp'}
        </a>
        <button type="button" class="${saved ? 'btn-primary' : 'btn-secondary'}" data-action="back-to-catalog">Вернуться в каталог</button>
      </div>`;
    leadSuccess.querySelector('h3')?.focus({ preventScroll: true });
    leadSuccess.querySelector('[data-action="back-to-catalog"]')?.addEventListener('click', () => {
      showLeadForm();
      window.location.href = 'catalog.html';
    });
  }

  leadForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('leadName')?.value.trim() || '';
    const company = document.getElementById('leadCompany')?.value.trim() || '';
    const phone = document.getElementById('leadPhone')?.value.trim() || '';
    const city = document.getElementById('leadCity')?.value || CFG.cityPrimary;
    const robotSelect = document.getElementById('leadRobot');
    const robot = cart.length > 0
      ? cart.map(c => c.name).join(', ')
      : (robotSelect?.value || 'Не выбрано');
    const messenger = document.querySelector('input[name="messenger"]:checked')?.value || 'WhatsApp';

    let text = `Заявка на КП с сайта ${CFG.brandName} (${CFG.brandShort}):
Имя: ${name}`;
    if (company) text += `
Компания: ${company}`;
    text += `
Телефон: ${phone}
Город поставки: ${city}
Удобная связь: ${messenger}`;
    if (cart.length > 0) {
      text += `

Подборка:
` + cart.map(c => `• ${c.name} — ${c.quantity || 1} шт.`).join('\n');
    } else {
      text += `
Интересует: ${robot}`;
    }
    const whatsappUrl = `https://wa.me/${CFG.whatsappNumber}?text=${encodeURIComponent(text)}`;

    const submitBtn = leadForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправляем...';
    }

    const leadPayload = {
      name, company, phone, city, robot, messenger,
      robots: cart.length > 0 ? cart.map(c => `${c.name} × ${c.quantity || 1}`) : [robot],
      cart: cart.map(item => ({ slug: item.slug, name: item.name, quantity: item.quantity || 1 })),
      source: 'website_quote_form',
      sourceUrl: window.location.href,
      createdAt: new Date().toISOString()
    };

    let saved = false;
    if (window.location.protocol !== 'file:') {
      try {
        const response = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(leadPayload)
        });
        saved = response.ok;
      } catch (_err) {
        saved = false;
      }
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }

    if (saved) {
      leadForm.reset();
      cart = [];
      updateCartBadges();
      renderDrawerItems();
      renderQuoteSelection();
    }
    showLeadSuccess({ saved, whatsappUrl, name });
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
  if (IS_CATALOG_PAGE) {
    const catParam = new URLSearchParams(window.location.search).get('cat');
    if (catParam && [...categoryPills].some(p => p.dataset.category === catParam)) {
      currentCategory = catParam;
      categoryPills.forEach(p => {
        const on = p.dataset.category === catParam;
        p.classList.toggle('active', on);
        p.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
  }
  renderCatalog();
  renderQuoteSelection();
  syncSeriesFromUrl();

  // Arriving from another page with #contact / #about etc.: the browser jumps before the
  // JS-rendered blocks are in place, so align to the target once the layout has settled.
  const initialTarget = location.hash && !location.hash.startsWith('#series-') ? document.querySelector(location.hash) : null;
  if (initialTarget) {
    const alignToTarget = () => {
      const header = document.querySelector('.site-header');
      const offset = header ? header.getBoundingClientRect().height + 12 : 80;
      const el = location.hash === '#contact' ? (document.querySelector('#contact .form-card') || initialTarget) : initialTarget;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'instant' });
    };
    requestAnimationFrame(alignToTarget);
    [300, 900].forEach(ms => setTimeout(alignToTarget, ms));
  }
});
