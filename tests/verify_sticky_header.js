const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--window-size=1280,800']
  });

  const outDir = path.join(__dirname, 'screenshots_sticky');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  const heroCheck = await page.evaluate(() => {
    const header = document.querySelector('.site-header');
    const activeLinks = Array.from(document.querySelectorAll('#mainNav a'))
      .filter(a => a.matches(':is(:target-current, .active, .target-current)'))
      .map(a => a.textContent.trim());
    return {
      chromeVersion: navigator.userAgent,
      supportsScrollState: CSS.supports('container-type: scroll-state'),
      supportsScrollTargetGroup: CSS.supports('scroll-target-group: auto'),
      headerRect: header.getBoundingClientRect().toJSON(),
      activeAtHero: activeLinks,
      scrollY: window.scrollY
    };
  });
  console.log('1. Hero state:', JSON.stringify(heroCheck, null, 2));
  await page.screenshot({ path: path.join(outDir, '1_hero.png') });

  // Click Аренда (#rent)
  await page.click('#mainNav a[href="#rent"]');
  await new Promise(r => setTimeout(r, 1200));

  const rentCheck = await page.evaluate(() => {
    const header = document.querySelector('.site-header');
    const bar = document.querySelector('.site-header-bar');
    const rentTitle = document.querySelector('#rent .section-title');
    const rentNav = document.querySelector('#mainNav a[href="#rent"]');
    const matchedActive = Array.from(document.querySelectorAll('#mainNav a'))
      .filter(a => a.classList.contains('active') || a.classList.contains('target-current') || (CSS.supports('selector(:target-current)') && a.matches(':target-current')))
      .map(a => ({ text: a.textContent.trim(), ariaCurrent: a.getAttribute('aria-current') }));
    return {
      scrollY: window.scrollY,
      headerRect: header.getBoundingClientRect().toJSON(),
      headerComputedPos: getComputedStyle(header).position,
      barShadow: getComputedStyle(bar).boxShadow,
      barBg: getComputedStyle(bar).backgroundColor,
      isStuckClass: header.classList.contains('is-stuck'),
      rentTitleTop: rentTitle ? rentTitle.getBoundingClientRect().top : null,
      rentNavColor: getComputedStyle(rentNav).color,
      rentNavBg: getComputedStyle(rentNav).backgroundColor,
      rentNavBoxShadow: getComputedStyle(rentNav).boxShadow,
      rentNavAriaCurrent: rentNav.getAttribute('aria-current'),
      matchedActive
    };
  });
  console.log('2. At #rent state:', JSON.stringify(rentCheck, null, 2));
  await page.screenshot({ path: path.join(outDir, '2_at_rent.png') });

  // Check Cart Drawer open at #rent (verifying html.body-lock doesn't break sticky header)
  await page.click('.cart-trigger');
  await new Promise(r => setTimeout(r, 350));
  const drawerCheck = await page.evaluate(() => {
    const header = document.querySelector('.site-header');
    return {
      htmlHasBodyLock: document.documentElement.classList.contains('body-lock'),
      headerRectTopWhileDrawerOpen: header.getBoundingClientRect().top,
      scrollYWhileDrawerOpen: window.scrollY
    };
  });
  console.log('3. Drawer open at #rent:', JSON.stringify(drawerCheck, null, 2));
  await page.click('#closeDrawerBtn');
  await new Promise(r => setTimeout(r, 250));

  // Click Каталог (#catalog) to verify switching sections
  await page.click('#mainNav a[href="#catalog"]');
  await new Promise(r => setTimeout(r, 1100));
  const catalogCheck = await page.evaluate(() => {
    const header = document.querySelector('.site-header');
    const catalogNav = document.querySelector('#mainNav a[href="#catalog"]');
    return {
      scrollY: window.scrollY,
      headerTop: header.getBoundingClientRect().top,
      catalogAriaCurrent: catalogNav.getAttribute('aria-current'),
      catalogBg: getComputedStyle(catalogNav).backgroundColor
    };
  });
  console.log('4. At #catalog state:', JSON.stringify(catalogCheck, null, 2));

  // Mobile viewport check
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.getElementById('rent')?.scrollIntoView({ behavior: 'instant' });
  });
  await new Promise(r => setTimeout(r, 300));
  await page.click('#menuToggle');
  await new Promise(r => setTimeout(r, 400));
  const mobileCheck = await page.evaluate(() => {
    const header = document.querySelector('.site-header');
    const mobileNav = document.getElementById('mobileNav');
    return {
      scrollY: window.scrollY,
      headerTop: header.getBoundingClientRect().top,
      mobileNavRect: mobileNav.getBoundingClientRect().toJSON(),
      mobileNavOpen: mobileNav.classList.contains('open')
    };
  });
  console.log('5. Mobile drawer at #rent:', JSON.stringify(mobileCheck, null, 2));
  await page.screenshot({ path: path.join(outDir, '3_mobile_drawer_at_rent.png') });

  await browser.close();
})();
