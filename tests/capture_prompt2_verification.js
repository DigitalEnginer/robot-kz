const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--window-size=1280,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  const dir = path.join(__dirname, 'screenshots_prompt2');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // 1. Header & Hero
  await page.screenshot({ path: path.join(dir, '1_header_hero.png') });
  console.log('1. Captured Header & Hero');

  // 2. Configurator HoReCa
  await page.evaluate(() => {
    document.getElementById('calculator')?.scrollIntoView({ block: 'start' });
    const horecaBtn = document.querySelector('#cfgSphereGroup button[data-sphere="horeca"]');
    if (horecaBtn) horecaBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(dir, '2_configurator_horeca.png') });
  console.log('2. Captured Configurator HoReCa');

  // 3. Configurator R&D
  await page.evaluate(() => {
    const rndBtn = document.querySelector('#cfgSphereGroup button[data-sphere="rnd"]');
    if (rndBtn) rndBtn.click();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    const mediumBtn = document.querySelectorAll('#cfgScaleGroup button')[1];
    if (mediumBtn) mediumBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(dir, '3_configurator_rnd_b2.png') });
  console.log('3. Captured Configurator R&D B2');

  // 4. Rent Section with photos
  await page.evaluate(() => {
    document.getElementById('rent')?.scrollIntoView({ block: 'start' });
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(dir, '4_rent_section.png') });
  console.log('4. Captured Rent Section');

  await browser.close();
  console.log('Verification finished!');
})();
