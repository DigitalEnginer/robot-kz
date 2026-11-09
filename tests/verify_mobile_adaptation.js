const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const outDir = path.join(__dirname, 'screenshots_mobile');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const page = await browser.newPage();
  const baseUrl = process.env.TEST_URL || 'http://localhost:3000';
  const viewports = [320, 360, 375, 390, 430, 767, 768, 1280];
  const summary = [];

  for (const vw of viewports) {
    const vh = vw >= 1024 ? 800 : 812;
    await page.setViewport({ width: vw, height: vh, deviceScaleFactor: vw < 768 ? 2 : 1 });
    await page.goto(baseUrl, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 350));

    // Audit full page horizontal overflow + every element right edge
    const report = await page.evaluate((currentVw) => {
      const docOverflow = document.documentElement.scrollWidth > currentVw;
      const bodyOverflow = document.body.scrollWidth > currentVw;

      const offenders = [];
      const els = document.querySelectorAll('header *, main *, footer *');
      for (const el of els) {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        // Skip intentionally scrollable horizontal pill items inside .category-pills
        if (el.closest('.category-pills') && !el.classList.contains('category-pills')) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (rect.right > currentVw + 0.75 || rect.left < -0.75) {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || '').toString().slice(0, 60),
            text: (el.innerText || '').trim().slice(0, 35),
            left: Math.round(rect.left * 10) / 10,
            right: Math.round(rect.right * 10) / 10,
            width: Math.round(rect.width * 10) / 10
          });
        }
      }

      const h1 = document.querySelector('h1.hero-title');
      const h2Catalog = document.querySelector('#catalog .section-title');
      const headerInner = document.querySelector('.header-inner');
      const phoneBtn = document.querySelector('.header-actions .phone-link');
      const cartBtn = document.querySelector('.cart-btn-trigger');
      const burgerBtn = document.querySelector('.menu-toggle');
      const cartCount = document.querySelector('.cart-count');
      const waBtn = document.querySelector('.floating-whatsapp');
      const waSpan = document.querySelector('.floating-whatsapp span');
      const metricVals = Array.from(document.querySelectorAll('.hero-metrics .metric-val')).map(el => ({
        text: el.textContent.trim(),
        whiteSpace: getComputedStyle(el).whiteSpace,
        right: Math.round(el.getBoundingClientRect().right),
        parentRight: Math.round(el.closest('.metric-item').getBoundingClientRect().right)
      }));
      const tabRects = Array.from(document.querySelectorAll('.hero-tab-btn')).map(el => {
        const r = el.getBoundingClientRect();
        return { text: el.textContent.trim(), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), truncated: el.scrollWidth > el.clientWidth + 1 };
      });
      const pills = document.querySelector('.category-pills');
      const firstSpecLabels = Array.from(document.querySelectorAll('.robot-card:first-child .spec-mini-lbl')).map(el => {
        const r = el.getBoundingClientRect();
        return { text: el.textContent.trim(), left: Math.round(r.left), right: Math.round(r.right) };
      });
      const firstIndustryPills = Array.from(document.querySelectorAll('.industry-card:first-child .stat-pill')).map(el => {
        const r = el.getBoundingClientRect();
        return { text: el.innerText.replace(/\s+/g, ' ').trim(), top: Math.round(r.top), right: Math.round(r.right), cardRight: Math.round(el.closest('.industry-card').getBoundingClientRect().right) };
      });

      return {
        vw: currentVw,
        docScrollW: document.documentElement.scrollWidth,
        bodyScrollW: document.body.scrollWidth,
        docOverflow,
        bodyOverflow,
        offendersCount: offenders.length,
        offenders: offenders.slice(0, 12),
        h1FontSize: h1 ? getComputedStyle(h1).fontSize : null,
        h2CatalogFontSize: h2Catalog ? getComputedStyle(h2Catalog).fontSize : null,
        headerHeight: headerInner ? Math.round(headerInner.getBoundingClientRect().height) : null,
        headerRightBtns: [phoneBtn, cartBtn, burgerBtn].filter(Boolean).map(b => {
          const r = b.getBoundingClientRect();
          const s = getComputedStyle(b);
          return { cls: b.className, w: Math.round(r.width), h: Math.round(r.height), radius: s.borderRadius, display: s.display };
        }),
        cartBadgePos: cartCount ? { top: getComputedStyle(cartCount).top, right: getComputedStyle(cartCount).right, fontSize: getComputedStyle(cartCount).fontSize } : null,
        waFab: waBtn ? { w: Math.round(waBtn.getBoundingClientRect().width), h: Math.round(waBtn.getBoundingClientRect().height), opacity: getComputedStyle(waBtn).opacity, spanDisplay: waSpan ? getComputedStyle(waSpan).display : null } : null,
        metricVals,
        heroTabs: tabRects,
        pillsSwipe: pills ? { clientW: pills.clientWidth, scrollW: pills.scrollWidth, canSwipe: pills.scrollWidth > pills.clientWidth, overflowX: getComputedStyle(pills).overflowX } : null,
        firstSpecLabels,
        firstIndustryPills
      };
    }, vw);

    // Also test sticky header when scrolling to #rent
    await page.evaluate(() => {
      document.getElementById('rent')?.scrollIntoView({ behavior: 'instant' });
    });
    await new Promise(r => setTimeout(r, 250));
    const stickyTop = await page.evaluate(() => Math.round(document.querySelector('.site-header').getBoundingClientRect().top));
    report.stickyHeaderTopAtRent = stickyTop;

    summary.push(report);

    // Capture verification screenshots at key viewports
    if (vw === 375 || vw === 320 || vw === 1280) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await new Promise(r => setTimeout(r, 250));
      await page.screenshot({ path: path.join(outDir, `hero_${vw}.png`) });

      if (vw === 375 || vw === 320) {
        await page.evaluate(() => document.querySelector('.hero-tabs-selector')?.scrollIntoView({ behavior: 'instant', block: 'center' }));
        await new Promise(r => setTimeout(r, 200));
        await page.screenshot({ path: path.join(outDir, `hero_tabs_${vw}.png`) });

        await page.evaluate(() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
        await new Promise(r => setTimeout(r, 250));
        await page.screenshot({ path: path.join(outDir, `catalog_${vw}.png`) });

        await page.evaluate(() => {
          const cards = Array.from(document.querySelectorAll('.robot-card'));
          const t300 = cards.find(c => c.dataset.slug && c.dataset.slug.includes('t300')) || cards[0];
          t300?.scrollIntoView({ behavior: 'instant', block: 'center' });
        });
        await new Promise(r => setTimeout(r, 200));
        await page.screenshot({ path: path.join(outDir, `t300_card_${vw}.png`) });

        await page.evaluate(() => document.querySelector('.industry-card')?.scrollIntoView({ behavior: 'instant', block: 'center' }));
        await new Promise(r => setTimeout(r, 200));
        await page.screenshot({ path: path.join(outDir, `industry_${vw}.png`) });

        if (vw === 375) {
          await page.evaluate(() => document.getElementById('calculator')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
          await new Promise(r => setTimeout(r, 200));
          await page.screenshot({ path: path.join(outDir, `configurator_375.png`) });

          await page.evaluate(() => document.getElementById('contact')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
          await new Promise(r => setTimeout(r, 200));
          await page.screenshot({ path: path.join(outDir, `contact_375.png`) });

          await page.evaluate(() => document.querySelector('.form-card')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
          await new Promise(r => setTimeout(r, 200));
          await page.screenshot({ path: path.join(outDir, `form_375.png`) });
        }

        // Interactive overlay audits at 320px and 375px: Cart Drawer, Product Modal, Mobile Nav
        await page.evaluate(() => {
          localStorage.removeItem('orda_cart');
          document.querySelector('.robot-card[data-slug*="go2"] .btn-card-cart')?.click();
          document.querySelector('.robot-card[data-slug*="t300"] .btn-card-cart')?.click();
          const tc = document.getElementById('toastContainer');
          if (tc) tc.innerHTML = '';
          document.querySelector('.cart-btn-trigger')?.click();
        });
        await new Promise(r => setTimeout(r, 400));
        report.drawerAudit = await page.evaluate((currentVw) => {
          const d = document.getElementById('cartDrawer');
          const dr = d.getBoundingClientRect();
          const offenders = [];
          d.querySelectorAll('*').forEach(el => {
            const st = getComputedStyle(el);
            if (st.display === 'none') return;
            const r = el.getBoundingClientRect();
            if (r.width === 0) return;
            if (r.right > currentVw + 0.75 || r.left < dr.left - 0.75) {
              offenders.push({ cls: el.className, left: Math.round(r.left), right: Math.round(r.right) });
            }
          });
          return { open: d.classList.contains('open'), width: Math.round(dr.width), offendersCount: offenders.length, offenders };
        }, vw);
        await page.screenshot({ path: path.join(outDir, `drawer_${vw}.png`) });
        await page.evaluate(() => document.getElementById('closeDrawerBtn')?.click());
        await new Promise(r => setTimeout(r, 300));

        await page.evaluate(() => {
          document.querySelector('.robot-card[data-slug*="t300"]')?.click();
        });
        await new Promise(r => setTimeout(r, 350));
        report.modalAudit = await page.evaluate(() => {
          const dlg = document.getElementById('productDialog');
          const dr = dlg.getBoundingClientRect();
          const offenders = [];
          dlg.querySelectorAll('*').forEach(el => {
            const st = getComputedStyle(el);
            if (st.display === 'none') return;
            const r = el.getBoundingClientRect();
            if (r.width === 0) return;
            if (r.right > dr.right + 0.75 || r.left < dr.left - 0.75) {
              offenders.push({ cls: el.className, left: Math.round(r.left), right: Math.round(r.right) });
            }
          });
          return { open: dlg.open, width: Math.round(dr.width), offendersCount: offenders.length, offenders };
        });
        await page.screenshot({ path: path.join(outDir, `modal_t300_${vw}.png`) });
        await page.evaluate(() => document.getElementById('productDialog')?.close());
        await new Promise(r => setTimeout(r, 250));

        await page.evaluate(() => document.getElementById('menuToggle')?.click());
        await new Promise(r => setTimeout(r, 350));
        report.mobileNavAudit = await page.evaluate((currentVw) => {
          const n = document.getElementById('mobileNav');
          const nr = n.getBoundingClientRect();
          return { open: n.classList.contains('open'), width: Math.round(nr.width), rightOverflow: nr.right > currentVw + 0.75 };
        }, vw);
        await page.screenshot({ path: path.join(outDir, `mobilenav_${vw}.png`) });
        await page.evaluate(() => localStorage.removeItem('orda_cart'));
      }
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  await browser.close();
})();
