/* 每次修改 index.html 後執行的基本檢查（給 Claude 用，Tom 不需要操作）。
 * 執行：NODE_PATH=$(npm root -g) node tests/check.js
 * 全部通過才算完成；有失敗會以非零狀態結束。
 * 檢查內容：頁面沒有備註、來源都記錄在 REFERENCES.md、資料屬性齊全、
 * 軟體資料單一來源、網址與畫面同步與返回鍵、鍵盤操作、篩選、窄螢幕不橫向溢出、無程式錯誤。 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const url = 'file://' + path.join(root, 'index.html');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const refs = fs.readFileSync(path.join(root, 'REFERENCES.md'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (!cond && extra ? '  → ' + extra : ''));
  if (!cond) failed++;
}
const norm = (u) => u.replace(/&amp;/g, '&').replace(/\/$/, '');

(async () => {
  /* ---- 靜態檢查：來源都記錄在 REFERENCES.md ---- */
  const hrefs = [...new Set([...html.matchAll(/<a [^>]*href="(https?:[^"]+)"/g)].map((m) => norm(m[1])))];
  const refsNorm = refs.replace(/\/(?=[\s|）)，。]|$)/g, '');
  const missing = hrefs.filter((h) => !refs.includes(h) && !refsNorm.includes(h));
  ok('頁面上 ' + hrefs.length + ' 個外部連結都記錄在 REFERENCES.md', missing.length === 0, missing.join('\n    '));

  /* ---- 靜態檢查：頁面不放備註 ---- */
  ok('沒有備註用的 class（src / mx-note / stack-cap / footer）', !/class="(src|mx-note|stack-cap)"|<footer/.test(html));
  for (const w of ['來源：', '查詢', '本路線建議', '整理於', '規劃中']) {
    ok('頁面不出現「' + w + '」', !html.replace(/<script[\s\S]*?<\/script>/g, '').includes(w));
  }

  /* ---- 靜態檢查：教材卡屬性齊全 ---- */
  const cardTags = [...html.matchAll(/<a class="card"[^>]*>/g)].map((m) => m[0]);
  const need = ['data-region', 'data-lv', 'data-cost', 'data-lang', 'data-fmt', 'data-eq'];
  const bad = cardTags.filter((t) => need.some((a) => !t.includes(a + '=')));
  ok('每張教材卡都有 ' + need.join('、'), bad.length === 0 && cardTags.length > 0, bad.length + ' 張缺屬性');

  const browser = await chromium.launch();
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/CERT|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.goto(url); await page.waitForTimeout(400);

  const st = () => page.evaluate(() => ({
    hash: location.hash,
    tab: [...document.querySelectorAll('section')].filter((x) => !x.hidden).map((x) => x.id)[0],
    stage: [...document.querySelectorAll('article.stage')].filter((x) => !x.hidden).map((x) => x.id)[0],
  }));

  /* ---- 軟體資料單一來源 ---- */
  const sw = await page.evaluate(() => {
    const rows = document.querySelectorAll('#swbody tr').length;
    const bars = document.querySelectorAll('#swchart .b').length;
    return { rows, bars };
  });
  const expectBars = (html.match(/"group":/g) || []).length;
  const expectRows = (html.match(/\{"name":/g) || []).length;
  ok('軟體表格列數 = 資料筆數（' + expectRows + '）', sw.rows === expectRows, sw.rows + ' vs ' + expectRows);
  ok('軟體圖表色條數 = 有分組的資料筆數（' + expectBars + '）', sw.bars === expectBars, sw.bars + ' vs ' + expectBars);

  /* ---- 網址、返回鍵 ---- */
  await page.goto(url + '#s1'); await page.waitForTimeout(300);
  let t = await st();
  ok('開 #s1 顯示幼兒', t.tab === 'stages' && t.stage === 's1');
  await page.click('[data-stage="s5"]'); t = await st();
  ok('點國中後網址同步', t.hash === '#s5' && t.stage === 's5');
  await page.reload(); await page.waitForTimeout(300); t = await st();
  ok('重新整理仍在國中', t.stage === 's5' && t.tab === 'stages');
  await page.click('[data-stage="s2"]'); await page.click('[data-tab="software"]');
  await page.goBack(); await page.waitForTimeout(150); t = await st();
  ok('上一頁回到低年級', t.tab === 'stages' && t.stage === 's2' && t.hash === '#s2');
  await page.goForward(); await page.waitForTimeout(150); t = await st();
  ok('下一頁回到軟體階梯', t.tab === 'software');

  /* ---- 鍵盤與 ARIA ---- */
  await page.click('[data-tab="stages"]');
  await page.focus('[data-stage="s2"]'); await page.keyboard.press('ArrowRight'); t = await st();
  ok('年齡分頁：→ 移到中年級並移焦點', t.stage === 's3' && (await page.evaluate(() => document.activeElement.dataset.stage)) === 's3');
  await page.keyboard.press('End'); t = await st(); ok('年齡分頁：End 到國中', t.stage === 's5');
  await page.keyboard.press('Home'); t = await st(); ok('年齡分頁：Home 到幼兒', t.stage === 's1');
  const h0 = await page.evaluate(() => history.length); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  ok('方向鍵不增加歷史紀錄', h0 === (await page.evaluate(() => history.length)));
  const aria = await page.evaluate(() => {
    const b = document.querySelector('[data-stage="s3"]'), p = document.getElementById('s3');
    return b.getAttribute('aria-controls') === 's3' && p.getAttribute('aria-labelledby') === b.id && p.getAttribute('role') === 'tabpanel';
  });
  ok('年齡分頁 ARIA 關聯完整', aria);

  /* ---- 從這裡開始 ---- */
  await page.click('[data-tab="overview"]');
  await page.click('[data-start="s1"]');
  ok('從這裡開始：顯示幼兒建議', /幼兒/.test(await page.textContent('#startout')));
  await page.click('[data-so="card"]'); await page.waitForTimeout(150);
  ok('從這裡開始：打開幼兒活動卡', (await st()).stage === 's1' && (await page.evaluate(() => document.getElementById('act-s1').open)));

  /* ---- 篩選：結果和資料屬性一致 ---- */
  await page.click('[data-tab="resources"]');
  const visible = () => page.evaluate(() => [...document.querySelectorAll('#resources .card')].filter((c) => !c.hidden).length);
  const expect = (fn) => page.evaluate(fn);
  await page.click('.chip[data-f="cost"][data-v="free"]');
  ok('費用：完全免費', (await visible()) === (await expect(() => [...document.querySelectorAll('#resources .card')].filter((c) => c.dataset.cost === 'free').length)));
  await page.click('.chip[data-f="lang"][data-v="zh"]');
  ok('費用＋語言可疊加', (await visible()) === (await expect(() => [...document.querySelectorAll('#resources .card')].filter((c) => c.dataset.cost === 'free' && c.dataset.lang === 'zh').length)));
  await page.click('.chip[data-f="cost"][data-v="all"]'); await page.click('.chip[data-f="lang"][data-v="all"]');
  await page.click('.chip[data-f="lv"][data-v="s1"]');
  ok('幼兒：無教材時顯示整理中說明', (await visible()) === 0 && /整理中/.test(await page.textContent('#resempty')));
  await page.click('.chip[data-f="lv"][data-v="all"]');
  await page.click('.chip[data-f="eq"][data-v="printer"]');
  ok('設備：需要印表機', (await visible()) === (await expect(() => [...document.querySelectorAll('#resources .card')].filter((c) => c.dataset.eq === 'printer').length)));

  ok('沒有程式錯誤', errs.length === 0, errs.join(' | '));

  /* ---- 窄螢幕：每個分頁都不橫向溢出 ---- */
  for (const w of [320, 360, 390, 768, 1100]) {
    for (const scheme of ['light', 'dark']) {
      const q = await browser.newPage({ viewport: { width: w, height: 800 }, colorScheme: scheme });
      await q.goto(url); await q.waitForTimeout(250);
      const wide = [];
      for (const tb of ['overview', 'print3d', 'stages', 'software', 'safety', 'resources']) {
        await q.evaluate((x) => document.querySelector('nav.top [data-tab="' + x + '"]').click(), tb);
        const sw2 = await q.evaluate(() => document.documentElement.scrollWidth);
        if (sw2 > w) wide.push(tb + '=' + sw2);
      }
      ok(w + 'px ' + scheme + '：各分頁無橫向溢出', wide.length === 0, wide.join(', '));
      await q.close();
    }
  }

  await browser.close();
  console.log(failed ? '\n有 ' + failed + ' 項失敗' : '\n全部通過');
  process.exit(failed ? 1 : 0);
})();
