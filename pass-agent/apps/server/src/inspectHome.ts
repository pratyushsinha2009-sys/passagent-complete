import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1360,height:960}});
 await page.goto('https://www.passportindia.gov.in/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForTimeout(6000);
 const controls=await page.locator('a,button,[role=button],[data-focusable="true"][tabindex="0"]').evaluateAll(nodes=>nodes.filter(el=>el.getBoundingClientRect().width>1).map(el=>({tag:el.tagName,text:(el.textContent||'').trim().slice(0,160),href:el.getAttribute('href'),role:el.getAttribute('role'),markup:el.outerHTML.slice(0,1200)})).filter(el=>/register|login|log in|sign in|sign up|apply|passport/i.test(el.text)));
 await writeFile(new URL('../../../homepage-observation.json',import.meta.url),JSON.stringify({url:page.url(),controls},null,2));
 console.log(JSON.stringify({url:page.url(),controls},null,2));
} finally {await browser.close();}
