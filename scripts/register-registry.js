const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Path to packaged FSEB or local electron
let targetExe = path.join(__dirname, '..', 'release', 'win-unpacked', 'FSEB.exe');
if (!fs.existsSync(targetExe)) {
  console.log(`Packaged FSEB.exe not found at ${targetExe}. Building package first...`);
  execSync('npm run pack', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
}

console.log(`Registering FSEB as default handler for Chrome and Windows...`);
console.log(`Executable target: ${targetExe}`);

try {
  const protocols = ['seb', 'sebs'];
  for (const proto of protocols) {
    const keyBase = `HKCU\\Software\\Classes\\${proto}`;
    execSync(`reg add "${keyBase}" /ve /t REG_SZ /d "URL:Safe Exam Browser Protocol" /f`, { stdio: 'ignore' });
    execSync(`reg add "${keyBase}" /v "URL Protocol" /t REG_SZ /d "" /f`, { stdio: 'ignore' });
    execSync(`reg add "${keyBase}\\DefaultIcon" /ve /t REG_SZ /d "\\"${targetExe}\\",0" /f`, { stdio: 'ignore' });
    execSync(`reg add "${keyBase}\\shell\\open\\command" /ve /t REG_SZ /d "\\"${targetExe}\\" \\"%1\\"" /f`, { stdio: 'ignore' });
  }

  // Also register .seb file extension
  const fileExtKey = `HKCU\\Software\\Classes\\.seb`;
  const progIdKey = `HKCU\\Software\\Classes\\FSEB.Configuration`;
  execSync(`reg add "${fileExtKey}" /ve /t REG_SZ /d "FSEB.Configuration" /f`, { stdio: 'ignore' });
  execSync(`reg add "${progIdKey}" /ve /t REG_SZ /d "FSEB Exam Configuration File" /f`, { stdio: 'ignore' });
  execSync(`reg add "${progIdKey}\\DefaultIcon" /ve /t REG_SZ /d "\\"${targetExe}\\",0" /f`, { stdio: 'ignore' });
  execSync(`reg add "${progIdKey}\\shell\\open\\command" /ve /t REG_SZ /d "\\"${targetExe}\\" \\"%1\\"" /f`, { stdio: 'ignore' });

  console.log(`\nSUCCESS: FSEB is now registered for seb://, sebs:// and .seb files.`);
  console.log(`When you click "Open in Safe Exam Browser" in Google Chrome, it will now launch FSEB!`);
} catch (err) {
  console.error('Failed to register in Windows Registry:', err);
  process.exit(1);
}

