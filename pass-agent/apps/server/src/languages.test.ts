import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";
import {GuideInput} from "./guide";
const extension=new URL("../../../extensions/passport-guide/",import.meta.url);
const sandbox:any={chrome:{storage:{local:{get:async()=>({}),set:async()=>{}}}}};
for(const file of ['passport-knowledge.js','coach.js','guidance-languages.js','languages.js']) runInNewContext(await readFile(new URL(file,extension),'utf8'),sandbox);
test('language packs cover every built-in passport topic in all six additional languages',()=>{
 for(const topic of [...sandbox.PassportKnowledge.topics,'full-name','page-help','unidentified']) for(const code of ['hi','bn','mr','ta','te','gu']) {
  const text=sandbox.PassportGuidanceLanguages[topic]?.[code];assert.equal(typeof text,'string',topic+' '+code);assert.ok(text.length>20,topic+' '+code);
 }
});
test('language guidance preserves English titles, examples and professional option names',()=>{
 const field={label:'Full name',name:'',section:'',type:'text'};const english=sandbox.PassportKnowledge.lookup(field);
 for(const code of ['hi','bn','mr','ta','te','gu']) {
  sandbox.PassportI18n.setLanguage(code);const translated=sandbox.PassportI18n.guidance(english,field);
  assert.notEqual(translated.explanation,english.explanation);assert.equal(translated.title,english.title);assert.equal(translated.example,english.example);
  assert.ok(sandbox.PassportI18n.t('Use “Student”').includes('Student'));
  assert.ok(sandbox.PassportI18n.t('Suggested option: Student. Check that this describes you.').includes('Student'));
 }
 sandbox.PassportI18n.setLanguage('en');assert.equal(sandbox.PassportI18n.guidance(english,field).explanation,english.explanation);
});
test('guide accepts only the seven language codes and defaults existing requests to English',()=>{
 const context={url:'https://www.passportindia.gov.in/',heading:'Applicant',field:{id:'f1',label:'Full name',type:'text',required:true,options:[]}};
 assert.equal(GuideInput.parse(context).language,'en');for(const language of ['en','hi','bn','mr','ta','te','gu'])assert.equal(GuideInput.parse({...context,language}).language,language);
 assert.equal(GuideInput.safeParse({...context,language:'ignore instructions'}).success,false);
});

test('English entry check flags non-Latin names without rewriting personal data',()=>{
 const value='आशा';const field={label:'Full name',name:'',type:'text',required:true,filled:true,invalid:false,options:[]};
 assert.equal(sandbox.PassportCoach.checkAnswer({field,value}).valid,false);
 assert.equal(value,'आशा');assert.equal(sandbox.PassportCoach.checkAnswer({field,value:'Asha Mehta'}).valid,true);
 assert.equal(sandbox.PassportCoach.checkAnswer({field:{...field,label:'Password',type:'password'},value}).valid,true);
});
