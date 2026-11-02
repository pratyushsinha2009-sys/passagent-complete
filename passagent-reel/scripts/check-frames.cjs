const path=require('node:path');
const fs=require('node:fs/promises');
const {bundle}=require('@remotion/bundler');
const {openBrowser,selectComposition,renderStill}=require('@remotion/renderer');
(async()=>{
 await fs.mkdir('qa',{recursive:true});
 const serveUrl=await bundle({entryPoint:path.resolve('src/index.ts'),outDir:path.resolve('qa/bundle'),rspack:true});
 const browser=await openBrowser('chrome',{browserExecutable:'C:/Users/Asus-PC/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe',chromeMode:'headless-shell',logLevel:'error'});
 try{
  const composition=await selectComposition({serveUrl,id:'PassAgent-Reel',puppeteerInstance:browser,logLevel:'error'});
  for(const [label,frame] of [['opening',0],['before-cut',89],['after-cut',90],['focus',480],['choices',650],['finale',1030]]){
   await renderStill({serveUrl,composition,puppeteerInstance:browser,frame,output:path.resolve(`qa/${label}.png`),imageFormat:'png',scale:.5,logLevel:'error'});
   console.log(`Checked ${label} at frame ${frame}`);
  }
  console.log('Composition:',composition.width,composition.height,composition.durationInFrames/composition.fps,'seconds');
 }finally{await browser.close({silent:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
