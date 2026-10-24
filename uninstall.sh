#!/usr/bin/env bash
# Removes Reminder Notes. Your lists and notes are kept unless you add --purge-data.
#   bash uninstall.sh
#   bash uninstall.sh --purge-data
exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/install.sh" uninstall "$@"
