const { chromium } = require('playwright');
process.env.PLAYWRIGHT_BROWSERS_PATH = '/root/.cache/ms-playwright';
const path = require('path');
const fs   = require('fs');

const DCF_PATH = path.resolve(__dirname, 'index.html');
const SHOTS_DIR = path.resolve(__dirname, 'screenshots');
if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR);

async function shot(page, name, action) {
  if (action) await action();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(SHOTS_DIR, name),
    fullPage: false,
  });
  console.log('✓ ' + name);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const page    = await context.newPage();

  await page.goto('file://' + DCF_PATH);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Step 1 — Company Overview
  await shot(page, '01_company_overview.png');

  // Step 2 — Bond Terms
  await shot(page, '02_bond_terms.png', () => page.click('button:has-text("Next: Bond Terms")'));

  // Tweak coupon rate slider
  await shot(page, '03_bond_terms_adjusted.png', async () => {
    const slider = page.locator('#couponRate');
    await slider.evaluate(el => { el.value = 8; el.dispatchEvent(new Event('input')); });
    await page.waitForTimeout(300);
    await slider.evaluate(el => { el.value = 6.5; el.dispatchEvent(new Event('input')); });
  });

  // Step 3 — Cash Flows
  await shot(page, '04_cash_flows.png', () => page.click('button:has-text("Next: Cash Flows")'));

  // Step 4 — Discount Rate
  await shot(page, '05_discount_rate.png', () => page.click('button:has-text("Next: Discount Rate")'));

  // Step 5 — PV Calculations
  await shot(page, '06_pv_calculations.png', () => page.click('button:has-text("Next: PV Calculations")'));

  // Step 6 — Final Valuation (with sensitivity chart)
  await shot(page, '07_final_valuation.png', () => page.click('button:has-text("Next: Final Valuation")'));

  // Full-page final valuation
  await page.screenshot({
    path: path.join(SHOTS_DIR, '08_final_valuation_fullpage.png'),
    fullPage: true,
  });
  console.log('✓ 08_final_valuation_fullpage.png');

  // Navigate back to see live panel + different step
  await shot(page, '09_discount_rate_revisit.png', async () => {
    await page.click('button:has-text("← Back")');
    await page.click('button:has-text("← Back")');
  });

  await browser.close();
  console.log('\nAll screenshots saved to', SHOTS_DIR);
})();
