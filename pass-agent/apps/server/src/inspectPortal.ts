import { chromium } from "playwright";
import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const browser = await chromium.launch({ headless: true });
const observations: unknown[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 960 } });
  for (const url of ["https://www.passportindia.gov.in/forms/registration"]) {
    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
      await page.locator("input,select,button,a").first().waitFor({ state: "attached", timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(5000);
      const scripts = ["passport-knowledge.js", "field-reader.js"];
      for (const script of scripts) await page.addScriptTag({ content: await readFile(new URL(`../../../extensions/passport-guide/${script}`, import.meta.url), "utf8") });
      const fields = await page.evaluate<unknown[]>(`Array.from(document.querySelectorAll('input:not([type=hidden]),select,textarea,button')).filter(el=>el.getBoundingClientRect().width>0).slice(0,100).map((el,index)=>{const field=PassportFieldReader.read(el,'f'+index);delete field.filled;delete field.invalid;const box=el.getBoundingClientRect();const parent=el.parentElement.cloneNode(true);parent.querySelectorAll('input,textarea').forEach(node=>{node.removeAttribute('value');node.textContent=''});return {...field,recognizedTopic:PassportKnowledge.lookup(field).id,width:box.width,height:box.height,opacity:getComputedStyle(el).opacity,parentMarkup:parent.outerHTML.slice(0,1600)}})`);
      const pageText = await page.locator("body").innerText();
      observations.push({ url: page.url(), status: response?.status(), fields, publicPageText: pageText.slice(0, 3000) });
      await page.screenshot({ path: fileURLToPath(new URL("../../../portal-registration-public.png", import.meta.url)), fullPage: true });
      console.log(`${new URL(url).pathname}: HTTP ${response?.status()}, ${fields.length} visible controls`);
    } catch { observations.push({ url, error: "The public page could not be inspected within the time limit." }); console.log(`${new URL(url).pathname}: public-page inspection unavailable`); }
  }
  const target = new URL("../../../portal-observation.json", import.meta.url);
  await writeFile(target, JSON.stringify(observations, null, 2));
  console.log(`Saved public-page observations: ${fileURLToPath(target)}`);
} finally { await browser.close(); }
