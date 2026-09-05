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

function node({ text = '', disabled = false, classes = [] } = {}) {
  return {
    disabled,
    textContent: text,
    innerText: text,
    classList: { contains: c => classes.includes(c) },
    clicks: 0,
    click() { this.clicks++; }
  };
}

const fainted = node({ classes: ['hud-menu__lumen-row--fainted'] });
const healthy = node();
const confirm = node({ text: 'Swap Lumens' });
let selected = false;
healthy.click = () => { healthy.clicks++; selected = true; };

const team = {
  querySelector(selector) {
    if (selector === '.battle-team__title') return node({ text: 'Choose your next Lumen!' });
    return null;
  },
  querySelectorAll(selector) {
    if (selector === '.hud-menu__lumen-row') return [fainted, healthy];
    if (selector === '.battle-team__action') return selected ? [node({ text: 'Check summary' }), confirm] : [];
    return [];
  }
};

const context = { document: { querySelector: s => s === '.battle-team--forced' ? team : null } };
vm.createContext(context);
vm.runInContext(`${extractFunction('performForcedLumenSwitchStep')}\nthis.step=performForcedLumenSwitchStep;`, context);

assert.strictEqual(context.step(), 'selected', 'first step selects first healthy reserve');
assert.strictEqual(healthy.clicks, 1);
assert.strictEqual(fainted.clicks, 0, 'must never select a fainted Lumen');
assert.strictEqual(context.step(), 'confirmed', 'second step confirms Swap Lumens');
assert.strictEqual(confirm.clicks, 1);
console.log('PASS: forced switch selects a living reserve and confirms it');
