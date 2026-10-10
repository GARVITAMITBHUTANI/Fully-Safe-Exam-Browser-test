const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'UI', 'views');
const destDir = path.join(__dirname, '..', 'dist', 'UI', 'views');

function copyFolderSync(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(element => {
    const stat = fs.lstatSync(path.join(from, element));
    if (stat.isFile()) {
      fs.copyFileSync(path.join(from, element), path.join(to, element));
    } else if (stat.isDirectory()) {
      copyFolderSync(path.join(from, element), path.join(to, element));
    }
  });
}

copyFolderSync(srcDir, destDir);
console.log('UI assets copied to dist/UI/views successfully.');

