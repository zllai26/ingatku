const { contextBridge, ipcRenderer } = require('electron');

const call = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
  get: call('store:get'),
  add: call('store:add'),
  toggle: call('store:toggle'),
  remove: call('store:remove'),
  update: call('store:update'), // description, pinned
  stepAdd: call('store:stepAdd'),
  stepToggle: call('store:stepToggle'),
  stepRemove: call('store:stepRemove'),
  stepUpdate: call('store:updateStep'),
  setSort: call('store:sort'),
  info: call('app:info'),
  showData: call('app:showData'),
  extend: call('store:extend'),
  reschedule: call('store:reschedule'),
  saveNotes: call('store:notes'),
  onUpdate: (callback) => ipcRenderer.on('store:updated', (_event, data) => callback(data)),
});
