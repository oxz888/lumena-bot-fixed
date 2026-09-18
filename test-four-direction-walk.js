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
  throw new Error(`unterminated function ${name}`);
}

const context = {};
vm.createContext(context);
vm.runInContext(`${extractFunction('getWalkRunPlan')}\nthis.plan=getWalkRunPlan(450);`, context);
const plan = JSON.parse(JSON.stringify(context.plan));
assert.deepStrictEqual(plan, [
  { direction: 'KeyS', holdMs: 450 },
  { direction: 'KeyW', holdMs: 450 }
]);
assert.ok(plan.every(phase => phase.holdMs === 450), 'down and up must run for exactly 450 ms');
console.log('PASS: vertical run uses down then up for exactly 450 ms each');
