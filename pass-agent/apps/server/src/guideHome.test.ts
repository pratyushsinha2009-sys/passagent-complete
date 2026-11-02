import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
const extension = new URL("../../../extensions/passport-guide/", import.meta.url);
const files = ["guidance-languages.js", "languages.js", "guide-state.js", "passport-knowledge.js", "coach.js", "field-reader.js", "inline-theme.js", "home-guide.js", "content.js"];
test("home guide highlights the real starting action and opens the chosen official journey", {timeout:30_000}, async()=>{
 const browser=await chromium.launch({headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1200,height:900}});
 await page.route('https://www.passportindia.gov.in/**',route=>route.fulfill({contentType:'text/html',body:`<html><body><header><input type="search" placeholder="Search website"></header><main><h1>Passport Seva</h1><nav><div id="actions"><a href="https://services1.passportindia.gov.in/forms/PreLogin" target="_blank"><button>Login</button></a><a id="register" href="https://services1.passportindia.gov.in/forms/registration" target="_blank"><button>Register</button></a></div></nav></main></body></html>`}));
 await page.route('https://services1.passportindia.gov.in/**',route=>route.fulfill({contentType:'text/html',body:'<main><form><label for="name">Full name</label><input id="name" required></form></main>'}));
 await page.goto('https://www.passportindia.gov.in/psp');
 await page.evaluate(`globalThis.chrome={storage:{local:{get:async()=>({}),set:async()=>{}}},runtime:{sendMessage:async()=>({})}}`);
 for(const file of files) await page.addScriptTag({path:fileURLToPath(new URL(file,extension))});
 const home=page.locator('[data-passport-guide="home"]');
 assert.equal(await home.isVisible(),true);
 // The real home page opens a notice before users can reach navigation.
 await page.evaluate(()=>{const dialog=document.createElement('div');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.innerHTML='<button aria-label="Close" onclick="this.parentElement.remove()">×</button><div class="modal-body">Important website notice</div>';document.body.append(dialog);});
 await page.waitForFunction(()=>document.querySelector('[data-passport-guide="home"]')?.closest('[role=dialog]'));
 assert.equal(await home.locator('.notice').isVisible(),true);
 assert.equal(await home.locator('.new').isVisible(),false);
 await home.locator('.notice').click();
 await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
 await home.locator('.new').waitFor({state:'visible'});

 assert.equal(await page.locator('#register').evaluate(el=>el===document.activeElement),true);
 assert.equal(await page.locator('header [data-passport-guide],nav [data-passport-guide]').count(),0);
 assert.equal(await page.locator('[data-passport-guide="note"]').count(),0);
 assert.equal(await home.locator('.existing').getAttribute('href'),'https://services1.passportindia.gov.in/forms/PreLogin');
 assert.equal(await page.locator('[data-passport-guide="home-outline"]').locator('.ring').isVisible(),true);
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await Promise.all([page.waitForURL('**/forms/registration'),home.locator('.new').click()]);
 assert.equal(page.context().pages().length,1,'journey stays in the same tab');
 await page.evaluate(`globalThis.chrome={storage:{local:{get:async()=>({}),set:async()=>{}}},runtime:{sendMessage:async()=>({})}}`);
 for(const file of files) await page.addScriptTag({path:fileURLToPath(new URL(file,extension))});
 await page.waitForSelector('[data-passport-guide="note"]');
 assert.equal(await page.locator('[data-passport-guide="home"]').count(),0);
 assert.equal(await page.locator('#name').evaluate(el=>el===document.activeElement),true);
 } finally {await browser.close();}
});
test("home guide hides on request and never trusts foreign or lookalike action links", {timeout:30_000},async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage();
 await page.route('https://www.passportindia.gov.in/**',route=>route.fulfill({contentType:'text/html',body:'<main><a href="https://passportindia.gov.in.evil.test/register">Register</a><a href="https://evil.test/login">Login</a></main>'}));
 await page.goto('https://www.passportindia.gov.in/');
 for(const file of ['inline-theme.js','home-guide.js']) await page.addScriptTag({path:fileURLToPath(new URL(file,extension))});
 assert.equal(await page.locator('[data-passport-guide="home"]').count(),0);
 await page.evaluate(()=>{document.querySelector('main')!.innerHTML='<a id="real" href="https://services1.passportindia.gov.in/forms/PreLogin">Login</a>';});
 const home=page.locator('[data-passport-guide="home"]');await home.waitFor();
 await home.locator('.close').click();assert.equal(await home.count(),0);
 await page.evaluate(()=>document.querySelector('main')!.append(document.createElement('p')));
 await page.waitForTimeout(400);assert.equal(await home.count(),0);
 }finally{await browser.close();}
});
