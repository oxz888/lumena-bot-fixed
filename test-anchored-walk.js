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
vm.runInContext(`${extractFunction('nextWalkDirection')}\nthis.next=nextWalkDirection;`, context);
let direction = 'KeyS';
const position = { x: 0, y: 0 };
let maxAbsX = 0;
let maxAbsY = 0;
for (let i = 0; i < 4; i++) {
  direction = context.next(direction);
  if (direction === 'KeyD') position.x++;
  if (direction === 'KeyA') position.x--;
  if (direction === 'KeyW') position.y++;
  if (direction === 'KeyS') position.y--;
  maxAbsX = Math.max(maxAbsX, Math.abs(position.x));
  maxAbsY = Math.max(maxAbsY, Math.abs(position.y));
}
assert.deepStrictEqual(position, { x: 0, y: 0 }, 'one loop must return to the anchor');
assert(maxAbsX <= 1 && maxAbsY <= 1, 'loop must stay within one movement unit of the anchor');
console.log('PASS: square loop stays near the anchor and returns to start');
