/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const ts = require('typescript');

// Transpile chat-guardrails.ts to CommonJS for testing
const guardrailExports = {};
new Function(
  'exports',
  ts.transpileModule(fs.readFileSync('src/lib/chat-guardrails.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
)(guardrailExports);

const { computePollingInterval, trimMessageHistory, shouldFetchThreadMetadata } = guardrailExports;

test('computePollingInterval: returns null when tab is hidden (isVisible: false)', () => {
  assert.equal(
    computePollingInterval({ isOpen: true, hasActiveThread: true, isVisible: false, isIdle: false }),
    null
  );
  assert.equal(
    computePollingInterval({ isOpen: false, hasActiveThread: false, isVisible: false, isIdle: true }),
    null
  );
});

test('computePollingInterval: active chat thread uses 3500ms active and 10000ms idle backoff', () => {
  assert.equal(
    computePollingInterval({ isOpen: true, hasActiveThread: true, isVisible: true, isIdle: false }),
    3500
  );
  assert.equal(
    computePollingInterval({ isOpen: true, hasActiveThread: true, isVisible: true, isIdle: true }),
    10000
  );
});

test('computePollingInterval: conversation list uses 5000ms active and 15000ms idle backoff', () => {
  assert.equal(
    computePollingInterval({ isOpen: true, hasActiveThread: false, isVisible: true, isIdle: false }),
    5000
  );
  assert.equal(
    computePollingInterval({ isOpen: true, hasActiveThread: false, isVisible: true, isIdle: true }),
    15000
  );
});

test('computePollingInterval: closed chat popup uses 30000ms active and 60000ms idle backoff', () => {
  assert.equal(
    computePollingInterval({ isOpen: false, hasActiveThread: false, isVisible: true, isIdle: false }),
    30000
  );
  assert.equal(
    computePollingInterval({ isOpen: false, hasActiveThread: false, isVisible: true, isIdle: true }),
    60000
  );
});

test('trimMessageHistory: preserves messages within capacity bound', () => {
  const msgs = Array.from({ length: 50 }, (_, i) => ({ id: `msg-${i + 1}` }));
  const result = trimMessageHistory(msgs, 150);
  assert.equal(result.length, 50);
  assert.deepEqual(result, msgs);
});

test('trimMessageHistory: trims to maxCapacity retaining the latest messages in order', () => {
  const msgs = Array.from({ length: 200 }, (_, i) => ({ id: `msg-${i + 1}` }));
  const trimmed = trimMessageHistory(msgs, 150);
  assert.equal(trimmed.length, 150);
  assert.equal(trimmed[0].id, 'msg-51');
  assert.equal(trimmed[149].id, 'msg-200');
});

test('trimMessageHistory: handles empty or undefined gracefully', () => {
  assert.deepEqual(trimMessageHistory([]), []);
  assert.deepEqual(trimMessageHistory(null), []);
});

test('shouldFetchThreadMetadata: triggers on initial load and on new messages', () => {
  assert.equal(shouldFetchThreadMetadata(true, false, 0), true);
  assert.equal(shouldFetchThreadMetadata(false, true, 3), true);
  assert.equal(shouldFetchThreadMetadata(false, false, 3), false);
  assert.equal(shouldFetchThreadMetadata(false, false, 10), true);
  assert.equal(shouldFetchThreadMetadata(false, false, 20), true);
  assert.equal(shouldFetchThreadMetadata(false, false, 25), false);
});
