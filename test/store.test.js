const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../store');

const MIN = 60000;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-'));
const file = path.join(dir, 'data.json');
const store = new Store(file);
const t = Date.now();

// ---------- validation ----------
assert.strictEqual(store.add('grocery', { name: '  ' }).ok, false);
assert.strictEqual(store.add('grocery', { name: 'x', start: 2000, end: 1000 }).ok, false);
assert.strictEqual(store.add('nope', { name: 'x' }).ok, false);
assert.strictEqual(store.add('grocery', { name: 'x', preAlert: 10 }).ok, false, 'pre-alert needs a time');

// ---------- start/end alarms (as before) ----------
assert.ok(store.add('grocery', { name: 'milk', start: t - 2000, end: t - 1000 }).ok);
assert.strictEqual(store.checkAlarms(t).length, 2, 'milk start + end fire');
assert.strictEqual(store.checkAlarms(t).length, 0, 'alarms fire only once');

// ---------- 1. description ----------
assert.ok(store.add('projects', { name: 'report', description: '  Q3 numbers  ' }).ok);
const report = store.data.projects[0];
assert.strictEqual(report.description, 'Q3 numbers');
store.update('projects', report.id, { description: 'Q3 numbers, send to Sam' });
assert.strictEqual(store.data.projects[0].description, 'Q3 numbers, send to Sam');

// ---------- 2. checklist inside the description ----------
assert.strictEqual(store.addStep('projects', report.id, '   ').ok, false);
assert.ok(store.addStep('projects', report.id, 'Collect data').ok);
assert.ok(store.addStep('projects', report.id, 'Write summary').ok);
const [s1, s2] = store.data.projects[0].steps;
store.toggleStep('projects', report.id, s1.id);
assert.strictEqual(store.data.projects[0].steps[0].done, true);
store.removeStep('projects', report.id, s2.id);
assert.strictEqual(store.data.projects[0].steps.length, 1);

// ---------- pin / favourite ----------
store.update('projects', report.id, { pinned: true });
assert.strictEqual(store.data.projects[0].pinned, true);

// ---------- 4. pre-alert (max 1 hour) ----------
assert.ok(store.add('projects', { name: 'call', start: t + 30 * MIN, preAlert: 90 }).ok);
const call = store.data.projects[1];
assert.strictEqual(call.preAlert, 60, 'clamped to 60 minutes');
store.reschedule('projects', call.id, { start: t + 30 * MIN, preAlert: 10 }, t);
assert.strictEqual(store.checkAlarms(t + 5 * MIN).length, 0, 'too early for the pre-alert');
let fired = store.checkAlarms(t + 21 * MIN);
assert.strictEqual(fired.length, 1);
assert.strictEqual(fired[0].kind, 'pre');
assert.strictEqual(store.checkAlarms(t + 22 * MIN).length, 0, 'pre-alert fires once');
fired = store.checkAlarms(t + 31 * MIN);
assert.strictEqual(fired.length, 1);
assert.strictEqual(fired[0].kind, 'start');

// pre-alert uses the end time when there is no start
assert.ok(store.add('projects', { name: 'deadline', end: t + 60 * MIN, preAlert: 15 }).ok);
fired = store.checkAlarms(t + 46 * MIN);
assert.strictEqual(fired.length, 1);
assert.ok(fired[0].body.startsWith('Due in'));

// ---------- 3. extend ----------
assert.ok(store.add('projects', { name: 'task', end: t + 10 * MIN }).ok);
const task = store.data.projects.find((i) => i.name === 'task');
store.extend('projects', task.id, 30, t);
assert.ok(task.end >= t + 40 * MIN && task.end < t + 41 * MIN, 'end moves 30 min later');
assert.strictEqual(task.end % MIN, 0, 'whole minutes');

// overdue: extend counts from now and the end alarm rings again
store.checkAlarms(t + 2 * 60 * MIN);
assert.strictEqual(task.endFired, true);
store.extend('projects', task.id, 10, t + 2 * 60 * MIN);
assert.ok(task.end >= t + 130 * MIN);
assert.strictEqual(task.endFired, false, 'fresh end alarm after extending');
assert.strictEqual(store.extend('projects', task.id, 0).ok, false);
assert.strictEqual(store.extend('projects', task.id, 99999).ok, false);

// ---------- 3. reschedule ----------
const now2 = t + 3 * 60 * MIN;
assert.strictEqual(store.reschedule('projects', task.id, { end: now2 - MIN }, now2).ok, false, 'end in the past');
assert.strictEqual(store.reschedule('projects', task.id, { start: now2 + 2 * MIN, end: now2 + MIN }, now2).ok, false);
assert.ok(store.reschedule('projects', task.id, { start: now2 + MIN, end: now2 + 61 * MIN, preAlert: 0 }, now2).ok);
assert.strictEqual(task.startFired, false);
assert.strictEqual(task.endFired, false);

// ---------- extend: 1 week and 2 weeks (up to 30 days) ----------
const long = store.data.projects.find((i) => i.name === 'deadline');
const endBeforeWeek = long.end;
assert.ok(store.extend('projects', long.id, 10080, t).ok);
assert.ok(long.end >= endBeforeWeek + 7 * 24 * 60 * MIN);
assert.ok(store.extend('projects', long.id, 20160, t).ok);
assert.strictEqual(store.extend('projects', long.id, 31 * 24 * 60, t).ok, false, 'more than 30 days refused');

// ---------- update an added item (rename, edit checklist item) ----------
assert.ok(store.update('projects', report.id, { name: '  Q3 report v2 ' }).ok);
assert.strictEqual(store.data.projects[0].name, 'Q3 report v2');
assert.strictEqual(store.update('projects', report.id, { name: '   ' }).ok, false, 'name cannot be empty');
assert.strictEqual(store.data.projects[0].name, 'Q3 report v2');
assert.ok(store.updateStep('projects', report.id, s1.id, 'Collect all data').ok);
assert.strictEqual(store.data.projects[0].steps[0].text, 'Collect all data');
assert.strictEqual(store.updateStep('projects', report.id, s1.id, '').ok, false);

// ---------- daily task list ----------
assert.ok(store.add('daily', { name: 'Stretch', start: t - 2000 }).ok);
assert.strictEqual(store.checkAlarms(t).filter((a) => a.title === 'Start: Stretch').length, 1);
assert.ok(store.update('daily', store.data.daily[0].id, { pinned: true }).ok);

// ---------- box colour ----------
assert.strictEqual(store.data.projects[0].color, '', 'default colour is none');
assert.ok(store.update('projects', report.id, { color: 'pink' }).ok);
assert.strictEqual(store.data.projects[0].color, 'pink');
for (const colour of ['yellow', 'green', 'blue', 'purple']) assert.ok(store.update('projects', report.id, { color: colour }).ok);
assert.strictEqual(store.update('projects', report.id, { color: 'red' }).ok, false, 'unknown colour refused');
assert.strictEqual(store.data.projects[0].color, 'purple', 'refused colour changes nothing');
assert.ok(store.update('projects', report.id, { color: '' }).ok);
assert.strictEqual(store.data.projects[0].color, '', 'colour can be reset');
store.update('projects', report.id, { color: 'green' });

// ---------- colour when adding ----------
assert.ok(store.add('grocery', { name: 'tinted', color: 'blue' }).ok);
assert.strictEqual(store.data.grocery.find((i) => i.name === 'tinted').color, 'blue');
assert.strictEqual(store.add('grocery', { name: 'bad colour', color: 'red' }).ok, false);

// ---------- sort preference ----------
assert.strictEqual(store.data.sort, 'za', 'default sort is Z to A');
assert.strictEqual(store.setSort('nonsense').ok, false);
assert.ok(store.setSort('soon').ok, 'shortest time sort');
assert.ok(store.setSort('late').ok, 'longest time sort');
assert.ok(store.setSort('new').ok);

// ---------- done items never fire; delete ----------
store.toggle('projects', task.id);
assert.strictEqual(store.checkAlarms(t + 24 * 60 * MIN).filter((a) => a.title.includes('task')).length, 0);
const before = store.data.projects.length;
store.remove('projects', task.id);
assert.strictEqual(store.data.projects.length, before - 1);

// ---------- notes + persistence across restart ----------
store.setNotes('hello\nworld');
const reopened = new Store(file);
assert.strictEqual(reopened.data.notes, 'hello\nworld');
assert.strictEqual(reopened.data.projects[0].steps[0].text, 'Collect all data');
assert.strictEqual(reopened.data.projects[0].steps[0].done, true);
assert.strictEqual(reopened.data.projects[0].pinned, true);
assert.strictEqual(reopened.data.projects[0].description, 'Q3 numbers, send to Sam');
assert.strictEqual(reopened.data.projects[0].name, 'Q3 report v2');
assert.strictEqual(reopened.data.daily[0].name, 'Stretch');
assert.strictEqual(reopened.data.daily[0].pinned, true);
assert.strictEqual(reopened.data.sort, 'new');
assert.strictEqual(reopened.data.projects[0].color, 'green', 'colour is saved');

// ---------- data saved by version 1 still loads ----------
const oldFile = path.join(dir, 'old.json');
fs.writeFileSync(
  oldFile,
  JSON.stringify({
    grocery: [{ id: 'a', name: 'eggs', done: false, start: null, end: null, startFired: false, endFired: false }],
    projects: [],
    notes: 'keep me',
  })
);
const old = new Store(oldFile);
assert.strictEqual(old.data.grocery[0].name, 'eggs');
assert.deepStrictEqual(old.data.grocery[0].steps, []);
assert.strictEqual(old.data.grocery[0].preAlert, 0);
assert.strictEqual(old.data.grocery[0].description, '');
assert.strictEqual(old.data.grocery[0].color, '');
assert.strictEqual(old.data.notes, 'keep me');
assert.deepStrictEqual(old.data.daily, []);
assert.strictEqual(old.data.sort, 'za');

console.log('all store tests passed');
