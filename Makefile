# Reminder-Notes-App (Linux)
#
#   make install     install the app for you: it appears in your app menu
#   make uninstall   remove it again (your lists and notes are kept)
#
# No make? Use the shell scripts instead:  bash install.sh   and   bash uninstall.sh

.PHONY: help install uninstall autostart no-autostart run test linux windows all clean

help:
	@echo "make install       install the app (shortcut for: bash install.sh)"
	@echo "make uninstall     remove the app, your lists and notes are kept"
	@echo "make autostart     start the app hidden in the tray at login"
	@echo "make no-autostart  stop starting it at login"
	@echo "make run           run from this folder without installing"
	@echo "make test          run the tests"
	@echo "make linux         build an AppImage and .deb into dist/"
	@echo "make windows       build the Windows .exe files into dist/ (needs wine)"
	@echo "make clean         delete dist/ and node_modules/ in this folder"

install:
	@bash install.sh

uninstall:
	@bash uninstall.sh

autostart:
	@bash install.sh autostart

no-autostart:
	@bash install.sh no-autostart

node_modules: package.json
	@command -v npm >/dev/null 2>&1 || { echo "Node.js and npm are needed. Run: bash install.sh"; exit 1; }
	npm install
	@touch node_modules

run: node_modules
	npm start

test:
	npm test

linux: node_modules
	npm run dist

windows: node_modules
	npm run dist:win

all: linux windows

clean:
	rm -rf dist node_modules
