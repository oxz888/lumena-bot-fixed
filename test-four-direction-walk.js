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
vm.runInContext(`${extractFunction('nextWalkDirection')}\nthis.next=nextWalkDirection;`, context);

let current = 'KeyS';
const seen = [];
for (let i = 0; i < 4; i++) {
  current = context.next(current);
  seen.push(current);
}
assert.deepStrictEqual(seen, ['KeyD', 'KeyW', 'KeyA', 'KeyS']);
assert.deepStrictEqual(new Set(seen), new Set(['KeyA', 'KeyD', 'KeyW', 'KeyS']));
const displacement = seen.reduce((p, direction) => {
  if (direction === 'KeyD') p.x++;
  if (direction === 'KeyA') p.x--;
  if (direction === 'KeyW') p.y++;
  if (direction === 'KeyS') p.y--;
  return p;
}, { x: 0, y: 0 });
assert.deepStrictEqual(displacement, { x: 0, y: 0 });
console.log('PASS: walking makes a right up left down loop back to start');
