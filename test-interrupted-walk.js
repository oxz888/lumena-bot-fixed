const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const source = fs.readFileSync(__dirname + '/lumena-bot-fixed.js', 'utf8');

function extractFunction(name) {
  let start = source.indexOf(`function ${name}(`);
  assert.notStrictEqual(start, -1, `function ${name} must exist`);
  if (source.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated function ${name}`);
}

(async () => {
  const keydowns = [];
  const context = {
    CONFIG: { AUTO_WALK: true, WALK_STEP_DELAY_MS: 750, WALK_HOLD_MS: 75, WALK_RUN_HOLD_MS: 500 },
    isWalking: false,
    walkDirection: 'KeyD',
    lastWalkTime: 0,
    battle: false,
    document: { querySelector: () => null },
    Date: { now: () => 1000 },
    sleep: async () => {},
    updateStatus: () => {},
    KeyboardEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
    window: { dispatchEvent: event => { if (event.type === 'keydown') keydowns.push(event.code); } }
  };
  context.isInBattle = () => context.battle;
  vm.createContext(context);
  vm.runInContext([
    extractFunction('getOppositeWalkDirection'),
    extractFunction('getWalkControl'),
    extractFunction('pulseWalkKey'),
    extractFunction('triggerWalkStep')
  ].join('\n'), context);

  await context.triggerWalkStep();
  assert.deepStrictEqual(keydowns, ['KeyD']);
  assert.strictEqual(context.walkDirection, 'KeyA', 'left return must remain pending after right run');

  context.battle = true;
  context.Date.now = () => 2000;
  await context.triggerWalkStep();
  assert.deepStrictEqual(keydowns, ['KeyD'], 'movement must not be consumed while battle is visible');
  assert.strictEqual(context.walkDirection, 'KeyA');

  context.battle = false;
  await context.triggerWalkStep();
  assert.deepStrictEqual(keydowns, ['KeyD', 'KeyA'], 'first free-roam movement after battle must repay the left return');
  assert.strictEqual(context.walkDirection, 'KeyD');
  console.log('PASS: battle cannot consume the owed horizontal return phase');
})().catch(error => { console.error(error); process.exit(1); });
