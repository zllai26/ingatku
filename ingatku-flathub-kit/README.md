# Publish Ingatku on Linux (Flathub, shown in GNOME Software)

You cannot submit to GNOME Software directly. Apps appear in it once they are on Flathub.
These files pass the offline checkers (appstreamcli, desktop-file-validate), but they have not been
built on a real Flatpak setup, so the first build and the reviewers will tell you the rest.

## Step 1. Rename the project
In your project's `package.json`:

- `"name": "ingatku"`
- `"productName": "Ingatku"`
- inside `"build"`: `"appId": "io.github.YOUR-GITHUB-USERNAME.ingatku"`
- inside `"build"` then `"linux"`: add `"executableName": "ingatku"`

Your data folder is named after `productName`. If you renamed it, copy your old
`~/.config/Reminder Notes/data.json` to `~/.config/Ingatku/data.json`.

Search the internet for "Ingatku" to make sure nobody else owns it as a trademark.

## Step 2. Put it on GitHub
- Make a public repository called `ingatku` and push your project.
- Add the `LICENSE` file from this kit (replace YOUR NAME with your name).
- Take a screenshot of the app and save it as `screenshots/ingatku-main.png`. Push it too.

## Step 3. Install the tools (Fedora)
```bash
sudo dnf install flatpak flatpak-builder git gh
flatpak remote-add --if-not-exists --user flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub org.flatpak.Builder
gh auth login
```

## Step 4. Fill in your details
In this kit's folder:
```bash
bash prepare.sh your-github-username "Your Name"
```
Your app ID becomes `io.github.your-github-username.Ingatku`.

## Step 5. Build the app and upload it
In your project folder:
```bash
npx electron-builder --linux dir
ls dist/linux-unpacked              # a file called ingatku must be in here
tar -czf ingatku-0.4.0-linux-x64.tar.gz -C dist linux-unpacked
sha256sum ingatku-0.4.0-linux-x64.tar.gz
```
- On GitHub, make a Release with the tag `v0.4.0` and upload the `.tar.gz`.
- Open `flathub/io.github.your-github-username.Ingatku.yml`.
- Paste the `sha256sum` result in place of `PUT_THE_SHA256_HERE`.
- Check that the `url:` matches your release.

## Step 6. Test it on your computer
```bash
cd flathub
flatpak-builder --user --install --force-clean build-dir io.github.your-github-username.Ingatku.yml
flatpak run io.github.your-github-username.Ingatku
```
Check that the window opens, an alarm one minute away shows a notification, and the tray icon appears.

## Step 7. Run the Flathub checker
```bash
flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest io.github.your-github-username.Ingatku.yml
flatpak run --command=flatpak-builder-lint org.flatpak.Builder appstream io.github.your-github-username.Ingatku.metainfo.xml
```
Fix anything it reports. (A hint about a capital letter in the ID is harmless.)

## Step 8. Submit
```bash
gh repo fork --clone flathub/flathub && cd flathub
git checkout --track origin/new-pr
git checkout -b ingatku
cp /path/to/this/kit/flathub/* .
git add . && git commit -m "Add io.github.your-github-username.Ingatku"
git push -u origin ingatku
```
Open a pull request on GitHub **into the `new-pr` branch** of `flathub/flathub`.

## Step 9. Review
Reviewers comment on the pull request. Answer them and push fixes to the same branch. Do not close the pull request.
After it is merged, the app appears on Flathub and then in GNOME Software.

New versions later: build a new `.tar.gz`, update `url`, `sha256` and the `<release>` entry, and push the change to your app's Flathub repository.
