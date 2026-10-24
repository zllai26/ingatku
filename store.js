// Storage + alarm logic. No Electron imports, so it can be tested with plain Node.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LISTS = ['grocery', 'projects', 'daily'];
const LABELS = { grocery: 'grocery', projects: 'projects', daily: 'daily task' };
const SORTS = ['soon', 'late', 'za', 'az', 'new', 'old']; // soon = shortest time, late = longest time // Z to A is the default, like reverse sort in main.py
const COLORS = ['pink', 'yellow', 'green', 'blue', 'purple']; // box colours; '' means the default look
const MAX_PRE_ALERT = 60; // minutes (1 hour)
const MAX_EXTEND = 30 * 24 * 60; // minutes (30 days)
const MINUTE = 60000;

const uid = () => crypto.randomUUID();
const num = (v) => (Number.isFinite(v) && v > 0 ? v : null);

function cleanPreAlert(value) {
  const n = Math.round(Number(value) || 0);
  return Math.min(MAX_PRE_ALERT, Math.max(0, n));
}

// Fills in the new fields, so data saved by version 1 still loads.
function normalize(item) {
  return {
    id: item.id || uid(),
    name: String(item.name || ''),
    done: !!item.done,
    pinned: !!item.pinned,
    color: COLORS.includes(item.color) ? item.color : '',
    description: String(item.description || ''),
    steps: Array.isArray(item.steps)
      ? item.steps.map((s) => ({ id: s.id || uid(), text: String(s.text || ''), done: !!s.done }))
      : [],
    start: num(item.start),
    end: num(item.end),
    preAlert: cleanPreAlert(item.preAlert),
    startFired: !!item.startFired,
    endFired: !!item.endFired,
    preFired: !!item.preFired,
  };
}

function checkTimes(start, end, preAlert) {
  if (start && end && end <= start) return 'End must be after start.';
  if (preAlert > 0 && !start && !end) return 'A pre-alert needs a start or end time.';
  return null;
}

class Store {
  constructor(file) {
    this.file = file;
    this.data = { grocery: [], projects: [], daily: [], notes: '', sort: 'za' };
    this.load();
  }

  load() {
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      for (const list of LISTS) {
        this.data[list] = Array.isArray(saved[list]) ? saved[list].map(normalize) : [];
      }
      this.data.notes = typeof saved.notes === 'string' ? saved.notes : '';
      this.data.sort = SORTS.includes(saved.sort) ? saved.sort : 'za';
    } catch {
      // first run or unreadable file: start empty
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file); // atomic: never leaves a half-written file
  }

  find(list, id) {
    return LISTS.includes(list) ? this.data[list].find((i) => i.id === id) : undefined;
  }

  // ---------- items ----------
  add(list, { name, description, start, end, preAlert, color } = {}) {
    if (!LISTS.includes(list)) return { ok: false, error: 'Unknown list.' };
    name = String(name || '').trim();
    if (!name) return { ok: false, error: 'Write a name first.' };
    start = num(start);
    end = num(end);
    const pre = cleanPreAlert(preAlert);
    const error = checkTimes(start, end, pre);
    if (error) return { ok: false, error };
    if (color && !COLORS.includes(color)) return { ok: false, error: 'Unknown colour.' };
    this.data[list].push(
      normalize({
        name,
        description: String(description || '').trim().slice(0, 5000),
        start,
        end,
        preAlert: pre,
        color,
      })
    );
    this.save();
    return { ok: true };
  }

  toggle(list, id) {
    const item = this.find(list, id);
    if (item) {
      item.done = !item.done;
      this.save();
    }
  }

  remove(list, id) {
    if (!LISTS.includes(list)) return;
    this.data[list] = this.data[list].filter((i) => i.id !== id);
    this.save();
  }

  // name, description, pinned and colour
  update(list, id, patch = {}) {
    const item = this.find(list, id);
    if (!item) return { ok: false, error: 'Item not found.' };
    if (patch.color && !COLORS.includes(patch.color)) return { ok: false, error: 'Unknown colour.' };
    if ('name' in patch) {
      const name = String(patch.name || '').trim().slice(0, 200);
      if (!name) return { ok: false, error: 'The name can\'t be empty.' };
      item.name = name;
    }
    if ('description' in patch) item.description = String(patch.description).slice(0, 5000);
    if ('pinned' in patch) item.pinned = !!patch.pinned;
    if ('color' in patch) item.color = patch.color || '';
    this.save();
    return { ok: true };
  }

  // ---------- checklist inside an item's description ----------
  addStep(list, id, text) {
    const item = this.find(list, id);
    if (!item) return { ok: false, error: 'Item not found.' };
    text = String(text || '').trim().slice(0, 200);
    if (!text) return { ok: false, error: 'Write a checklist item first.' };
    item.steps.push({ id: uid(), text, done: false });
    this.save();
    return { ok: true };
  }

  updateStep(list, id, stepId, text) {
    const step = this.find(list, id)?.steps.find((s) => s.id === stepId);
    if (!step) return { ok: false, error: 'Item not found.' };
    text = String(text || '').trim().slice(0, 200);
    if (!text) return { ok: false, error: 'A checklist item can\'t be empty.' };
    step.text = text;
    this.save();
    return { ok: true };
  }

  toggleStep(list, id, stepId) {
    const step = this.find(list, id)?.steps.find((s) => s.id === stepId);
    if (step) {
      step.done = !step.done;
      this.save();
    }
  }

  removeStep(list, id, stepId) {
    const item = this.find(list, id);
    if (item) {
      item.steps = item.steps.filter((s) => s.id !== stepId);
      this.save();
    }
  }

  // ---------- extend / reschedule ----------
  _applyTimes(item, start, end, preAlert, now) {
    const oldRef = item.start || item.end;
    const oldPre = item.preAlert;
    // A changed time gets a fresh alarm. A start moved into the past doesn't ring.
    if (start !== item.start) item.startFired = !!start && start <= now;
    if (end !== item.end) item.endFired = false;
    item.start = start;
    item.end = end;
    item.preAlert = preAlert;
    if ((item.start || item.end) !== oldRef || preAlert !== oldPre) item.preFired = false;
    this.save();
  }

  // Pushes the end time later. An overdue or empty end counts from now.
  extend(list, id, minutes, now = Date.now()) {
    const item = this.find(list, id);
    if (!item) return { ok: false, error: 'Item not found.' };
    minutes = Math.round(Number(minutes));
    if (!(minutes > 0) || minutes > MAX_EXTEND) {
      return { ok: false, error: 'Extend by 1 minute up to 30 days.' };
    }
    const base = Math.max(now, item.end || 0, item.start || 0);
    const end = Math.ceil((base + minutes * MINUTE) / MINUTE) * MINUTE; // whole minutes
    this._applyTimes(item, item.start, end, item.preAlert, now);
    return { ok: true };
  }

  reschedule(list, id, { start, end, preAlert } = {}, now = Date.now()) {
    const item = this.find(list, id);
    if (!item) return { ok: false, error: 'Item not found.' };
    start = num(start);
    end = num(end);
    const pre = cleanPreAlert(preAlert);
    const error = checkTimes(start, end, pre);
    if (error) return { ok: false, error };
    if (end && end !== item.end && end <= now) {
      return { ok: false, error: 'That end time is already in the past.' };
    }
    this._applyTimes(item, start, end, pre, now);
    return { ok: true };
  }

  setSort(mode) {
    if (!SORTS.includes(mode)) return { ok: false, error: 'Unknown sort order.' };
    this.data.sort = mode;
    this.save();
    return { ok: true };
  }

  setNotes(text) {
    this.data.notes = String(text);
    this.save();
  }

  // ---------- alarms ----------
  // Returns the alarms that just fired; each one fires once.
  checkAlarms(now = Date.now()) {
    const fired = [];
    for (const list of LISTS) {
      for (const item of this.data[list]) {
        if (item.done) continue;

        // Pre-alert: X minutes before the start (or before the end if there is no start)
        const ref = item.start || item.end;
        if (item.preAlert > 0 && ref && !item.preFired && now >= ref - item.preAlert * MINUTE) {
          item.preFired = true;
          if (now < ref) {
            const mins = Math.max(1, Math.round((ref - now) / MINUTE));
            const at = new Date(ref).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            fired.push({
              kind: 'pre',
              title: `Heads up: ${item.name}`,
              body: `${item.start ? 'Starts' : 'Due'} in ${mins} min, at ${at} (${LABELS[list]}).`,
            });
          }
        }
        if (item.start && !item.startFired && now >= item.start) {
          item.startFired = true;
          fired.push({ kind: 'start', title: `Start: ${item.name}`, body: `Time to start (${LABELS[list]}).` });
        }
        if (item.end && !item.endFired && now >= item.end) {
          item.endFired = true;
          fired.push({ kind: 'end', title: `Time's up: ${item.name}`, body: `Deadline reached (${LABELS[list]}).` });
        }
      }
    }
    if (fired.length) this.save();
    return fired;
  }
}

module.exports = { Store, MAX_PRE_ALERT, COLORS };
