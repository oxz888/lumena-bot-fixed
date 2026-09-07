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
vm.runInContext(`${extractFunction('getWalkExcursion')}\nthis.get=getWalkExcursion;`, context);
const expected = {
  KeyD: ['KeyD', 'KeyA'],
  KeyA: ['KeyA', 'KeyD'],
  KeyW: ['KeyW', 'KeyS'],
  KeyS: ['KeyS', 'KeyW']
};
for (const [direction, pair] of Object.entries(expected)) {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.get(direction))), pair);
}
console.log('PASS: every four-direction step immediately returns toward the anchor');
