import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const manifest=JSON.parse(read('miniapp-v2/production/release.json'));
const home=read('home.html');
const certified=read('miniapp-v2/production/index.html');
const loader=read('miniapp-v2/production/production-shell-loader.js');
const board=read('miniapp-v2/production/boon-home-v613-board.js');
const guard=read('miniapp-v2/production/release-guard.js');

test('the saved admission rounds and verified shared forecast cannot be replaced with older versions',()=>{
 const session=board.match(/const PUBLIC_GROUPS=Object\.freeze\(\[([\s\S]*?)\]\);/);
 assert.ok(session);
 for(const row of [
  "{title:'10:00の回',web:'0030',line:'0029'}",
  "{title:'12:30の回',web:'0032',line:'0031'}",
  "{title:'15:00の回',web:'0034',line:'0033'}"
 ])assert.ok(session[1].includes(row),row);
 assert.ok(board.includes('const web=publicCount(a?.slot),line=publicCount(b?.slot)'));
 assert.ok(board.includes('320-web-line'));
 assert.ok(board.includes('web===null||line===null'));
 assert.ok(board.includes('slots.classList.add(\'v615-public-ready\')'));
 assert.doesNotMatch(board,/12:30／12:50/);
});

test('both official entrypoints use the same current chocolate-mint HOME, never a classic rollback',()=>{
 const required=[
  'boon-mint-v51-preview.js',
  'boon-home-v56-layout.js',
  'boon-home-v613-board.js'
 ];
 for(const asset of required){
  assert.ok(loader.includes(asset+'?v='),'browser HOME: '+asset);
  assert.ok(certified.includes(asset+'?v='),'certified LINE HOME: '+asset);
 }
 for(const text of [loader,certified,board,read('miniapp-v2/build-production.mjs')]){
  assert.doesNotMatch(text,/get\('boonTheme'\)/);
 }
 assert.ok(home.includes('production-shell-loader.js?v='));
 assert.ok(read('index.html').includes('"./home.html"'));
 assert.doesNotMatch(certified,/location\.replace\(/);
});

test('release manifest, published HTML and generated cache keys refer to a single release',()=>{
 assert.equal(manifest.schemaVersion,1);
 assert.match(manifest.releaseId,/^[a-f0-9]{12}$/);
 const url='release-guard.js?id='+manifest.releaseId;
 assert.ok(home.includes(url));
 assert.ok(certified.includes(url));
 assert.ok(home.indexOf('asoquest-deeplink.js')<home.indexOf(url));
 assert.ok(home.indexOf(url)<home.indexOf('production-shell-loader.js'));
 const sha=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
 assert.equal(manifest.shellAsset,sha(loader));
 assert.equal(manifest.homeAsset,sha(read('miniapp-v2/production/production-app.js')));
 assert.equal(manifest.boardAsset,sha(board.trim()));
 assert.ok(home.includes('production-shell-loader.js?v='+manifest.shellAsset));
 assert.ok(home.includes('production-app.js?v='+manifest.homeAsset));
 assert.ok(certified.includes('production-app.js?v='+manifest.homeAsset));
 for(const resource of ['language-switch-ux-v1.js','i18n-ko-kmr-completion-v2.js','choco-mint-rich-v12.css']){
  const hash=sha(read('miniapp-v2/production/'+resource).trim());
  assert.ok(home.includes(resource+'?v='+hash),'root cache key: '+resource);
  assert.ok(certified.includes(resource+'?v='+hash),'LINE cache key: '+resource);
 }
});

async function simulate({current='aaaaaaaaaaaa',latest='bbbbbbbbbbbb',query='?view=callstatus&foo=1',handoff=false,offline=false}={}){
 const redirects=[],requests=[];
 const location={href:'https://asoboon.github.io/asoboon-stamp/home.html'+query,
  replace(url){redirects.push(url)}};
 const document={currentScript:{src:'https://asoboon.github.io/asoboon-stamp/miniapp-v2/production/release-guard.js?id='+current}};
 const window={ASOBOON_ASOQUEST_HANDOFF:handoff};
 const fetch=(url,options)=>{
  requests.push({url,options});
  return offline?Promise.reject(Error('offline')):Promise.resolve({ok:true,json:()=>Promise.resolve({releaseId:latest})});
 };
 runInNewContext(guard,{window,document,location,fetch,URL,Date});
 await new Promise(resolve=>setImmediate(resolve));
 return {redirects,requests};
}
test('an outdated cached entry reloads once with an immutable release key, keeping LIFF/route parameters',async()=>{
 const changed=await simulate();
 assert.equal(changed.requests.length,1);
 assert.equal(changed.requests[0].options.cache,'no-store');
 assert.equal(changed.redirects.length,1);
 const next=new URL(changed.redirects[0]);
 assert.equal(next.searchParams.get('_asoboon_release'),'bbbbbbbbbbbb');
 assert.equal(next.searchParams.get('view'),'callstatus');
 assert.equal(next.searchParams.get('foo'),'1');
 assert.equal((await simulate({current:'bbbbbbbbbbbb'})).redirects.length,0);
 assert.equal((await simulate({query:'?_asoboon_release=bbbbbbbbbbbb'})).redirects.length,0);
 assert.equal((await simulate({offline:true})).redirects.length,0);
 assert.equal((await simulate({handoff:true})).requests.length,0);
 for(const prohibited of ['createReservation','cancelReservation','sendServiceMessage'])assert.ok(!guard.includes(prohibited));
});
