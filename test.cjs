const puppeteer = require('puppeteer');

const delay = ms => new Promise(res => setTimeout(res, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('pageerror', err => {
    console.log('PAGE_ERROR_CAPTURED:', err.message);
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE_ERROR:', msg.text());
    }
  });

  try {
    await page.goto('http://localhost:5173');
    await delay(2000); // wait for load
    
    // Switch to Kho từ
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const tab = tabs.find(t => t.textContent.includes('Kho từ'));
      if (tab) tab.click();
    });
    console.log('Clicked Kho từ');
    await delay(1000);
    
    // Click on the FileGroup header
    await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('.cursor-pointer'));
      const h = headers.find(el => el.textContent.includes('Test Session'));
      if (h) h.click();
    });
    console.log('Clicked FileGroup header');
    await delay(1000);
    
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
})();
