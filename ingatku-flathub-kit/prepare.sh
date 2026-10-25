#!/usr/bin/env bash
# Fills in your GitHub username and name everywhere in this kit.
#   bash prepare.sh your-github-username "Your Name"
set -euo pipefail

if [ $# -ne 2 ]; then
  echo 'Usage: bash prepare.sh your-github-username "Your Name"'
  exit 1
fi
GH="$1"
FULL="$2"
if ! [[ "$GH" =~ ^[A-Za-z0-9-]+$ ]]; then
  echo "A GitHub username only has letters, numbers and dashes."
  exit 1
fi
if [[ "$FULL" == *"|"* || "$FULL" == *"&"* || "$FULL" == *"\\"* ]]; then
  echo "Please leave | & and \\ out of your name."
  exit 1
fi

cd "$(dirname "${BASH_SOURCE[0]}")"

for f in flathub/*GITHUBUSER*; do
  mv "$f" "${f//GITHUBUSER/$GH}"
done

grep -rlE "GITHUBUSER|YOUR NAME" . --exclude=prepare.sh --exclude=README.md | while read -r f; do
  sed -i "s|GITHUBUSER|$GH|g; s|YOUR NAME|$FULL|g" "$f"
done

echo "Done. The Flatpak ID is now: io.github.$GH.Ingatku"
ls flathub
