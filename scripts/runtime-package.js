// Writes a small package.json for the installed copy.
// To run, the app only needs Electron, not the build tools, so the install stays smaller.
const fs = require('fs');

const src = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const out = {
  name: src.name,
  productName: src.productName,
  version: src.version,
  description: src.description,
  main: src.main,
  desktopName: src.desktopName,
  license: src.license,
  dependencies: { electron: src.devDependencies.electron },
};
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + '\n');
