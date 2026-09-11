const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const source = fs.readFileSync(__dirname + '/lumena-bot-fixed.js', 'utf8');
function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notStrictEqual(start, -1, `function ${name} must exist`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
}
const context = {};
vm.createContext(context);
vm.runInContext(`${extractFunction('getWalkRunPlan')}\nthis.plan=getWalkRunPlan(75);`, context);
const plan = JSON.parse(JSON.stringify(context.plan));
let horizontalDuration = 0;
let verticalDuration = 0;
for (const phase of plan) {
  if (phase.direction === 'KeyD') horizontalDuration += phase.holdMs;
  if (phase.direction === 'KeyA') horizontalDuration -= phase.holdMs;
  if (phase.direction === 'KeyW') verticalDuration += phase.holdMs;
  if (phase.direction === 'KeyS') verticalDuration -= phase.holdMs;
}
assert.strictEqual(horizontalDuration, 0, 'right and left hold durations must balance');
assert.strictEqual(verticalDuration, 0, 'run must have no vertical movement');
assert.strictEqual(plan.length, 2, 'the return run must start immediately after the outbound run');
console.log('PASS: continuous horizontal run balances back to the anchor');
