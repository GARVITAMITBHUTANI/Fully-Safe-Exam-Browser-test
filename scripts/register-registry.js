const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.join(__dirname, '..');
const packagedExe = path.join(projectRoot, 'release', 'win-unpacked', 'FSEB.exe');

let commandString = '';
let targetExe = '';
let targetDescription = '';

if (fs.existsSync(packagedExe)) {
  targetExe = packagedExe;
  targetDescription = `Packaged binary: ${packagedExe}`;
  commandString = `\\"${packagedExe}\\" \\"%1\\"`;
} else {
  // Development mode: locate local electron binary
  const electronExe = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
  if (fs.existsSync(electronExe)) {
    targetExe = electronExe;
    targetDescription = `Development Electron: ${electronExe} with project root: ${projectRoot}`;
    commandString = `\\"${electronExe}\\" \\"${projectRoot}\\" \\"%1\\"`;
  } else {
    // Fallback: build package
    console.log(`Packaged FSEB.exe not found. Building package first...`);
    execSync('npm run pack', { stdio: 'inherit', cwd: projectRoot });
    targetExe = packagedExe;
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
    execSync(`reg add "${keyBase}\\DefaultIcon" /ve /t REG_SZ /d "\\"${targetExe}\\",0" /f`, { stdio: 'ignore' });
    execSync(`reg add "${keyBase}\\shell\\open\\command" /ve /t REG_SZ /d "${commandString}" /f`, { stdio: 'ignore' });
  }

  // Register .seb file extension
  const fileExtKey = `HKCU\\Software\\Classes\\.seb`;
  const progIdKey = `HKCU\\Software\\Classes\\FSEB.Configuration`;
  execSync(`reg add "${fileExtKey}" /ve /t REG_SZ /d "FSEB.Configuration" /f`, { stdio: 'ignore' });
  execSync(`reg add "${progIdKey}" /ve /t REG_SZ /d "FSEB Exam Configuration File" /f`, { stdio: 'ignore' });
  execSync(`reg add "${progIdKey}\\DefaultIcon" /ve /t REG_SZ /d "\\"${targetExe}\\",0" /f`, { stdio: 'ignore' });
  execSync(`reg add "${progIdKey}\\shell\\open\\command" /ve /t REG_SZ /d "${commandString}" /f`, { stdio: 'ignore' });

  // Override official SEB ConfigurationFileExtension
  const officialProgIdKey = `HKCU\\Software\\Classes\\ConfigurationFileExtension`;
  execSync(`reg add "${officialProgIdKey}" /ve /t REG_SZ /d "SEB Configuration File" /f`, { stdio: 'ignore' });
  execSync(`reg add "${officialProgIdKey}\\DefaultIcon" /ve /t REG_SZ /d "\\"${targetExe}\\",0" /f`, { stdio: 'ignore' });
  execSync(`reg add "${officialProgIdKey}\\shell\\open\\command" /ve /t REG_SZ /d "${commandString}" /f`, { stdio: 'ignore' });

  // Clean up any stale UserChoice
  try {
    execSync(`reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.seb\\UserChoice" /f`, { stdio: 'ignore' });
  } catch {
    // Ignored
  }

  // Ensure OpenWithProgids points to FSEB
  try {
    execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.seb\\OpenWithProgids" /v "FSEB.Configuration" /t REG_NONE /f`, { stdio: 'ignore' });
  } catch {
    // Ignored
  }

  console.log(`\nSUCCESS: FSEB is now registered for seb://, sebs://, seb-config and .seb files.`);
  console.log(`When you double click a .seb file or click "Open in Safe Exam Browser" in Google Chrome, it will launch FSEB directly!`);
} catch (err) {
  console.error('Failed to register in Windows Registry:', err);
  process.exit(1);
}
