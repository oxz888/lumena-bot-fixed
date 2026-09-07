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
  'Marebyte', 'Lotlume', 'Lithlet', 'Cairnling', 'Glimfin',
  'Cinderook', 'Combustler', 'Sparkit', 'Volterin', 'Ditpuff',
  'Mimicorp', 'Starcalf', 'Cosmox', 'Compasspook', 'Astrowraith',
  'Nullimp', 'Voidling', 'Murkub', 'Cindergill', 'Capsylex',
  'Corekit', 'Lunaveil', 'Chronobra', 'Etherion', 'Solshade', 'Bitauro'
];
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.CONFIG.TARGET_LIST)), expected);
assert(context.CONFIG.WALK_HOLD_MS <= 35, 'anchor movement pulse must be tiny to limit drift');
assert(context.CONFIG.WALK_STEP_DELAY_MS >= 900, 'anchor movement must not fire too frequently');
console.log('PASS: target list is exact and anchored movement is tightly bounded');
