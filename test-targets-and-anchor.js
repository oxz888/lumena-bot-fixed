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
  'Pyrapup', 'Flamynx', 'Pyrolynx', 'Spriglet', 'Leafawn', 'Floradeer',
  'Tideot', 'Surfinn', 'Aqualisk', 'Nibbug', 'Cocoonib', 'Papilume',
  'Peckit', 'Talonote', 'Harrowl', 'Scratbit', 'Raccoil', 'Tadpool',
  'Croaklet', 'Tempoad', 'Wicklet', 'Candlume', 'Blazewick', 'Orcaflux',
  'Levisurge', 'Vaultle', 'Turvault', 'Bastortoise', 'Coinu', 'Aurinu',
  'Menhiron', 'Prispine', 'Luminray', 'Rootlet', 'Bloomkin', 'Voltike',
  'Dojohrm', 'Shellix', 'Crystail', 'Pebloon', 'Graviboon', 'Gravolith',
  'Driftle', 'Cloudruff', 'Nimbushear', 'Nibfox', 'Nyflare', 'Sonarfox',
  'Lumorb', 'Glorial', 'Kelpuff', 'Kelploom', 'Quibblet', 'Quibshade',
  'Aurapod', 'Auracarap', 'Flintot', 'Bristleflint', 'Cindercrag', 'Minnote',
  'Choraleel', 'Sirenote', 'Bytebat', 'Noctobyte', 'Orebit', 'Geodorm',
  'Mantyrite', 'Skorinch', 'Scorivault', 'Mandrillip', 'Bramblejin',
  'Venomandrake', 'Spritzle', 'Mistelle', 'Pufflit', 'Aukrora', 'Slugmaw',
  'Miremaw', 'Pebbun', 'Quarryhare', 'Lotlume', 'Axolight', 'Thornyte',
  'Hedgeryl', 'Scrappling', 'Lockjawler', 'Vapool', 'Vapormane', 'Tinpin',
  'Steelark', 'Pixseed', 'Charmbloom', 'Cinduck', 'Ashquack', 'Skyrill',
  'Jetstream', 'Sparririt', 'Vowdojo', 'Snoflit', 'Frostelle', 'Glyphlet',
  'Sigilisk', 'Sporelet', 'Mycogrin', 'Blazekhan', 'Loomling', 'Webloom',
  'Dunebug', 'Kilnscarab', 'Coralit', 'Reefcrest', 'Sandip', 'Dunedillo',
  'Glacub', 'Frostursa', 'Sparkit', 'Dynarook', 'Hauntbud', 'Mournebloom',
  'Indexowl', 'Voidrake', 'Ashplume', 'Nivemite', 'cindervox', 'Flarecrest',
  'Chrysnow'
];
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.CONFIG.EXCLUDED_LIST)), expected);
assert.strictEqual(expected.length, 126, 'excluded list must contain exactly 126 Lumens');
assert.strictEqual(context.CONFIG.TARGET_LIST, undefined, 'legacy positive target list must not remain active');
assert.strictEqual(context.CONFIG.ALWAYS_CATCH_SHINY, true, 'all shiny Lumens must remain priority capture targets');
assert.strictEqual(context.CONFIG.WALK_HOLD_MS, 75, 'movement duration must be exactly 75ms');
assert.strictEqual(context.CONFIG.WALK_RUN_HOLD_MS, 450, 'square route must last exactly 450ms per direction');
assert.strictEqual(context.CONFIG.WALK_STEP_DELAY_MS, 750, 'movement interval must be exactly 750ms');
console.log('PASS: excluded list, shiny priority, and movement timing are exact');
