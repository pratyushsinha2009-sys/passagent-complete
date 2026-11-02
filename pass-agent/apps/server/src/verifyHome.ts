import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1360,height:960},bypassCSP:true});
 await page.goto('https://www.passportindia.gov.in/',{waitUntil:'domcontentloaded',timeout:30_000});
 await page.waitForTimeout(6000);
 await page.evaluate(`globalThis.chrome={storage:{local:{get:async()=>({}),set:async()=>{}}},runtime:{sendMessage:async()=>({})}}`);
 for(const file of ['guidance-languages.js','languages.js','guide-state.js','passport-knowledge.js','coach.js','field-reader.js','inline-theme.js','home-guide.js','content.js']) await page.addScriptTag({content:await readFile(new URL(`../../../extensions/passport-guide/${file}`,import.meta.url),'utf8')});
 await page.locator('[data-passport-guide="home"]').waitFor({timeout:8000});
 console.log('Public home guide visible: '+await page.locator('[data-passport-guide="home"]').isVisible());
 if(await page.locator('[data-passport-guide="home"]').locator('.notice').isVisible()) {
   await page.screenshot({path:fileURLToPath(new URL('../../../passport-coach-home-notice.png',import.meta.url)),fullPage:true});
   await page.locator('[data-passport-guide="home"]').locator('.notice').click();
   await page.locator('[data-passport-guide="home"]').locator('.new').waitFor({state:'visible'});
 }
 console.log('Highlighted starting action: '+await page.evaluate(()=>document.activeElement?.textContent?.trim()));
 await page.screenshot({path:fileURLToPath(new URL('../../../passport-coach-home.png',import.meta.url)),fullPage:true});
 console.log('No account opened, answers entered or application submitted.');
}finally{await browser.close();}
