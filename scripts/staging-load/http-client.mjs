import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
// The test only encodes Server Action arguments. It never loads/render UI chunks.
globalThis.__webpack_require__=Object.assign(()=>{throw new Error('UI chunks are not used by this HTTP test');},{u:()=>''});
const {encodeReply}=require('next/dist/compiled/react-server-dom-webpack/cjs/react-server-dom-webpack-client.browser.production.js');
export const base='https://168.144.155.51:8443';
export function actionValue(text){
 const records=new Map();for(const line of text.split('\n')){const m=line.match(/^([a-f0-9]+):(.*)$/);if(m)records.set(m[1],m[2]);}
 const root=JSON.parse(records.get('0')||'null');
 if(!root||!('a' in root))throw new Error('Missing action result');
 if(typeof root.a==='string'&&root.a.startsWith('$@')){
  const value=records.get(root.a.slice(2));if(value?.startsWith('E'))throw new Error('Server Action exception');return JSON.parse(value||'null');
 }
 return root.a;
}
export async function request(actor,path,{args,action,signal}={}){
 const begin=performance.now();const headers={Origin:base};if(actor.cookie)headers.Cookie=actor.cookie;
 const options={headers,redirect:'manual',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)};
 if(action){headers['Next-Action']=action;headers.Accept='text/x-component';options.method='POST';options.body=await encodeReply(args);}
 const response=await fetch(base+path,options);
 const body=await response.text();
 const cookie=response.headers.getSetCookie().find(v=>v.startsWith('__Host-tasktracker_staging='));if(cookie)actor.cookie=cookie.split(';')[0];
 return {status:response.status,ms:performance.now()-begin,body,redirect:response.headers.get('x-action-redirect'),location:response.headers.get('location')};
}
