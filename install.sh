#!/usr/bin/env bash
# Reminder Notes - installer for Linux. No sudo needed (only to install Node.js if it is missing).
#
#   bash install.sh                install the app (it asks if it should start at login)
#   bash install.sh --autostart    install and start hidden in the tray at login
#   bash install.sh autostart      turn on start-at-login
#   bash install.sh no-autostart   turn it off
#   bash install.sh uninstall      remove the app (your lists and notes are kept)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$HOME/.local/share/reminder-notes-app}"
BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"
APPS_DIR="${APPS_DIR:-$HOME/.local/share/applications}"
AUTO_DIR="${AUTO_DIR:-$HOME/.config/autostart}"
DATA_DIR="${DATA_DIR:-$HOME/.config/Reminder Notes}"
LAUNCHER="$BIN_DIR/reminder-notes"

say() { printf '%s\n' "$*"; }

usage() {
  sed -n '2,8p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

# Close the installed copy if it is running. The [e] keeps this command from matching itself.
stop_app() {
  pkill -f "$APP_DIR/node_modules/[e]lectron/dist/electron" 2>/dev/null || true
}

node_ok() {
  command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 &&
    [ "$(node -p 'parseInt(process.versions.node)')" -ge 18 ]
}

ensure_node() {
  if node_ok; then return 0; fi
  say "Node.js 18 or newer (with npm) is needed to run Reminder Notes."
  local cmd=""
  if command -v dnf >/dev/null 2>&1; then cmd="sudo dnf install -y nodejs npm"
  elif command -v apt-get >/dev/null 2>&1; then cmd="sudo apt-get install -y nodejs npm"
  elif command -v pacman >/dev/null 2>&1; then cmd="sudo pacman -S --noconfirm nodejs npm"
  elif command -v zypper >/dev/null 2>&1; then cmd="sudo zypper --non-interactive install nodejs npm"
  fi
  if [ -n "$cmd" ] && [ -t 0 ]; then
    read -r -p "Install it now with:  $cmd  [Y/n] " answer
    if [[ "${answer:-Y}" =~ ^[Yy] ]]; then
      $cmd || true
    fi
  fi
  if ! node_ok; then
    say "Node.js 18+ and npm are still missing. Install them from https://nodejs.org and run this again."
    exit 1
  fi
}

autostart_on() {
  if [ ! -x "$LAUNCHER" ]; then
    say "Install the app first:  bash install.sh"
    exit 1
  fi
  mkdir -p "$AUTO_DIR"
  cat > "$AUTO_DIR/reminder-notes.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Reminder Notes
Exec=$LAUNCHER --hidden
Icon=$APP_DIR/assets/icon.png
Terminal=false
X-GNOME-Autostart-enabled=true
DESKTOP
  say "Reminder Notes will now start hidden in the tray when you log in."
}

autostart_off() {
  rm -f "$AUTO_DIR/reminder-notes.desktop"
  say "Reminder Notes will no longer start at login."
}

install_app() {
  ensure_node
  say "Installing Reminder Notes to $APP_DIR"
  stop_app

  mkdir -p "$APP_DIR" "$BIN_DIR" "$APPS_DIR"
  rm -rf "$APP_DIR/renderer" "$APP_DIR/assets"
  cp -r "$HERE/main.js" "$HERE/preload.js" "$HERE/store.js" "$HERE/renderer" "$HERE/assets" "$APP_DIR/"
  (cd "$HERE" && node scripts/runtime-package.js "$APP_DIR/package.json")

  say "Downloading Electron (first install only, about 100 MB)..."
  (cd "$APP_DIR" && npm install --omit=dev --no-audit --no-fund)

  cat > "$LAUNCHER" <<LAUNCH
#!/bin/sh
exec "$APP_DIR/node_modules/.bin/electron" "$APP_DIR" "\$@"
LAUNCH
  chmod +x "$LAUNCHER"

  cat > "$APPS_DIR/reminder-notes.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Reminder Notes
Comment=Grocery, project and daily task checklists with alarms, plus notes
Exec=$LAUNCHER
Icon=$APP_DIR/assets/icon.png
Terminal=false
Categories=Utility;Office;
DESKTOP
  update-desktop-database "$APPS_DIR" 2>/dev/null || true

  if [ "$AUTOSTART" = 1 ]; then
    autostart_on
  elif [ -t 0 ]; then
    read -r -p "Start Reminder Notes (hidden in the tray) when you log in? [y/N] " answer
    if [[ "${answer:-N}" =~ ^[Yy] ]]; then autostart_on; fi
  fi

  say
  say "Installed. Open 'Reminder Notes' from your app menu."
  say "To pin it: open it, then right-click its icon in the dock and choose Pin / Add to Favourites."
  say "To remove it later:  bash uninstall.sh"
}

uninstall_app() {
  stop_app
  rm -rf "$APP_DIR"
  rm -f "$LAUNCHER" "$APPS_DIR/reminder-notes.desktop" "$AUTO_DIR/reminder-notes.desktop"
  update-desktop-database "$APPS_DIR" 2>/dev/null || true
  say "Reminder Notes was removed."
  if [ "$PURGE" = 1 ]; then
    local answer="n"
    if [ -t 0 ]; then
      read -r -p "Also delete ALL your lists and notes in $DATA_DIR ? [y/N] " answer
    fi
    if [[ "$answer" =~ ^[Yy] ]]; then
      rm -rf "$DATA_DIR"
      say "Your lists and notes were deleted."
    else
      say "Your lists and notes were kept."
    fi
  else
    say "Your lists and notes are still saved in $DATA_DIR"
    say "(run  bash uninstall.sh --purge-data  to delete them too)"
  fi
}

CMD="install"
AUTOSTART=0
PURGE=0
for arg in "$@"; do
  case "$arg" in
    install|uninstall|autostart|no-autostart) CMD="$arg" ;;
    --autostart) AUTOSTART=1 ;;
    --purge-data) PURGE=1 ;;
    -h|--help|help) usage; exit 0 ;;
    *) say "Unknown option: $arg"; usage; exit 1 ;;
  esac
done

case "$CMD" in
  install) install_app ;;
  uninstall) uninstall_app ;;
  autostart) autostart_on ;;
  no-autostart) autostart_off ;;
esac
