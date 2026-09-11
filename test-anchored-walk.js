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
vm.runInContext(`${extractFunction('getWalkPattern')}\nthis.pattern=getWalkPattern();`, context);
const position = { x: 0, y: 0 };
let maxAbsX = 0;
let maxAbsY = 0;
for (const direction of context.pattern) {
  if (direction === 'KeyD') position.x++;
  if (direction === 'KeyA') position.x--;
  if (direction === 'KeyW') position.y++;
  if (direction === 'KeyS') position.y--;
  maxAbsX = Math.max(maxAbsX, Math.abs(position.x));
  maxAbsY = Math.max(maxAbsY, Math.abs(position.y));
}
assert.deepStrictEqual(position, { x: 0, y: 0 }, 'one loop must return to the anchor');
assert(maxAbsX <= 2 && maxAbsY <= 1, 'loop must stay inside its small rectangular area');
console.log('PASS: rectangular loop stays near the anchor and returns to start');
