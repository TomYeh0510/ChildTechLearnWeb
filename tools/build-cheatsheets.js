/* 產生「整套步驟卡」PDF（給 Claude 用，Tom 不需要操作）。
 * 執行：NODE_PATH=$(npm root -g) node tools/build-cheatsheets.js
 * 每次改 index.html 的 KITS 或 LESSONS 後都要重跑；tests/check.js 會比對 cheatsheets/hash.json，內容對不上就失敗。 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const out = path.join(root, 'cheatsheets');
const url = 'file://' + path.join(root, 'index.html');

(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy });
  const page = await browser.newPage({ colorScheme: 'light' });
  await page.goto(url, { waitUntil: 'networkidle' }).catch(() => page.goto(url));
  await page.evaluate(() => document.fonts.ready);
  const stages = await page.evaluate(() => [...new Set([...document.querySelectorAll('.sheet')].map((s) => s.id.split('-')[1]))]);
  const hashes = {};
  for (const id of stages) {
    const text = await page.evaluate((id) => {
      const ids = [...document.querySelectorAll('#les-' + id + ' .sheet')].map((s) => s.id);
      window.ttPrepPrint(ids);
      return document.getElementById('printhost').innerText;
    }, id);
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: path.join(out, 'tech-together-' + id + '.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
    await page.emulateMedia({ media: 'screen' });
    hashes[id] = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
    console.log('寫入 cheatsheets/tech-together-' + id + '.pdf');
  }
  fs.writeFileSync(path.join(out, 'hash.json'), JSON.stringify(hashes, null, 2) + '\n');
  await browser.close();
})();
