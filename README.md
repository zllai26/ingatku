# Reminder-Notes-App 0.4 (BETA)

A Linux desktop app (JavaScript + Electron). Grocery, Projects and Daily task checklists with alarms, plus a Notes tab that is saved automatically.

## Install (Linux)

```bash
bash install.sh      # or:  make install
```

This installs the app for your user only (no sudo), adds **Reminder Notes** to your app menu, and asks if it should start hidden in the tray at login. If Node.js is missing, it offers to install it for you. Remove it again with `bash uninstall.sh` (or `make uninstall`). Your lists and notes are kept unless you add `--purge-data`.

Start at login later: `bash install.sh autostart`. Turn it off: `bash install.sh no-autostart`.

## Run it

```bash
npm install
npm start
```

Build an installable app with `npm run dist` (creates an `.AppImage` and a `.deb` in `dist/`).

## Features

- **Lists:** Grocery, Projects and Daily task, each a checklist you can tick off. Every item can have a start alarm, an end alarm and a pre-alert.
- **Update an item:** click an item's name to open its details. You can rename it, edit its description, and edit the text of any checklist item, so nothing has to be deleted and added again.
- **Description and checklist:** each item has a description and a tickable checklist. The closed item shows "2 of 5 items".
- **Extend and reschedule:** extend the end by 10 min, 30 min, 1 h, 1 day, 1 week or 2 weeks (up to 30 days). Or change the start, end and pre-alert and press "Save times". Overdue items show quick "Extend 10 min" and "Extend 1 h" buttons.
- **Pre-alert (up to 1 hour):** a heads-up 5 to 60 minutes before the start time, or before the end time if there is no start.
- **Pin and Favourites:** press the star on any item to pin it to the top of its list. The Favourites tab shows every pinned item from all lists, labelled with its list.
- **Sort:** Shortest time (soonest first), Longest time (latest first), Z to A, A to Z, newest first or oldest first. Shortest/Longest time use an item's end time, or its start time if it has no end. Items without a time go last. Pinned items always stay on top.
- **Collapse all:** one button closes every open item in the current tab.
- **Box colour:** pick a colour when you add an item, or open an item and change it. The pastel colours are pink, light yellow, green, sky blue or light purple. Pick the first circle to go back to the default.
- **Order:** the add form and the item details follow the same order: title, set time, pre-alert, then description.
- **Easy time picker:** tick "Alert me at start" or "end", then type the date (like 23/10/2026, or `today` / `tomorrow`), the hour and the minute. Or click the little arrow beside each box to pick from a list with every date for the next year, every hour and every minute (00 to 59). Typing 15 for the hour gives 3 PM. Quick buttons: In 15 min, In 30 min, In 1 hour, In 2 hours, Tomorrow 9 AM.
- **Notes:** saved as you type.
- **About:** the About button shows the app name, version, the author and that this is a BETA version.

## Your data

Everything (items, descriptions, checklists, alarms, pins, sort order, notes) is stored in one file, so it is still there after you close the app or reboot:

```
~/.config/Reminder Notes/data.json
```

Data saved by version 1 loads without changes.

## Alarms

- The app checks every 5 seconds. At the start time and again at the end time you get a desktop notification and a sound. Each alarm fires once, and done items never fire.
- Closing the window hides the app to the system tray so alarms keep working. Use the tray icon's Quit to exit.
- To start hidden at login, run `reminder-notes --hidden` from your startup entries (or `npm run start:hidden` in the project folder).
- Stock GNOME hides tray icons. Install the AppIndicator extension, otherwise the app has no way to bring the window back except launching it again.

## Test the logic

```bash
npm test
```
