const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const source = fs.readFileSync(__dirname + '/lumena-bot-fixed.js', 'utf8');
const start = source.indexOf('const CONFIG =');
const end = source.indexOf('\n    };', start) + 7;
assert(start >= 0 && end > start, 'CONFIG block must exist');
const context = {};
vm.createContext(context);
vm.runInContext(source.slice(start, end).replace('const CONFIG', 'this.CONFIG'), context);

const expected = [
  'Transmole', 'Marebyte', 'Lotlume', 'Lithlet', 'Cairnling',
  'Glimfin', 'Cinderook', 'Combustler', 'Sparkit', 'Volterin',
  'Ditpuff', 'Mimicorp', 'Starcalf', 'Cosmox', 'Compasspook',
  'Astrowraith', 'Nullimp', 'Voidling', 'Murkub', 'Cindergill',
  'Capsylex', 'Corekit', 'Lunaveil', 'Chronobra', 'Etherion',
  'Solshade', 'Bitauro', 'Mythrex', 'Originu', 'Lunimp', 'Vowraith'
];
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.CONFIG.TARGET_LIST)), expected);
assert.strictEqual(context.CONFIG.ALWAYS_CATCH_SHINY, true, 'all shiny Lumens must remain priority capture targets');
assert.strictEqual(context.CONFIG.WALK_HOLD_MS, 75, 'movement duration must be exactly 75ms');
assert.strictEqual(context.CONFIG.WALK_STEP_DELAY_MS, 750, 'movement interval must be exactly 750ms');
console.log('PASS: target list, shiny priority, and movement timing are exact');
