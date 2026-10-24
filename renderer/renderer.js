const $ = (selector, root = document) => root.querySelector(selector);

const state = {
  tab: 'grocery',
  data: { grocery: [], projects: [], daily: [], notes: '', sort: 'za' },
  open: new Set(), // ids of items whose details panel is open
  refocus: null, // { id, sel } element to focus after the next redraw
};

const EMPTY_TEXT = {
  grocery: 'Nothing on the grocery list. Add the first item below.',
  projects: 'No projects yet. Add one below and give it a start and end time.',
  daily: 'No daily tasks yet. Add the first one below.',
  favourites: 'No favourites yet. Press the star on any item to pin it here.',
};

const LISTS = ['grocery', 'projects', 'daily'];
const LIST_LABEL = { grocery: 'Grocery', projects: 'Projects', daily: 'Daily task' };
const PLACEHOLDER = { grocery: 'Add a grocery item', projects: 'Add a project', daily: 'Add a daily task' };

const COLOR_OPTIONS = [['pink', 'Pink'], ['yellow', 'Light yellow'], ['green', 'Green'], ['blue', 'Sky blue'], ['purple', 'Light purple']];

const PRE_OPTIONS = [0, 5, 10, 15, 30, 45, 60]; // minutes, 60 = the 1 hour maximum
const EXTEND_OPTIONS = [[10, '10 min'], [30, '30 min'], [60, '1 h'], [1440, '1 day'], [10080, '1 week'], [20160, '2 weeks']];

// ---------- small helpers ----------
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value !== false && value != null) node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children);
  return node;
}

const pad = (n) => String(n).padStart(2, '0');

function nextHalfHour() {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
  return d;
}

function span(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'less than a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

function clock(ts) {
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function describe(item, now) {
  const { start, end } = item;
  const overdue = !!(end && now >= end);
  const running = !overdue && !!(start && now >= start);
  let text = '';
  if (overdue) text = `Overdue by ${span(now - end)} (was due ${clock(end)})`;
  else if (running && end) text = `Running, ends in ${span(end - now)} (${clock(end)})`;
  else if (running) text = `Started ${span(now - start)} ago`;
  else if (start && end) text = `Starts in ${span(start - now)} (${clock(start)}), ends ${clock(end)}`;
  else if (start) text = `Starts in ${span(start - now)} (${clock(start)})`;
  else if (end) text = `Due in ${span(end - now)} (${clock(end)})`;
  return { text, overdue, running };
}

function progressPercent(item, now) {
  return Math.min(100, Math.max(0, ((now - item.start) / (item.end - item.start)) * 100));
}

function fillPreSelect(select, value = 0) {
  select.replaceChildren(
    ...PRE_OPTIONS.map((n) => {
      const option = el('option', { value: String(n), text: n === 0 ? 'No pre-alert' : `${n} min before` });
      option.selected = n === value;
      return option;
    })
  );
}

// ---------- easy time picker ----------
// Type the date and time, or open a list (the little arrow) that has every date, hour and minute.
const QUICK_TIMES = [
  ['In 15 min', () => Date.now() + 15 * 60000],
  ['In 30 min', () => Date.now() + 30 * 60000],
  ['In 1 hour', () => Date.now() + 60 * 60000],
  ['In 2 hours', () => Date.now() + 120 * 60000],
  ['Tomorrow 9 AM', () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  }],
];
const DATE_LIST_DAYS = 366; // the date list shows today and the next year

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function formatDate(date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`; // DD/MM/YYYY
}

function dayLabel(date) {
  const diff = Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

// Understands 23/10/2026, 23-10-26, 23.10, 2026-10-23, "today" and "tomorrow". Returns a Date or null.
function parseDate(text) {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const today = startOfDay(new Date());
  if (t === 'today') return today;
  if (t === 'tomorrow' || t === 'tmr') {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }
  let y, m, d, match;
  if ((match = t.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2}|\d{4}))?$/))) {
    d = Number(match[1]);
    m = Number(match[2]);
    y = match[3] ? Number(match[3]) : today.getFullYear();
    if (y < 100) y += 2000;
  } else if ((match = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    y = Number(match[1]);
    m = Number(match[2]);
    d = Number(match[3]);
  } else {
    return null;
  }
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

// A text box you can type in, with a small arrow that opens a list of every choice.
let closeOpenCombo = null; // only one list is open at a time

function createCombo(label, { maxlength, inputmode, width }, getOptions) {
  const input = el('input', {
    type: 'text',
    class: 'combo-input',
    role: 'combobox',
    'aria-label': label,
    'aria-expanded': 'false',
    autocomplete: 'off',
    maxlength: String(maxlength),
    inputmode: inputmode || 'text',
  });
  if (width) input.style.width = width;
  const button = el('button', { type: 'button', class: 'combo-btn', 'aria-label': `Show the ${label} list`, text: '▾' });
  const root = el('span', { class: 'combo' }, [input, button]);
  let list = null;
  let active = -1;

  const onOutside = (event) => {
    if (list && !list.contains(event.target) && !root.contains(event.target)) close();
  };
  const onScroll = (event) => {
    if (list && event.target !== list) close(); // scrolling the page closes it; scrolling the list does not
  };

  function close() {
    if (!list) return;
    list.remove();
    list = null;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', close);
    if (closeOpenCombo === close) closeOpenCombo = null;
  }

  function choose(text) {
    input.value = text;
    close();
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
  }

  function highlight(index) {
    const items = [...list.children];
    if (!items.length) return;
    active = (index + items.length) % items.length;
    items.forEach((item, i) => item.classList.toggle('active', i === active));
    items[active].scrollIntoView({ block: 'nearest' });
  }

  function open() {
    if (list || input.disabled) return;
    if (closeOpenCombo) closeOpenCombo();
    const current = input.value.trim();
    list = el('ul', { class: 'combo-list', role: 'listbox', 'aria-label': label });
    for (const option of getOptions()) {
      const item = el('li', { class: 'combo-option', role: 'option', 'aria-selected': String(option.text === current) }, [
        el('span', { text: option.text }),
        el('span', { class: 'hint', text: option.hint || '' }),
      ]);
      item.addEventListener('mousedown', (event) => {
        event.preventDefault(); // keep the focus in the text box
        choose(option.text);
      });
      list.append(item);
    }
    document.body.append(list);

    const box = input.getBoundingClientRect();
    list.style.minWidth = `${Math.max(box.width + 28, 90)}px`;
    list.style.left = `${box.left}px`;
    const below = box.bottom + 4;
    list.style.top = below + list.offsetHeight > window.innerHeight && box.top > list.offsetHeight
      ? `${box.top - list.offsetHeight - 4}px`
      : `${below}px`;

    const chosen = list.querySelector('[aria-selected="true"]');
    if (chosen) list.scrollTop = chosen.offsetTop - list.clientHeight / 2 + chosen.offsetHeight / 2;
    input.setAttribute('aria-expanded', 'true');
    closeOpenCombo = close;
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
  }

  button.addEventListener('click', () => (list ? close() : open()));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!list) open();
      highlight(active < 0 ? 0 : active + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Enter' && list && active >= 0) {
      event.preventDefault();
      choose(list.children[active].firstChild.textContent);
    } else if (event.key === 'Escape' && list) {
      event.stopPropagation();
      close();
    }
  });

  return { el: root, input };
}

// A tick box plus the picker. get() returns a timestamp, or null when the box is not ticked.
// Call error() first: it returns a message when something typed is not a real date or time.
function createTimeField(label, initial, getDefault) {
  let original = initial || null; // an untouched time is returned exactly as it was
  let ready = false;

  const check = el('input', { type: 'checkbox' });

  const dateBox = createCombo(`${label} date`, { maxlength: 10, width: '104px' }, () => {
    const today = startOfDay(new Date());
    const typed = parseDate(dateBox.input.value);
    const first = typed && typed < today ? typed : today;
    const last = new Date(today);
    last.setDate(last.getDate() + DATE_LIST_DAYS);
    const options = [];
    for (const d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      options.push({ text: formatDate(d), hint: dayLabel(d) });
    }
    return options;
  });
  const hourBox = createCombo(`${label} hour`, { maxlength: 2, inputmode: 'numeric', width: '40px' },
    () => Array.from({ length: 12 }, (_, i) => ({ text: String(i + 1) })));
  const minuteBox = createCombo(`${label} minute`, { maxlength: 2, inputmode: 'numeric', width: '40px' },
    () => Array.from({ length: 60 }, (_, i) => ({ text: pad(i) })));
  const ampmSel = el('select', { 'aria-label': `${label} AM or PM` },
    [el('option', { value: 'AM', text: 'AM' }), el('option', { value: 'PM', text: 'PM' })]);
  const hint = el('p', { class: 'date-hint' });

  const mark = (box, ok) => {
    box.input.classList.toggle('invalid', !ok);
    box.input.setAttribute('aria-invalid', String(!ok));
    return ok;
  };

  function readDate() {
    return parseDate(dateBox.input.value);
  }

  function fixDate() {
    const date = readDate();
    if (date) dateBox.input.value = formatDate(date);
    hint.textContent = date ? date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
    return mark(dateBox, !!date);
  }

  // Typing 15 gives 3 PM, typing 0 gives 12 AM, so 24-hour times work too
  function fixHour() {
    const text = hourBox.input.value.trim();
    let ok = /^\d{1,2}$/.test(text) && Number(text) <= 23;
    if (ok) {
      let h = Number(text);
      if (h === 0) { h = 12; ampmSel.value = 'AM'; }
      else if (h > 12) { h -= 12; ampmSel.value = 'PM'; }
      hourBox.input.value = String(h);
    }
    return mark(hourBox, ok);
  }

  function fixMinute() {
    const text = minuteBox.input.value.trim();
    const ok = /^\d{1,2}$/.test(text) && Number(text) <= 59;
    if (ok) minuteBox.input.value = pad(Number(text));
    return mark(minuteBox, ok);
  }

  dateBox.input.addEventListener('change', fixDate);
  hourBox.input.addEventListener('change', fixHour);
  minuteBox.input.addEventListener('change', fixMinute);

  function setValue(ms) {
    const d = new Date(ms);
    dateBox.input.value = formatDate(d);
    hourBox.input.value = String(d.getHours() % 12 || 12);
    minuteBox.input.value = pad(d.getMinutes());
    ampmSel.value = d.getHours() >= 12 ? 'PM' : 'AM';
    fixDate();
    mark(hourBox, true);
    mark(minuteBox, true);
    ready = true;
  }

  function compose() {
    const date = readDate();
    const h24 = (Number(hourBox.input.value) % 12) + (ampmSel.value === 'PM' ? 12 : 0);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h24, Number(minuteBox.input.value), 0, 0).getTime();
  }

  const chips = el('div', { class: 'chips' }, QUICK_TIMES.map(([text, when]) =>
    el('button', {
      type: 'button',
      class: 'chip',
      text,
      onclick: () => setValue(Math.ceil(when() / 300000) * 300000), // round up to 5 minutes
    })));

  const body = el('div', { class: 'time-body', hidden: true }, [
    chips,
    el('div', { class: 'time-row' }, [
      dateBox.el,
      hourBox.el,
      el('span', { class: 'colon', text: ':' }),
      minuteBox.el,
      ampmSel,
    ]),
    hint,
  ]);

  check.addEventListener('change', () => {
    body.hidden = !check.checked;
    if (check.checked && !ready) setValue(getDefault());
  });

  if (original) {
    check.checked = true;
    body.hidden = false;
    setValue(original);
  }

  function error() {
    if (!check.checked) return '';
    if (!fixDate()) return `${label}: type the date like 23/10/2026.`;
    if (!fixHour()) return `${label}: the hour must be a number from 1 to 12.`;
    if (!fixMinute()) return `${label}: the minute must be a number from 0 to 59.`;
    return '';
  }

  return {
    el: el('div', { class: 'time-field' }, [el('label', { class: 'time-toggle' }, [check, el('span', { text: label })]), body]),
    error,
    get() {
      if (!check.checked || error()) return null;
      const composed = compose();
      if (original && Math.floor(original / 60000) === Math.floor(composed / 60000)) return original;
      return composed;
    },
    set(ms) {
      original = ms || null;
      check.checked = !!ms;
      body.hidden = !ms;
      if (ms) {
        setValue(ms);
      } else {
        for (const box of [dateBox, hourBox, minuteBox]) {
          box.input.value = '';
          mark(box, true);
        }
        hint.textContent = '';
        ready = false;
      }
    },
  };
}

// The row of colour circles (used when adding an item and in an item's details)
function createColourPicker(selected, onPick) {
  let current = selected || '';
  const mark = () => buttons.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.color || '') === current)));
  const buttons = [['', 'Default colour'], ...COLOR_OPTIONS].map(([key, label]) =>
    el('button', {
      type: 'button',
      class: 'swatch' + (key ? '' : ' none'),
      'data-color': key || null,
      'aria-label': label,
      title: label,
      onclick: () => {
        current = key;
        mark();
        if (onPick) onPick(key);
      },
    }));
  mark();
  return {
    el: el('div', { class: 'colours' }, [el('span', { class: 'label', text: 'Colour' }), ...buttons]),
    get: () => current,
    set: (key) => { current = key || ''; mark(); },
  };
}

// Runs an action, shows its error if it failed, otherwise redraws.
async function act(promise, errorEl) {
  const result = await promise;
  if (!result.ok) {
    state.refocus = null;
    if (errorEl) errorEl.textContent = result.error;
    return result;
  }
  if (errorEl) errorEl.textContent = '';
  update(result.data);
  return result;
}

// ---------- description autosave ----------
const pendingDescriptions = new Map(); // id -> { list, text }
let descriptionTimer = null;

function queueDescription(list, id, text) {
  pendingDescriptions.set(id, { list, text });
  clearTimeout(descriptionTimer);
  descriptionTimer = setTimeout(flushDescriptions, 400);
}

async function flushDescriptions() {
  clearTimeout(descriptionTimer);
  const batch = [...pendingDescriptions];
  pendingDescriptions.clear();
  for (const [id, { list, text }] of batch) {
    await window.api.update(list, id, { description: text });
  }
}

// ---------- rendering ----------
function renderPanel(item, list) {

  // Name (rename an item without deleting it)
  const nameError = el('p', { class: 'error', role: 'alert' });
  const nameInput = el('input', { type: 'text', class: 'name-edit', 'aria-label': 'Item name', maxlength: '200' });
  nameInput.value = item.name;
  nameInput.addEventListener('change', async () => {
    const result = await window.api.update(list, item.id, { name: nameInput.value });
    if (!result.ok) {
      nameError.textContent = result.error;
      nameInput.value = item.name;
      return;
    }
    nameError.textContent = '';
    item.name = nameInput.value.trim();
    nameInput.value = item.name;
    state.data = result.data;
    const title = nameInput.closest('li')?.querySelector('.name');
    if (title) title.textContent = item.name;
  });

  // Description
  const desc = el('textarea', {
    class: 'desc',
    rows: '3',
    placeholder: 'Add a description or comment',
    'aria-label': 'Description',
  });
  desc.value = item.description;
  desc.addEventListener('input', () => {
    const current = state.data[list].find((i) => i.id === item.id);
    if (current) current.description = desc.value; // keep the local copy current
    queueDescription(list, item.id, desc.value);
  });
  desc.addEventListener('blur', flushDescriptions);

  // Checklist inside the description
  const stepError = el('p', { class: 'error', role: 'alert' });
  const steps = el('ul', { class: 'steps' });
  for (const step of item.steps) {
    const check = el('input', {
      type: 'checkbox',
      class: 'check small',
      'aria-label': `Mark "${step.text}" as done`,
      onchange: () => act(window.api.stepToggle(list, item.id, step.id)),
    });
    check.checked = step.done;
    const stepText = el('input', { type: 'text', class: 'step-edit', 'aria-label': 'Checklist item', maxlength: '200' });
    stepText.value = step.text;
    stepText.addEventListener('change', async () => {
      const result = await window.api.stepUpdate(list, item.id, step.id, stepText.value);
      if (!result.ok) {
        stepError.textContent = result.error;
        stepText.value = step.text;
        return;
      }
      stepError.textContent = '';
      step.text = stepText.value.trim();
      stepText.value = step.text;
      state.data = result.data;
    });
    steps.append(
      el('li', { class: 'step' + (step.done ? ' done' : '') }, [
        check,
        stepText,
        el('button', {
          type: 'button',
          class: 'icon-btn',
          'aria-label': `Remove "${step.text}"`,
          text: '✕',
          onclick: () => act(window.api.stepRemove(list, item.id, step.id)),
        }),
      ])
    );
  }
  const stepInput = el('input', {
    type: 'text',
    class: 'step-input',
    placeholder: 'Add a checklist item',
    'aria-label': 'New checklist item',
    maxlength: '200',
  });
  const stepForm = el(
    'form',
    {
      class: 'step-form',
      autocomplete: 'off',
      onsubmit: (event) => {
        event.preventDefault();
        if (!stepInput.value.trim()) return;
        state.refocus = { id: item.id, sel: '.step-input' }; // keep typing the next one
        act(window.api.stepAdd(list, item.id, stepInput.value), stepError);
      },
    },
    [stepInput, el('button', { type: 'submit', class: 'secondary', text: 'Add' })]
  );

  const titleBlock = el('div', {}, [nameInput, nameError]);
  const checklistBlock = el('div', {}, [steps, stepForm, stepError]);
  let scheduleBlock = null;

  // Extend and reschedule (not shown for finished items)
  if (!item.done) {
    const scheduleError = el('p', { class: 'error', role: 'alert' });

    const extend = el('div', { class: 'extend' }, [
      el('span', { class: 'label', text: 'Extend end by' }),
      ...EXTEND_OPTIONS.map(([minutes, label]) =>
        el('button', {
          type: 'button',
          class: 'secondary',
          text: label,
          onclick: () => act(window.api.extend(list, item.id, minutes), scheduleError),
        })
      ),
    ]);

    const startField = createTimeField('Start time', item.start, () => nextHalfHour().getTime());
    const endField = createTimeField('End time', item.end, () => (startField.get() || nextHalfHour().getTime()) + 3600000);
    const preSelect = el('select', { 'aria-label': 'Pre-alert' });
    fillPreSelect(preSelect, item.preAlert);

    const save = el('button', {
      type: 'button',
      class: 'primary',
      text: 'Save times',
      onclick: () => {
        const problem = startField.error() || endField.error();
        if (problem) {
          scheduleError.textContent = problem;
          return;
        }
        act(
          window.api.reschedule(list, item.id, {
            start: startField.get(),
            end: endField.get(),
            preAlert: Number(preSelect.value),
          }),
          scheduleError
        );
      },
    });

    scheduleBlock = el('div', { class: 'schedule' }, [
        extend,
        el('div', { class: 'time-fields' }, [startField.el, endField.el]),
        el('div', { class: 'schedule-actions' }, [
          el('label', { class: 'field' }, [el('span', { text: 'Pre-alert' }), preSelect]),
          save,
        ]),
        scheduleError,
      ]);
  }

  // Box colour picker
  const colourBlock = createColourPicker(item.color || '', (key) => act(window.api.update(list, item.id, { color: key }))).el;

  // Order: title, set time, pre-alert, description (with its checklist), colour
  return el('div', { class: 'panel' }, [titleBlock, scheduleBlock, desc, checklistBlock, colourBlock].filter(Boolean));
}

function renderItem(item, now, list) {
  const open = state.open.has(item.id);
  const info = item.done ? { text: '', overdue: false, running: false } : describe(item, now);

  const li = el('li', {
    class: 'item' + (item.done ? ' done' : '') + (item.pinned ? ' pinned' : '') + (info.overdue ? ' overdue' : '') + (info.running ? ' running' : ''),
    'data-id': item.id,
    'data-color': item.color || null,
  });

  const check = el('input', {
    type: 'checkbox',
    class: 'check',
    'aria-label': `Mark "${item.name}" as done`,
    onchange: () => act(window.api.toggle(list, item.id)),
  });
  check.checked = item.done;

  const name = el('button', {
    type: 'button',
    class: 'name',
    text: item.name,
    'aria-expanded': String(open),
    onclick: () => {
      if (state.open.has(item.id)) state.open.delete(item.id);
      else state.open.add(item.id);
      renderItems();
    },
  });

  const star = el('button', {
    type: 'button',
    class: 'icon-btn star' + (item.pinned ? ' on' : ''),
    'aria-pressed': String(item.pinned),
    'aria-label': item.pinned ? `Unpin "${item.name}"` : `Pin "${item.name}" to the top`,
    text: item.pinned ? '★' : '☆',
    onclick: () => act(window.api.update(list, item.id, { pinned: !item.pinned })),
  });
  const del = el('button', {
    type: 'button',
    class: 'icon-btn delete',
    'aria-label': `Delete "${item.name}"`,
    text: 'Delete',
    onclick: () => {
      state.open.delete(item.id);
      act(window.api.remove(list, item.id));
    },
  });

  // In the Favourites tab, show which list each item belongs to
  const badge = state.tab === 'favourites'
    ? [el('span', { class: 'badge', text: LIST_LABEL[list] })]
    : [];
  li.append(check, name, el('div', { class: 'actions' }, [...badge, star, del]));

  if (info.text) li.append(el('div', { class: 'when', text: info.text }));

  // One-line summary while the panel is closed
  if (!open) {
    const tags = [];
    if (item.steps.length) {
      const done = item.steps.filter((s) => s.done).length;
      tags.push(el('span', { class: 'tag', text: `${done} of ${item.steps.length} ${item.steps.length === 1 ? 'item' : 'items'}` }));
    }
    if (item.preAlert && !item.done) tags.push(el('span', { class: 'tag', text: `Pre-alert ${item.preAlert} min` }));
    const firstLine = item.description.trim().split('\n')[0];
    if (firstLine) tags.push(el('span', { class: 'snippet', text: firstLine }));
    if (tags.length) li.append(el('div', { class: 'meta' }, tags));
  }

  // Quick snooze for overdue items
  if (info.overdue) {
    li.append(
      el('div', { class: 'quick' }, [
        el('button', { type: 'button', class: 'secondary', text: 'Extend 10 min', onclick: () => act(window.api.extend(list, item.id, 10)) }),
        el('button', { type: 'button', class: 'secondary', text: 'Extend 1 h', onclick: () => act(window.api.extend(list, item.id, 60)) }),
      ])
    );
  }

  // Progress through the start-to-end window
  if (!item.done && item.start && item.end && now >= item.start) {
    li.append(el('div', { class: 'progress' }, [el('span', { style: `width:${progressPercent(item, now)}%` })]));
  }

  if (open) li.append(renderPanel(item, list));
  return li;
}

// Sorts by the chosen order; pinned items always stay on top (the sort is stable)
function sortItems(items, mode) {
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  const when = (i) => i.end || i.start || null; // the time an item is due (end), else its start
  const sorted = [...items];
  if (mode === 'soon' || mode === 'late') {
    sorted.sort((a, b) => {
      const ta = when(a);
      const tb = when(b);
      if (ta === null && tb === null) return 0;
      if (ta === null) return 1; // items without a time always go last
      if (tb === null) return -1;
      return mode === 'soon' ? ta - tb : tb - ta;
    });
  } else if (mode === 'az') sorted.sort(byName);
  else if (mode === 'za') sorted.sort((a, b) => byName(b, a));
  else if (mode === 'new') sorted.reverse();
  // 'old' keeps the order the items were added in
  return sorted.sort((a, b) => Number(b.pinned) - Number(a.pinned));
}

// What the current tab shows, as { item, list } pairs
function entriesFor(tab) {
  if (tab === 'favourites') {
    const pairs = LISTS.flatMap((list) => state.data[list].filter((i) => i.pinned).map((item) => ({ item, list })));
    return sortItems(pairs.map((p) => p.item), state.data.sort).map((item) => pairs.find((p) => p.item === item));
  }
  return sortItems(state.data[tab], state.data.sort).map((item) => ({ item, list: tab }));
}

function renderItems() {
  if (state.tab === 'notes') return;
  const now = Date.now();
  const entries = entriesFor(state.tab);

  $('#items').replaceChildren(...entries.map(({ item, list }) => renderItem(item, now, list)));

  const empty = $('#empty');
  empty.hidden = entries.length > 0;
  $('#collapse-all').hidden = !entries.some(({ item }) => state.open.has(item.id));
  empty.textContent = EMPTY_TEXT[state.tab];

  if (state.refocus) {
    const target = $(`li[data-id="${CSS.escape(state.refocus.id)}"] ${state.refocus.sel}`);
    if (target) target.focus();
    state.refocus = null;
  }
}

// Updates only the time labels and progress bars, so nothing the person is typing is lost
function refreshLive() {
  const now = Date.now();
  const entries = entriesFor(state.tab);
  for (const li of $('#items').children) {
    const item = entries.find((e) => e.item.id === li.dataset.id)?.item;
    if (!item || item.done) continue;
    const info = describe(item, now);
    const when = $('.when', li);
    if (when) when.textContent = info.text;
    li.classList.toggle('overdue', info.overdue);
    li.classList.toggle('running', info.running);
    const fill = $('.progress > span', li);
    if (fill && item.start && item.end) fill.style.width = `${progressPercent(item, now)}%`;
  }
}

function tick() {
  if (state.tab === 'notes') return;
  if ($('#items').contains(document.activeElement)) refreshLive();
  else renderItems();
}

function renderCounts() {
  for (const key of LISTS) {
    const open = state.data[key].filter((i) => !i.done).length;
    $(`#count-${key}`).textContent = open ? String(open) : '';
  }
  const pinned = LISTS.reduce((n, key) => n + state.data[key].filter((i) => i.pinned && !i.done).length, 0);
  $('#count-favourites').textContent = pinned ? String(pinned) : '';
}

function renderTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.setAttribute('aria-selected', String(btn.dataset.tab === state.tab));
  });
  const isNotes = state.tab === 'notes';
  $('#list-view').hidden = isNotes;
  $('#notes-view').hidden = !isNotes;
  $('#add-form').hidden = state.tab === 'favourites'; // new items are added in a list tab
  if (isNotes) $('#notes').focus();
  else if (PLACEHOLDER[state.tab]) $('#name').placeholder = PLACEHOLDER[state.tab];
}

function update(data) {
  state.data = data;
  $('#sort').value = data.sort;
  renderCounts();
  renderItems();
}

// ---------- events ----------
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', async () => {
    await flushDescriptions();
    state.tab = btn.dataset.tab;
    $('#error').textContent = '';
    renderTabs();
    renderItems();
  });
});

fillPreSelect($('#pre'), 0);

const startField = createTimeField('Alert me at start', null, () => nextHalfHour().getTime());
const endField = createTimeField('Alert me at end', null, () => (startField.get() || nextHalfHour().getTime()) + 3600000);
const addColour = createColourPicker('');
$('#start-field').append(startField.el);
$('#end-field').append(endField.el);
$('#add-colour').append(addColour.el);

$('#add-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!LISTS.includes(state.tab)) return;
  const problem = startField.error() || endField.error();
  if (problem) {
    $('#error').textContent = problem;
    return;
  }
  const result = await window.api.add(state.tab, {
    name: $('#name').value,
    description: $('#desc').value,
    start: startField.get(),
    end: endField.get(),
    preAlert: Number($('#pre').value),
    color: addColour.get(),
  });
  if (!result.ok) {
    $('#error').textContent = result.error;
    return;
  }
  $('#error').textContent = '';
  $('#name').value = '';
  $('#desc').value = '';
  $('#more').open = false;
  fillPreSelect($('#pre'), 0);
  startField.set(null);
  endField.set(null);
  addColour.set('');
  update(result.data);
  $('#name').focus();
});

$('#sort').addEventListener('change', () => act(window.api.setSort($('#sort').value)));

$('#collapse-all').addEventListener('click', () => {
  for (const { item } of entriesFor(state.tab)) state.open.delete(item.id);
  renderItems();
});

// About
$('#about-btn').addEventListener('click', async () => {
  const info = await window.api.info();
  $('#about-version').textContent = info.version.replace(/\.0$/, '');
  $('#about').showModal();
});
$('#about-close').addEventListener('click', () => $('#about').close());

// Notes: save shortly after typing stops, and again when the window closes
let notesTimer = null;
let savedTimer = null;

async function flushNotes() {
  clearTimeout(notesTimer);
  notesTimer = null;
  await window.api.saveNotes($('#notes').value);
  $('#saved').textContent = 'Saved';
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { $('#saved').textContent = ''; }, 1500);
}

$('#notes').addEventListener('input', () => {
  $('#saved').textContent = 'Saving…';
  clearTimeout(notesTimer);
  notesTimer = setTimeout(flushNotes, 400);
});
window.addEventListener('beforeunload', () => {
  if (notesTimer) window.api.saveNotes($('#notes').value);
  flushDescriptions();
});

// ---------- start ----------
window.api.onUpdate((data) => {
  state.data = data;
  renderCounts();
  tick();
});

(async () => {
  const data = await window.api.get();
  $('#notes').value = data.notes;
  update(data);
  renderTabs();
  setInterval(tick, 15000); // keep "in 12 min" labels fresh
})();
