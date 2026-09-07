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

const gradeContext = {};
vm.createContext(gradeContext);
vm.runInContext(`${extractFunction('evaluateGradeCapture')}\nthis.evaluate=evaluateGradeCapture;`, gradeContext);
const evaluate = grades => JSON.parse(JSON.stringify(gradeContext.evaluate(grades)));
assert.strictEqual(evaluate(['S','S','C','D','E','B']).capture, true, 'two S grades must trigger capture');
assert.strictEqual(evaluate(['A','A','A','D','E','B']).capture, true, 'three A grades must trigger capture');
assert.strictEqual(evaluate(['B','B','B','B','B','B']).capture, true, 'all B grades must trigger capture');
assert.strictEqual(evaluate(['A','A','B','B','C','D']).capture, false, 'two A grades are not enough');
assert.strictEqual(evaluate(['S','A','B','C','D','E']).capture, false, 'one S and one A are not enough');
assert.strictEqual(evaluate([]).capture, false, 'hidden grades must not trigger capture');

function item(name, disabled = false) { return { textContent: name, disabled }; }
const nova = item('Nova Lantern');
const ember = item('Ember Lantern');
const wisp = item('Wisp Lantern');
const lanternContext = {
  document: {
    querySelectorAll(selector) {
      if (selector === '.battle-item-overlay__item:not([disabled])') return [nova, ember, wisp];
      return [];
    },
    querySelector() { return null; }
  }
};
vm.createContext(lanternContext);
vm.runInContext(`${extractFunction('findPreferredLantern')}\nthis.find=findPreferredLantern;`, lanternContext);
assert.strictEqual(lanternContext.find(), wisp, 'Wisp must be preferred regardless of DOM order');
console.log('PASS: grade rules are exact and Wisp Lantern has priority');
