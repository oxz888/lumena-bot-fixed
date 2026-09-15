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

const context = {
  CONFIG: { ALWAYS_CATCH_SHINY: true },
  EXCLUDED_SET: new Set(['sparkit', 'lotlume'])
};
vm.createContext(context);
vm.runInContext(`${extractFunction('shouldCaptureLumen')}\nthis.shouldCapture=shouldCaptureLumen;`, context);

assert.strictEqual(context.shouldCapture('Sparkit', false), false, 'listed normal Lumen must be skipped');
assert.strictEqual(context.shouldCapture(' Lotlume ', false), false, 'list matching must trim and ignore case');
assert.strictEqual(context.shouldCapture('UnknownRareLumen', false), true, 'unlisted normal Lumen must be captured');
assert.strictEqual(context.shouldCapture('Unknown Lumen', false), false, 'failed enemy-name detection must not waste a Lantern');
assert.strictEqual(context.shouldCapture('', false), false, 'empty enemy name must fail closed');
assert.strictEqual(context.shouldCapture('Sparkit', true), true, 'listed shiny Lumen must still be captured');
assert.strictEqual(context.shouldCapture('Lotlume', true), true, 'every shiny Lumen must override the excluded list');

const battleStart = source.indexOf('// 3. Pertarungan / Battle');
const battleEnd = source.indexOf('// 4. Cek Auto Pancing', battleStart);
const battleBlock = source.slice(battleStart, battleEnd);
assert.match(battleBlock, /evaluateGradeCapture\(enemy\.grades\)/, 'visible-grade evaluation must remain active in battle');
assert.match(battleBlock, /gradeDecision\.capture/, 'qualifying visible grades must remain an independent capture path');
console.log('PASS: capture list is inverted while shiny and visible-grade overrides remain active');
