import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalTimeline,percentile} from '../experiments/reception-v3/local-metrics.mjs';

test('separates first visual paint from reception controls and submit readiness',()=>{
  let now=0;
  const timer=createLocalTimeline({clock:()=>now});
  const step=(name,at)=>{now=at;timer.mark(name)};
  step('navigationStart',0);
  step('homeVisible',700);
  step('receptionTapped',800);
  step('receptionShellVisible',1000);
  step('businessDayVerified',1400);
  step('waitTypesVerified',1800);
  step('lineVerified',3500);
  step('submitReady',3900);
  assert.deepEqual(timer.report(),{durations:{
    homeVisible:700,receptionShell:200,businessDay:600,
    slots:1000,line:3500,submit:3100,
  }});
});

test('only fixed safe metric names allowed, no arbitrary personal information',()=>{
  const timeline=createLocalTimeline({clock:()=>123});
  assert.throws(()=>timeline.mark('LINE_USER_ID=secret'),/UNKNOWN_PUBLIC_TIMING_MARK/);
  assert.throws(()=>timeline.mark('liffAccessToken'),/UNKNOWN_PUBLIC_TIMING_MARK/);
  timeline.mark('homeVisible');
  assert.equal(JSON.stringify(timeline.report()).includes('123'),false,'no absolute timings or PII');
  assert.deepEqual(timeline.report(),{durations:{}});
});

test('summary percentiles are deterministic and ignore malformed readings',()=>{
  assert.equal(percentile([10,20,40,100],75),40);
  assert.equal(percentile([10,20,40,100],95),100);
  assert.equal(percentile([-1,NaN,300,100],50),100);
  assert.equal(percentile([],95),null);
});
