import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const extension = new URL("../../../extensions/passport-guide/", import.meta.url);
async function setup(page: import("playwright").Page, form: string, autoMove = false) {
  await page.setContent(`<html><head><title>Passport Seva · test form</title><style>*{box-sizing:border-box}body{margin:0;font:14px system-ui;background:#f8f9fd;color:#34415a}main{max-width:740px;margin:30px auto;padding:20px}fieldset{border:1px solid #dce0ee;border-radius:9px;padding:20px;background:#fff}legend{font-weight:600}label,.label{display:block;margin:14px 0 5px}input,select{padding:10px;border:1px solid #cbd2e2;border-radius:5px;width:100%}input[type=radio]{width:auto}td{padding:6px}button{padding:9px 20px;margin:12px 0;border:0;background:#6052bf;color:#fff;border-radius:5px}</style></head><body><main><h1>Passport application</h1><form>${form}</form></main></body></html>`);
  await page.evaluate(`globalThis.chrome={storage:{local:{get:async()=>({guideAutoEnabled:${autoMove}}),set:async()=>{}}},runtime:{sendMessage:async(message)=>({ok:true,guide:{title:message.context.field.label,explanation:"AI explains the exact question.",example:"",caution:"",stage:"applicant",targetId:message.context.field.id,plan:["Answer the question"],trace:["inspect_page","guide_user"]}})}}`);
  for (const file of ["guidance-languages.js", "languages.js", "guide-state.js", "passport-knowledge.js", "coach.js", "field-reader.js", "inline-theme.js", "content.js"]) await page.addScriptTag({ path: fileURLToPath(new URL(file, extension)) });
  await page.waitForSelector('[data-passport-guide="note"]');
}

test("inline guidance recognizes labels, family context and unlabeled tables without a floating screen", { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
    await setup(page, `<fieldset><legend>Applicant details</legend><label for="given">Given name</label><input id="given" required><div><span class="label">Are you eligible for Non-ECR category?</span><select id="nonEcr"><option value="">Choose</option><option>Yes</option><option>No</option></select></div><table><tr><td>Visible distinguishing mark</td><td><input id="mark"></td></tr></table></fieldset><fieldset><legend>Father's details</legend><div><span class="label">Given name</span><input id="fatherGivenName"></div></fieldset>`, false);
    assert.equal(await page.locator("#passagent-guide-root,.panel,.launcher").count(), 0);
    assert.equal(await page.locator('[data-passport-guide="note"]').count(), 4);
    const nameNote = page.locator('#given + [data-passport-guide="note"]');
    assert.match(await nameNote.locator(".explanation").innerText(), /first and middle/);
    const ecrNote = page.locator('#nonEcr + [data-passport-guide="note"]');
    assert.match(await ecrNote.locator(".explanation").innerText(), /emigration clearance/);
    assert.equal(await ecrNote.locator("a").getAttribute("href"), "https://www.passportindia.gov.in/AppOnlineProject/pdf/ApplicationformInstructionBooklet-V3.0.pdf");
    assert.match(await page.locator('#fatherGivenName + [data-passport-guide="note"]').locator(".explanation").innerText(), /father's first and middle/);
    assert.match(await page.locator('tr:has(#mark) + [data-passport-guide="row"] [data-passport-guide="note"]').locator(".explanation").innerText(), /mole or birthmark/);
    await page.locator("#given").focus();
    const inputBounds = await page.locator("#given").boundingBox();
    const noteBounds = await nameNote.boundingBox();
    assert.ok(inputBounds && noteBounds && Math.abs(inputBounds.x - noteBounds.x) < 1 && Math.abs(inputBounds.width - noteBounds.width) < 1);
    const strip = await nameNote.locator(".note").boundingBox();
    assert.ok(strip && strip.width > strip.height * 3 && strip.height < 100);
    const ringBounds = await page.locator('[data-passport-guide="highlight"]').locator(".ring").boundingBox();
    assert.ok(inputBounds && ringBounds && Math.abs(ringBounds.x - inputBounds.x + 4) < 1 && Math.abs(ringBounds.width - inputBounds.width - 8) < 1);
    await page.screenshot({ path: fileURLToPath(new URL("../../../guide-inline-desktop.png", import.meta.url)), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    await page.screenshot({ path: fileURLToPath(new URL("../../../guide-inline-mobile.png", import.meta.url)), fullPage: true });
    assert.equal(overflow, false);
    await page.screenshot({ path: fileURLToPath(new URL("../../../guide-inline-mobile.png", import.meta.url)), fullPage: true });
    await page.locator('[data-passport-guide="toolbar"]').locator("#hide").click();
    assert.equal(await nameNote.isVisible(), false);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("coach waits for Done, checks errors and requires confirmation before the next section", { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await setup(page, `<fieldset><legend>Applicant details</legend><label for="given">Given name</label><input id="given" required><label for="email">Email address</label><input id="email" type="email" required><button id="next" type="button" onclick="this.dataset.clicked='yes'">Next</button><button id="submit" type="button" onclick="this.dataset.clicked='yes'">Submit application</button></fieldset>`);
    const nameNote = page.locator('#given + [data-passport-guide="note"]');
    const emailNote = page.locator('#email + [data-passport-guide="note"]');
    assert.equal(await nameNote.isVisible(), true); assert.equal(await emailNote.isVisible(), false);
    await page.locator("#given").fill("PRIVATE TEST NAME");
    await page.waitForTimeout(2300);
    assert.equal(await page.locator("#given").evaluate((el) => el === document.activeElement), true);
    await nameNote.locator(".next").click();
    assert.equal(await page.locator("#email").evaluate((el) => el === document.activeElement), true);
    assert.equal(await nameNote.isVisible(), false); assert.equal(await emailNote.isVisible(), true);
    await page.locator("#email").fill("invalid-email"); await emailNote.locator(".next").click();
    assert.match(await emailNote.locator(".status").innerText(), /email format/);
    assert.equal(await page.locator("#next").getAttribute("data-clicked"), null);
    await page.locator("#email").fill("person@example.com"); await emailNote.locator(".next").click();
    const toolbar = page.locator('[data-passport-guide="toolbar"]');
    assert.match(await toolbar.locator(".count").innerText(), /2\/2 reviewed/);
    assert.equal(await page.locator("#next").getAttribute("data-clicked"), null);
    await toolbar.locator("#continue").click();
    assert.equal(await page.locator("#next").getAttribute("data-clicked"), "yes");
    assert.equal(await page.locator("#submit").getAttribute("data-clicked"), null);
  } finally { await browser.close(); }
});

test("employment follow-up suggests only a visible option and writes it after confirmation", { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1150, height: 900 } });
    await setup(page, `<fieldset><legend>Applicant details</legend><label for="employment">Employment Type</label><select id="employment" required><option value="">Choose</option><option value="student">Student</option><option value="private">Private</option><option value="self">Self Employed</option></select><label for="education">Educational qualification</label><select id="education" required><option value="">Choose</option><option value="graduate">Graduate and above</option></select></fieldset>`);
    const note = page.locator('#employment + [data-passport-guide="note"]');
    await note.locator(".follow-up summary").click();
    await note.locator(".follow-up select").selectOption("student");
    assert.match(await note.locator(".suggestion").innerText(), /Suggested option: Student/);
    assert.equal(await page.locator("#employment").inputValue(), "");
    await note.locator(".use-suggestion").click();
    assert.equal(await page.locator("#employment").inputValue(), "student");
    assert.equal(await page.locator("#education").evaluate((el) => el === document.activeElement), false);
    await page.screenshot({ path: fileURLToPath(new URL("../../../passport-coach-followup.png", import.meta.url)), fullPage: true });
    await note.locator(".next").click();
    assert.equal(await page.locator("#education").evaluate((el) => el === document.activeElement), true);
  } finally { await browser.close(); }
});

test("registration checks password confirmation and future birth dates locally", { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await setup(page, `<fieldset><legend>Registration</legend><label for="password">Password</label><input id="password" type="password" required><label for="confirm">Confirm password</label><input id="confirm" type="password" required><label for="dob">Date of birth</label><input id="dob" type="date" required></fieldset>`);
    await page.locator("#password").fill("PRIVATE SECRET ONE");
    await page.locator('#password + [data-passport-guide="note"]').locator(".next").click();
    await page.locator("#confirm").fill("PRIVATE SECRET TWO");
    const confirmation = page.locator('#confirm + [data-passport-guide="note"]');
    await confirmation.locator(".next").click();
    assert.match(await confirmation.locator(".status").innerText(), /passwords do not match/);
    assert.equal((await confirmation.locator(".status").innerText()).includes("PRIVATE"), false);
    await page.locator("#confirm").fill("PRIVATE SECRET ONE"); await confirmation.locator(".next").click();
    await page.locator("#dob").fill("2999-01-01");
    const dob = page.locator('#dob + [data-passport-guide="note"]'); await dob.locator(".next").click();
    assert.match(await dob.locator(".status").innerText(), /cannot be in the future/);
  } finally { await browser.close(); }
});

test("coach recognizes the nested visual labels and custom radios used by public registration", { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
    await setup(page, `<div style="max-width:500px"><div><div>Register to apply at<span>*</span></div><div style="font-size:11px">Select CPV Delhi for diplomatic/official passport applications.</div><div style="display:flex;gap:25px"><div style="display:flex;align-items:center;gap:6px"><div data-focusable="true" tabindex="0" style="width:17px;height:17px;border:1px solid;border-radius:9px"><i style="display:none;width:7px;height:7px"></i></div><div data-focusable="true" tabindex="0" onclick="this.dataset.selected='true';this.previousElementSibling.firstElementChild.style.display='block'"><div dir="auto">CPV Delhi</div></div></div><div style="display:flex;align-items:center;gap:6px"><div data-focusable="true" tabindex="0" style="width:17px;height:17px;border:1px solid;border-radius:9px"><i style="display:none;width:7px;height:7px"></i></div><div data-focusable="true" tabindex="0" data-choice="office" onclick="this.dataset.selected='true';this.previousElementSibling.firstElementChild.style.display='block'"><div dir="auto">Passport Office</div></div></div></div></div><div style="margin-top:20px"><div><span>Full Name</span><span>*</span></div><div><div><div><div style="min-height:64px;padding-top:8px"><input id="visual-name" data-testid="text-input-outlined" style="height:56px"></div></div></div></div></div><div style="margin-top:20px"><div>Email ID *</div><div><div><div><input id="visual-email" data-testid="text-input-outlined"></div></div></div></div></div>`);
    const toolbar = page.locator('[data-passport-guide="toolbar"]');
    await toolbar.locator(".settings > summary").click();
    await toolbar.locator("#all").click();
    const notes = page.locator('[data-passport-guide="note"]');
    assert.equal(await notes.count(), 3);
    assert.equal(await notes.nth(1).locator("strong").innerText(), "Full name");
    assert.match(await notes.nth(1).locator(".badge").innerText(), /Required/);
    assert.equal(await notes.nth(2).locator("strong").innerText(), "Email address");
    const registration = notes.first();
    await registration.locator(".follow-up summary").click();
    await registration.locator(".follow-up select").selectOption("ordinary");
    assert.match(await registration.locator(".suggestion").innerText(), /Passport Office/);
    const office = page.locator('[data-choice="office"]');
    assert.equal(await office.getAttribute("data-selected"), null);
    await registration.locator(".use-suggestion").click();
    assert.equal(await office.getAttribute("data-selected"), "true");
    const fieldBounds = await page.locator("#visual-name").boundingBox();
    const noteBounds = await notes.nth(1).boundingBox();
    assert.ok(fieldBounds && noteBounds && noteBounds.y >= fieldBounds.y + fieldBounds.height);
  } finally { await browser.close(); }
});


test("automatic guide focuses the first question and never attaches to navigation or search", { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await setup(page, `<header><label for="headerSearch">Search</label><input id="headerSearch" type="search"></header><div role="search"><input aria-label="Search website"></div><label for="given">Given name</label><input id="given" required><label for="email">Email address</label><input id="email" type="email" required><label for="employment">Employment Type</label><select id="employment" required><option value="">Choose</option><option>Student</option><option>Private</option></select><label for="surname">Surname</label><input id="surname"><button type="button" id="outside">Page help</button>`, true);
    assert.equal(await page.locator('[data-passport-guide="note"]').count(), 4);
    assert.equal(await page.locator('header [data-passport-guide],[role=search] [data-passport-guide]').count(), 0);
    assert.equal(await page.locator('#given').evaluate(el => el === document.activeElement), true);
    await page.locator('#given').fill('Sample');
    await page.waitForTimeout(2400);
    assert.equal(await page.locator('#given').evaluate(el => el === document.activeElement), true, 'does not interrupt typing');
    await page.locator('#given').press('Enter');
    assert.equal(await page.locator('#email').evaluate(el => el === document.activeElement), true);
    await page.locator('#email').fill('sample@example.test');
    await page.locator('#outside').focus();
    await page.waitForFunction(() => document.activeElement?.id === 'employment');
    await page.locator('#employment').selectOption({label:'Student'});
    await page.waitForFunction(() => document.activeElement?.id === 'surname');
    await page.locator('[data-passport-guide="toolbar"]').locator('#auto').click();
    assert.match(await page.locator('[data-passport-guide="toolbar"]').locator('#auto').innerText(), /off/);
    await page.screenshot({path: fileURLToPath(new URL('../../../passport-coach-auto.png', import.meta.url)), fullPage:true});
    // A route changing to search-only leaves no visible coach UI behind.
    await page.evaluate(() => { document.querySelector('main')!.innerHTML='<h1>Search the website</h1><input type="search" aria-label="Search">'; });
    await page.waitForTimeout(500);
    assert.equal(await page.locator('[data-passport-guide="note"]').count(), 0);
    assert.equal(await page.locator('[data-passport-guide="toolbar"]').count(), 0);
    assert.equal(await page.locator('[data-passport-guide="highlight"]').locator('.ring').isVisible(), false);
  } finally { await browser.close(); }
});


test("automatic typing focus waits for a pause, restarts on typing and honors Stay here", { timeout: 45_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await setup(page, `<label for="given">Given name</label><input id="given" required><label for="email">Email address</label><input id="email" type="email" required><label for="password">Password</label><input id="password" type="password" required>`, true);
    await page.locator('#given').fill('Sam');
    await page.waitForTimeout(2700);
    await page.locator('#given').fill('Sample');
    await page.waitForTimeout(1800);
    assert.equal(await page.locator('#given').evaluate(el => el === document.activeElement), true, 'new typing restarts the wait');
    await page.waitForFunction(() => document.activeElement?.id === 'email');
    await page.locator('#email').fill('invalid');
    await page.waitForTimeout(4300);
    assert.equal(await page.locator('#email').evaluate(el => el === document.activeElement), true, 'invalid answer does not advance');
    await page.locator('#email').fill('sample@example.test');
    const note = page.locator('#email + [data-passport-guide="note"]');
    await note.locator('.stay').click();
    await page.locator('#email').focus();
    await page.waitForTimeout(4300);
    assert.equal(await page.locator('#email').evaluate(el => el === document.activeElement), true, 'Stay here cancels movement');
    await note.locator('.next').click();
    assert.equal(await page.locator('#password').evaluate(el => el === document.activeElement), true);
    await page.locator('#password').fill('Example-only-123');
    await page.waitForTimeout(4300);
    assert.equal(await page.locator('#password').evaluate(el => el === document.activeElement), true, 'password still waits for explicit continuation');
    // A newly mounted form on the same page starts without pressing Start.
    await page.evaluate(() => { document.querySelector('form')!.innerHTML='<label for="surname">Surname</label><input id="surname" required>'; });
    await page.waitForFunction(() => document.activeElement?.id === 'surname');
  } finally { await browser.close(); }
});


test("language selection persists, translates guidance and leaves portal details in English",{timeout:30_000},async()=>{
 const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1100,height:950}});
 await setup(page,`<fieldset><legend>Applicant details</legend><label for="given">Full name</label><input id="given" required><label for="employment">Employment Type</label><select id="employment"><option value="">Choose</option><option>Student</option><option>Private</option></select></fieldset>`,false);
 await page.evaluate(`globalThis.savedLanguage=null;chrome.storage.local.set=async(data)=>{if(data.guideLanguage)globalThis.savedLanguage=data.guideLanguage};`);
 const toolbar=page.locator('[data-passport-guide="toolbar"]');const languages=toolbar.locator('[data-pa-language]');
 assert.equal(await languages.locator('option').count(),7);
 await page.locator('#given').fill('Asha Mehta');
 const note=page.locator('#given + [data-passport-guide="note"]');const english=await note.locator('.explanation').innerText();
 for(const code of ['hi','bn','mr','ta','te','gu']){
  await languages.selectOption(code);await page.waitForTimeout(30);
  assert.notEqual(await note.locator('.explanation').innerText(),english);
  assert.equal(await page.locator('#given').inputValue(),'Asha Mehta');assert.equal(await page.locator('label[for=given]').innerText(),'Full name');
  assert.equal(await page.locator('#employment option').nth(1).innerText(),'Student');
  assert.equal(await note.locator('strong').innerText(),'Full name');
  assert.equal(await page.evaluate(`globalThis.savedLanguage`),code);
  assert.equal(await languages.inputValue(),code);
 }
 await note.locator('.question-details summary').click();assert.match(await note.locator('.full-explanation').innerText(),/first name, middle names and surname/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:fileURLToPath(new URL('../../../passport-guide-gujarati.png',import.meta.url)),fullPage:true});
 await languages.selectOption('en');assert.equal(await note.locator('.explanation').innerText(),english);
 await page.setViewportSize({width:390,height:844});await languages.selectOption('ta');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:fileURLToPath(new URL('../../../passport-guide-tamil-mobile.png',import.meta.url)),fullPage:true});
 }finally{await browser.close();}
});
