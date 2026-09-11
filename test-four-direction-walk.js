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
vm.runInContext(`${extractFunction('getWalkRunPlan')}\nthis.plan=getWalkRunPlan(75);`, context);
const plan = JSON.parse(JSON.stringify(context.plan));
assert.deepStrictEqual(plan, [
  { direction: 'KeyD', holdMs: 675 },
  { direction: 'KeyA', holdMs: 675 }
]);
assert.strictEqual(plan[0].holdMs, plan[1].holdMs, 'return run must match outbound run');
console.log('PASS: horizontal run is 3x longer and balances back to start');
