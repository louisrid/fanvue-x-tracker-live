import test from 'node:test';
import assert from 'node:assert/strict';
import {CLICK_COUNT_START_AT,isCurrentClick} from '../netlify/lib/click-baseline.mjs';

test('reporting excludes every event before the approved reset time',()=>{
  assert.equal(CLICK_COUNT_START_AT,'2026-10-17T00:32:36.000Z');
  for(const timestamp of ['2026-10-15T16:39:36.921Z','2026-10-16T23:45:16.206Z','2026-10-17T00:03:07.536Z', '2026-10-17T00:32:35.999Z']) {
    assert.equal(isCurrentClick({timestamp}),false,timestamp);
  }
});

test('new events at or after the reset time are countable',()=>{
  assert.equal(isCurrentClick({timestamp:'2026-10-17T00:32:36.000Z'}),true);
  assert.equal(isCurrentClick({timestamp:'2026-10-17T00:32:36.001Z'}),true);
  assert.equal(isCurrentClick({timestamp:'2026-10-18T00:00:00.000Z'}),true);
  assert.equal(isCurrentClick({timestamp:'invalid'}),false);
  assert.equal(isCurrentClick(null),false);
});
