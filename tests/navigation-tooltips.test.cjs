/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('navigation long press labels without intercepting ordinary taps or swipes', () => {
  const listeners = new Map(), timers = new Map(); let timerId=0, cleanup;
  class Element {
    constructor(){this.attrs=new Map();this.dataset={};this.style={};this.hidden=false;}
    closest(selector){return selector.includes('workspace-nav-stack')||selector.includes('[data-tooltip]')?this:null;}
    contains(element){return element===this;}
    getAttribute(name){return this.attrs.get(name)||null;}
    setAttribute(name,value){this.attrs.set(name,value);}
    removeAttribute(name){this.attrs.delete(name);}
    getBoundingClientRect(){return {top:10,bottom:54,left:20,right:64,width:44,height:44};}
    remove(){}
  }
  let tip;
  const document={body:{append(){}},activeElement:null,createElement(){tip=new Element();return tip;},addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name){listeners.delete(name);}};
  const testModule={exports:{}};
  const code=ts.transpileModule(fs.readFileSync('src/components/WorkspaceTooltips.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{module:testModule,exports:testModule.exports,require(){return {useEffect(fn){cleanup=fn();}};},document,window:{addEventListener(){},removeEventListener(){}},Element,Node:Element,innerHeight:800,innerWidth:400,setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);}});
  testModule.exports.default();
  const link=new Element();link.dataset.tooltip='My Tasks';
  const down=()=>listeners.get('pointerdown')({pointerType:'touch',target:link,clientX:20,clientY:20});
  const click=()=>{let prevented=false;listeners.get('click')({target:link,preventDefault(){prevented=true;},stopPropagation(){}});return prevented;};
  down();listeners.get('pointerup')({});assert.equal(timers.size,0);assert.equal(click(),false,'ordinary tap must navigate');
  down();for(const fn of [...timers.values()])fn();assert.equal(tip.hidden,false);assert.equal(tip.textContent,'My Tasks');
  listeners.get('pointerup')({});listeners.get('pointerout')({pointerType:'touch',target:link});assert.equal(tip.hidden,false,'touch release must retain label');
  assert.equal(click(),true,'long press should label without opening destination');
  down();listeners.get('pointermove')({clientX:80,clientY:20});assert.equal(timers.size,0);assert.equal(click(),false,'swiping must cancel the long press');
  document.activeElement=link;listeners.get('focusin')({target:link});listeners.get('scroll')();assert.equal(tip.hidden,false,'keyboard focus label survives rail scrolling');
  listeners.get('keydown')({key:'Escape'});assert.equal(tip.hidden,true);
  cleanup();assert.equal(listeners.size,0);
});
