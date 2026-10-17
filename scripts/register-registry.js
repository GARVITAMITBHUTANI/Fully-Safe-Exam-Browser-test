const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.join(__dirname, '..');
const packagedExe = path.join(projectRoot, 'release', 'win-unpacked', 'FSEB.exe');

let commandString = '';
let targetDescription = '';

if (fs.existsSync(packagedExe)) {
  targetDescription = `Packaged binary: ${packagedExe}`;
  commandString = `\\"${packagedExe}\\" \\"%1\\"`;
} else {
  // Development mode: locate local electron binary
  const electronExe = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
  if (fs.existsSync(electronExe)) {
    targetDescription = `Development Electron: ${electronExe} with project root: ${projectRoot}`;
    commandString = `\\"${electronExe}\\" \\"${projectRoot}\\" \\"%1\\"`;
  } else {
    // Fallback: try building package
    console.log(`Packaged FSEB.exe not found. Building package first...`);
    execSync('npm run pack', { stdio: 'inherit', cwd: projectRoot });
    commandString = `\\"${packagedExe}\\" \\"%1\\"`;
    targetDescription = `Packaged binary: ${packagedExe}`;
  }
}

console.log(`Registering FSEB as default handler for Chrome and Windows...`);
console.log(`Target: ${targetDescription}`);

try {
  const protocols = ['seb', 'sebs', 'seb-config'];
  for (const proto of protocols) {
    const keyBase = `HKCU\\Software\\Classes\\${proto}`;
    execSync(`reg add "${keyBase}" /ve /t REG_SZ /d "URL:Safe Exam Browser Protocol" /f`, { stdio: 'ignore' });
    execSync(`reg add "${keyBase}" /v "URL Protocol" /t REG_SZ /d "" /f`, { stdio: 'ignore' });
    execSync(`reg add "${keyBase}\\shell\\open\\command" /ve /t REG_SZ /d "${commandString}" /f`, { stdio: 'ignore' });
  }

  // Also register .seb file extension
  const fileExtKey = `HKCU\\Software\\Classes\\.seb`;
  const progIdKey = `HKCU\\Software\\Classes\\FSEB.Configuration`;
  execSync(`reg add "${fileExtKey}" /ve /t REG_SZ /d "FSEB.Configuration" /f`, { stdio: 'ignore' });
  execSync(`reg add "${progIdKey}" /ve /t REG_SZ /d "FSEB Exam Configuration File" /f`, { stdio: 'ignore' });
  execSync(`reg add "${progIdKey}\\shell\\open\\command" /ve /t REG_SZ /d "${commandString}" /f`, { stdio: 'ignore' });

  console.log(`\nSUCCESS: FSEB is now registered for seb://, sebs://, seb-config and .seb files.`);
  console.log(`When you click "Open in Safe Exam Browser" in Google Chrome, it will now launch FSEB!`);
} catch (err) {
  console.error('Failed to register in Windows Registry:', err);
  process.exit(1);
}
