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
vm.runInContext(`${extractFunction('getWalkRunPlan')}\nthis.plan=getWalkRunPlan(450);`, context);
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
assert.strictEqual(verticalDuration, 0, 'up and down hold durations must balance');
assert.strictEqual(plan.length, 4, 'the route must contain all four sides of the square');
assert.deepStrictEqual(plan.map(phase => phase.direction), ['KeyD', 'KeyW', 'KeyA', 'KeyS']);
console.log('PASS: square run balances back to the starting anchor');
