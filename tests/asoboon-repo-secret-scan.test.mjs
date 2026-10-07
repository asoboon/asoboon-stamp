import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const tracked=execFileSync('git',['ls-files','-z'],{cwd:root}).toString('utf8').split('\0').filter(Boolean);
const textExt=/\.(?:html?|js|mjs|cjs|json|jsonc|md|txt|css|csv|yml|yaml|gs)$/i;
const allowedServerFiles=new Set([
  'miniapp-v2/backend/production-gateway.js',
  'miniapp-v2/backend/production-worker.mjs',
  'miniapp-v2/backend/production-service-message.js',
  'miniapp-v2/backend/develop-worker.mjs',
  'miniapp-v2/backend/develop-service-message.js',
]);

function read(file){return fs.readFileSync(path.join(root,file),'utf8')}

const literalRules=[
  ['API_KEY literal',/\bAPI_KEY\s*=\s*["'][A-Za-z0-9_-]{20,}["']/],
  ['airwaitApiKey literal',/airwaitApiKey\s*:\s*["'][^"']{20,}["']/i],
  ['generic AirWAIT key literal',/\bkey\s*:\s*["'][A-Za-z0-9_-]{20,}["']/],
  ['data-airwait key literal',/data-airwait[^\n]{0,300}key:[A-Za-z0-9_-]{20,}/i],
];

test('tracked public/source files contain no hard-coded AirWAIT credential literal',()=>{
  const violations=[];
  for(const file of tracked){
    if(!textExt.test(file))continue;
    let s='';try{s=read(file)}catch{continue}
    for(const [name,re] of literalRules)if(re.test(s))violations.push(`${file}: ${name}`);
  }
  assert.deepEqual(violations,[]);
});

test('production customer-facing browser tree never contains AirWAIT credential headers',()=>{
  const customerFiles=[
    'home.html','home-core.html','callstatus.html','callstatus-core.html',
    ...tracked.filter(f=>f.startsWith('miniapp-v2/production/')&&textExt.test(f)),
    ...tracked.filter(f=>f.startsWith('miniapp-v2/shared/')&&textExt.test(f)),
  ];
  const violations=[];
  for(const file of [...new Set(customerFiles)]){
    let text='';try{text=read(file)}catch{continue}
    if(/corWclpKeyCd|airwaitApiKey\s*:\s*["'][^"']+["']|\bAPI_KEY\s*=/.test(text))violations.push(file);
  }
  assert.deepEqual(violations,[]);
});

test('current customer callstatus uses Production read proxy and no direct AirWAIT endpoint',()=>{
  const s=read('callstatus-core.html');
  assert.match(s,/asoboon-miniapp-v2-production-gateway\.asoboon425\.workers\.dev/);
  assert.match(s,/legacyReservations/);
  assert.doesNotMatch(s,/cl\.airwait\.jp|airwait\.jp\/WCSP\/api|API_KEY|corWclpKeyCd/);
});
