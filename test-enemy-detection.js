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
function el(text = '', children = {}) {
  return {
    textContent: text,
    innerText: text,
    querySelector: selector => children[selector] || null
  };
}
function detect({ enemyName, enemyShiny = false, allyName = 'Marebyte', allyShiny = true }) {
  const enemyNameEl = el(enemyName, enemyShiny ? { '.lumen-shiny-mark': el('✨') } : {});
  const enemyHud = el(enemyName, {
    '.battle-monster-hud__name-row strong': enemyNameEl,
    '.battle-monster-hud__name-row': enemyNameEl,
    ...(enemyShiny ? { '.lumen-shiny-mark': el('✨') } : {})
  });
  const battleUI = el(`${allyName}${allyShiny ? ' ✨ shiny' : ''} ${enemyName}`);
  const context = {
    CONFIG: { TARGET_LIST: ['Marebyte', 'Chronobra'] },
    document: {
      querySelector(selector) {
        if (selector === '.battle-monster-hud--enemy') return enemyHud;
        if (selector === '.lumen-shiny' || selector === '[class*="lumen-shiny"]') return allyShiny ? el('✨') : null;
        if (selector === '.battle-ui') return battleUI;
        return null;
      },
      querySelectorAll(selector) {
        if (selector === '.battle-ui, .battle-enemy, .battle-header, .battle-field') return [battleUI];
        return [];
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(`${extractFunction('detectEnemyLumen')}\nthis.detect=detectEnemyLumen;`, context);
  return context.detect();
}

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(detect({ enemyName: 'Wildmon' }))),
  { name: 'Wildmon', isShiny: false },
  'ally target/shiny must not make a normal enemy catchable'
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(detect({ enemyName: 'Chronobra', enemyShiny: false, allyShiny: false }))),
  { name: 'Chronobra', isShiny: false },
  'must read the enemy name from the enemy HUD'
);
assert.strictEqual(detect({ enemyName: 'Wildmon', enemyShiny: true, allyShiny: false }).isShiny, true);
console.log('PASS: capture classification is scoped to enemy HUD only');
