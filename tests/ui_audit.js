const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

const VIEWPORTS = [
  { name: 'Mobile-320', width: 320, height: 640 },
  { name: 'Mobile-375', width: 375, height: 667 },
  { name: 'Tablet-768', width: 768, height: 1024 },
  { name: 'Desktop-1024', width: 1024, height: 768 },
  { name: 'Desktop-1280', width: 1280, height: 800 },
  { name: 'Desktop-1920', width: 1920, height: 1080 },
];

async function runAudit() {
  console.log('Starting UI/UX Automated Audit across viewports...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const auditResults = {
    timestamp: new Date().toISOString(),
    viewports: {}
  };

  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  for (const vp of VIEWPORTS) {
    console.log(`\n================ Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ================`);
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // 1. Audit Catalog Search Box & Placeholder
    const searchAudit = await page.evaluate(() => {
      const input = document.getElementById('searchInput');
      const box = document.querySelector('.search-box');
      if (!input || !box) return null;

      const inputRect = input.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      const style = window.getComputedStyle(input);
      const paddingLeft = parseFloat(style.paddingLeft);
      const paddingRight = parseFloat(style.paddingRight);
      const fontSize = parseFloat(style.fontSize);
      const innerWidth = inputRect.width - paddingLeft - paddingRight;

      // Estimate placeholder width with canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const placeholderText = input.getAttribute('placeholder') || '';
      const textMetrics = ctx.measureText(placeholderText);
      const textWidth = textMetrics.width;

      return {
        boxWidth: boxRect.width,
        inputWidth: inputRect.width,
        innerWidth,
        placeholderText,
        placeholderCharCount: placeholderText.length,
        textWidth: Math.round(textWidth),
        isClipped: textWidth > innerWidth,
        overflowAmount: Math.round(textWidth - innerWidth),
        boxFlex: window.getComputedStyle(box).flex,
        boxMaxWidth: window.getComputedStyle(box).maxWidth,
        boxMinWidth: window.getComputedStyle(box).minWidth
      };
    });

    // 2. Audit Robot Cards (.specs-mini-grid, .card-badge, .robot-card-name, .robot-card-desc)
    const cardsAudit = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.robot-card'));
      return cards.map((card, idx) => {
        const slug = card.dataset.slug;
        const nameEl = card.querySelector('.robot-card-name');
        const descEl = card.querySelector('.robot-card-desc');
        const badgeEl = card.querySelector('.card-badge');
        const brandEl = card.querySelector('.card-brand');
        const specsGrid = card.querySelector('.specs-mini-grid');
        const specItems = Array.from(card.querySelectorAll('.spec-mini-item'));
        const priceValEl = card.querySelector('.price-val');
        const priceLeaseEl = card.querySelector('.price-lease');

        // Specs Grid height check
        let specsGridData = null;
        if (specsGrid) {
          const rect = specsGrid.getBoundingClientRect();
          const scrollH = specsGrid.scrollHeight;
          const clientH = specsGrid.clientHeight;
          const compStyle = window.getComputedStyle(specsGrid);
          
          // Check items
          const itemsData = specItems.map(item => {
            const lbl = item.querySelector('.spec-mini-lbl')?.textContent || '';
            const valEl = item.querySelector('.spec-mini-val');
            const val = valEl?.textContent || '';
            const isValTruncated = valEl ? valEl.scrollWidth > valEl.clientWidth : false;
            const itemRect = item.getBoundingClientRect();
            return {
              lbl,
              val,
              isValTruncated,
              itemTopRelative: itemRect.top - rect.top,
              itemBottomRelative: itemRect.bottom - rect.top,
              isClippedByGrid: (itemRect.bottom - rect.top) > clientH
            };
          });

          specsGridData = {
            rectHeight: Math.round(rect.height),
            scrollHeight: scrollH,
            clientHeight: clientH,
            cssHeight: compStyle.height,
            isGridClipped: scrollH > clientH,
            clippedHeight: scrollH - clientH,
            items: itemsData,
            hasClippedItems: itemsData.some(it => it.isClippedByGrid)
          };
        }

        // Badge truncation check
        let badgeData = null;
        if (badgeEl) {
          const bRect = badgeEl.getBoundingClientRect();
          const isTruncated = badgeEl.scrollWidth > badgeEl.clientWidth;
          const compStyle = window.getComputedStyle(badgeEl);
          badgeData = {
            text: badgeEl.textContent.trim(),
            width: Math.round(bRect.width),
            scrollWidth: badgeEl.scrollWidth,
            clientWidth: badgeEl.clientWidth,
            isTruncated,
            maxWidth: compStyle.maxWidth
          };
        }

        // Name clamp & height check
        let nameData = null;
        if (nameEl) {
          const nRect = nameEl.getBoundingClientRect();
          const comp = window.getComputedStyle(nameEl);
          const scrollH = nameEl.scrollHeight;
          const clientH = nameEl.clientHeight;
          nameData = {
            text: nameEl.textContent.trim(),
            height: Math.round(nRect.height),
            scrollH,
            clientH,
            lineHeight: comp.lineHeight,
            cssHeight: comp.height,
            isClipped: scrollH > clientH
          };
        }

        // Desc clamp & height check
        let descData = null;
        if (descEl) {
          const dRect = descEl.getBoundingClientRect();
          const comp = window.getComputedStyle(descEl);
          const scrollH = descEl.scrollHeight;
          const clientH = descEl.clientHeight;
          descData = {
            text: descEl.textContent.trim().substring(0, 40) + '...',
            height: Math.round(dRect.height),
            scrollH,
            clientH,
            lineHeight: comp.lineHeight,
            cssHeight: comp.height,
            isClipped: scrollH > clientH
          };
        }

        return {
          slug,
          badge: badgeData,
          name: nameData,
          desc: descData,
          specsGrid: specsGridData
        };
      });
    });

    // 3. Audit ROI Calculator with max slider values
    const roiAudit = await page.evaluate(async () => {
      const sliderStaff = document.getElementById('sliderStaff');
      const sliderSalary = document.getElementById('sliderSalary');
      if (!sliderStaff || !sliderSalary) return null;

      // Set max values to stress test layout with largest possible tenge numbers
      sliderStaff.value = '15';
      sliderStaff.dispatchEvent(new Event('input', { bubbles: true }));
      sliderSalary.value = '500000';
      sliderSalary.dispatchEvent(new Event('input', { bubbles: true }));

      const monthlyEl = document.getElementById('roiMonthlySavings');
      const yearlyEl = document.getElementById('roiYearlySavings');
      const paybackEl = document.getElementById('roiPaybackMonths');
      const hoursEl = document.getElementById('roiHoursSaved');
      const box = document.querySelector('.calc-results-box');
      const miniGrid = document.querySelector('.result-grid-mini');
      const miniItems = Array.from(document.querySelectorAll('.r-mini-item'));

      const boxRect = box ? box.getBoundingClientRect() : null;
      const yearlyRect = yearlyEl ? yearlyEl.getBoundingClientRect() : null;
      const isYearlyOverflow = yearlyEl ? yearlyEl.scrollWidth > yearlyEl.clientWidth : false;

      // Check calc-field labels
      const calcLabels = Array.from(document.querySelectorAll('.calc-field label')).map(lbl => {
        const spanText = lbl.querySelector('span:first-child')?.textContent || '';
        const badgeText = lbl.querySelector('.val-badge')?.textContent || '';
        const rect = lbl.getBoundingClientRect();
        return {
          spanText,
          badgeText,
          width: Math.round(rect.width),
          scrollWidth: lbl.scrollWidth,
          isOverflow: lbl.scrollWidth > lbl.clientWidth
        };
      });

      return {
        monthlySavings: monthlyEl?.textContent,
        yearlySavings: yearlyEl?.textContent,
        payback: paybackEl?.textContent,
        hours: hoursEl?.textContent,
        boxWidth: boxRect ? Math.round(boxRect.width) : 0,
        yearlyWidth: yearlyRect ? Math.round(yearlyRect.width) : 0,
        isYearlyOverflow,
        miniItems: miniItems.map(item => {
          const valEl = item.querySelector('.m-val');
          const rect = item.getBoundingClientRect();
          return {
            label: item.querySelector('.m-lbl')?.textContent,
            val: valEl?.textContent,
            width: Math.round(rect.width),
            valScrollWidth: valEl ? valEl.scrollWidth : 0,
            valClientWidth: valEl ? valEl.clientWidth : 0,
            valOverflows: valEl ? valEl.scrollWidth > valEl.clientWidth : false
          };
        }),
        calcLabels
      };
    });

    // 4. Audit Modal Dialog on this viewport
    const modalAudit = await page.evaluate(async () => {
      // Click first robot card directly (entire card is now clickable)
      const card = document.querySelector('.robot-card[data-slug="go2-air"]');
      if (card) card.click();

      const dialog = document.getElementById('productDialog');
      if (!dialog || !dialog.open) return null;

      const header = dialog.querySelector('.modal-header');
      const titleWrap = dialog.querySelector('.modal-header-title-wrap');
      const h3 = dialog.querySelector('.modal-header h3');
      const badge = dialog.querySelector('.modal-header .card-badge');
      const closeBtn = dialog.querySelector('.modal-close-btn');
      const body = dialog.querySelector('.modal-body');
      const imgWrap = dialog.querySelector('.modal-img-wrap');
      const table = dialog.querySelector('.modal-specs-table');
      const footer = dialog.querySelector('.modal-footer');

      const h3Rect = h3 ? h3.getBoundingClientRect() : null;
      const isH3Truncated = h3 ? h3.scrollWidth > h3.clientWidth : false;

      const tableRect = table ? table.getBoundingClientRect() : null;
      const bodyRect = body ? body.getBoundingClientRect() : null;
      const isTableOverflowing = table && body ? table.scrollWidth > body.clientWidth : false;

      // Close modal
      dialog.close();

      return {
        dialogWidth: dialog.getBoundingClientRect().width,
        h3Text: h3?.textContent,
        h3Width: h3Rect ? Math.round(h3Rect.width) : 0,
        h3ScrollWidth: h3 ? h3.scrollWidth : 0,
        isH3Truncated,
        isTableOverflowing,
        tableWidth: tableRect ? Math.round(tableRect.width) : 0,
        bodyWidth: bodyRect ? Math.round(bodyRect.width) : 0
      };
    });

    // 5. Audit Horizontal Page Scroll (Visual Leaks / Stacking)
    const pageScrollAudit = await page.evaluate(() => {
      const docWidth = document.documentElement.offsetWidth;
      const winWidth = window.innerWidth;
      const scrollWidth = document.documentElement.scrollWidth;
      return {
        docWidth,
        winWidth,
        scrollWidth,
        hasHorizontalScroll: scrollWidth > winWidth
      };
    });

    // Capture screenshot for visual inspection
    const screenshotPath = path.join(screenshotsDir, `audit-${vp.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    auditResults.viewports[vp.name] = {
      viewport: vp,
      searchAudit,
      pageScrollAudit,
      roiAudit,
      modalAudit,
      cardsCount: cardsAudit.length,
      clippedSpecsGridCount: cardsAudit.filter(c => c.specsGrid?.isGridClipped).length,
      clippedSpecsItemsCount: cardsAudit.filter(c => c.specsGrid?.hasClippedItems).length,
      truncatedBadgesCount: cardsAudit.filter(c => c.badge?.isTruncated).length,
      sampleCard: cardsAudit[0], // Unitree Go2 Air
      allCards: cardsAudit
    };

    if (searchAudit) {
      console.log(`[${vp.name}] Search input: placeholder ${searchAudit.placeholderCharCount} chars, textWidth: ${searchAudit.textWidth}px, innerWidth: ${searchAudit.innerWidth}px, CLIPPED: ${searchAudit.isClipped}`);
    } else {
      console.log(`[${vp.name}] Search input: removed (simplified category toolbar layout)`);
    }
    console.log(`[${vp.name}] Cards: ${cardsAudit.length} total, clipped specs grid: ${auditResults.viewports[vp.name].clippedSpecsGridCount}, truncated badges: ${auditResults.viewports[vp.name].truncatedBadgesCount}`);
    console.log(`[${vp.name}] Horizontal page overflow: ${pageScrollAudit.hasHorizontalScroll}`);
    if (modalAudit) {
      console.log(`[${vp.name}] Modal Title Truncated: ${modalAudit.isH3Truncated} (w: ${modalAudit.h3Width}px, scrollW: ${modalAudit.h3ScrollWidth}px)`);
    }

    await page.close();
  }

  await browser.close();

  const reportJsonPath = path.join(__dirname, 'ui_audit_results.json');
  fs.writeFileSync(reportJsonPath, JSON.stringify(auditResults, null, 2), 'utf-8');
  console.log(`\nAudit complete! Raw results written to: ${reportJsonPath}`);
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
