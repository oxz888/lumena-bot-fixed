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
assert.deepStrictEqual(seen, ['KeyD', 'KeyD', 'KeyW', 'KeyA', 'KeyA', 'KeyS']);

const displacement = seen.reduce((position, direction) => {
  if (direction === 'KeyD') position.x++;
  if (direction === 'KeyA') position.x--;
  if (direction === 'KeyW') position.y++;
  if (direction === 'KeyS') position.y--;
  return position;
}, { x: 0, y: 0 });
assert.deepStrictEqual(displacement, { x: 0, y: 0 });
console.log('PASS: walking makes a 2-right up 2-left down loop back to start');
