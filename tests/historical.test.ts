import assert from 'node:assert/strict';
import test from 'node:test';
import {historicalWindows} from '../src/github.ts';
import {normalizeDaysBetween, monthlyContributionCounts} from '../src/metrics.ts';
import {renderSvg} from '../src/render.ts';

const profile={publicRepos:45,createdAt:'2020-04-01T00:00:00Z',location:'Campina Grande, Brazil'};
test('all-time API windows cover leap years without overlap',()=>{
  const periods=historicalWindows('2020-04-01','2026-11-18');
  assert.equal(periods.at(0)?.from,'2020-04-01');
  assert.equal(periods.at(-1)?.to,'2026-11-18');
  for(let i=1;i<periods.length;i++){
    const next=new Date(`${periods[i-1].to}T00:00:00Z`).getTime()+86_400_000;
    assert.equal(periods[i].from,new Date(next).toISOString().slice(0,10));
  }
});
test('all-time normalizer fills missing days including leap day',()=>{
  const days=normalizeDaysBetween([{date:'2024-02-29',contributionCount:7}],'2024-02-28','2024-03-01');
  assert.deepEqual(days.map(d=>d.contributionCount),[0,7,0]);
});
test('monthly totals follow history, not latest 365 days',()=>{
  const days=normalizeDaysBetween([{date:'2020-04-02',contributionCount:2},{date:'2026-11-17',contributionCount:3}],'2020-04-01','2026-11-18');
  const months=monthlyContributionCounts(days);
  assert.equal(months.get('2020-04'),2);
  assert.equal(months.get('2026-11'),3);
  const svg=renderSvg(days,{variant:'desktop',username:'ThiagoAciole',profile});
  assert.match(svg,/5 lifetime contributions/);
  assert.match(svg,/2020-04: 2 contributions/);
  assert.match(svg,/2026-11: 3 contributions/);
  assert.doesNotMatch(svg,/16 calendar weeks/);
  assert.doesNotMatch(svg,/Aciole Contributions/);
  assert.doesNotMatch(svg,/Campina Grande/);
});
test('mobile layout keeps months and all-year labels',()=>{
  const days=normalizeDaysBetween([], '2020-04-01','2026-11-18');
  const svg=renderSvg(days,{variant:'mobile',username:'ThiagoAciole',profile});
  assert.match(svg,/viewBox="0 0 420/);
  assert.match(svg,/>2020</);
  assert.match(svg,/>2026</);
});
