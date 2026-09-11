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
vm.runInContext(`${extractFunction('getWalkPattern')}\nthis.pattern=getWalkPattern();`, context);
const seen = JSON.parse(JSON.stringify(context.pattern));
assert.deepStrictEqual(seen, ['KeyD', 'KeyD', 'KeyD', 'KeyA', 'KeyA', 'KeyA']);
assert(!seen.includes('KeyW') && !seen.includes('KeyS'), 'movement must remain horizontal');

const displacement = seen.reduce((x, direction) =>
  x + (direction === 'KeyD' ? 1 : direction === 'KeyA' ? -1 : 0), 0);
assert.strictEqual(displacement, 0, 'three right and three left steps must return to start');
console.log('PASS: walking runs 3 steps right then 3 steps left');
