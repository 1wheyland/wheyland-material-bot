import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayWindow,shouldSchedule,today } from '../src/time';
test('Pacific scheduler handles both UTC offsets and excludes weekends and wrong hours',()=>{
 assert.equal(shouldSchedule(new Date('2026-09-14T12:45:00Z')),true);
 assert.equal(shouldSchedule(new Date('2026-12-14T13:45:00Z')),true);
 assert.equal(shouldSchedule(new Date('2026-09-14T13:45:00Z')),false);
 assert.equal(shouldSchedule(new Date('2026-12-14T12:45:00Z')),false);
 assert.equal(shouldSchedule(new Date('2026-09-12T12:45:00Z')),false);
 assert.equal(shouldSchedule(new Date('2026-09-14T12:55:00Z')),true);
 assert.equal(today(new Date('2026-09-15T01:00:00Z')),'2026-09-14');
});
test('local windows cover 23/25-hour DST days and events are at local 6',()=>{
 for(const [date,hours] of [['2026-03-08',23],['2026-11-01',25]] as const) {
  const w=dayWindow(date);assert.equal((Date.parse(w.before)-Date.parse(w.after))/3600000,hours);
  assert.match(w.eventStart,/T06:00:00/);
 }
 assert.throws(()=>dayWindow('2026-02-30'));assert.throws(()=>dayWindow('2026-9-1'));
});
