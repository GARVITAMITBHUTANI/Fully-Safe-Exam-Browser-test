const { execSync } = require('child_process');

console.log('Unregistering FSEB protocol handlers and file associations from Windows Registry...');

try {
  execSync(`reg delete "HKCU\\Software\\Classes\\seb" /f`, { stdio: 'ignore' });
  execSync(`reg delete "HKCU\\Software\\Classes\\sebs" /f`, { stdio: 'ignore' });
  execSync(`reg delete "HKCU\\Software\\Classes\\seb-config" /f`, { stdio: 'ignore' });
  execSync(`reg delete "HKCU\\Software\\Classes\\.seb" /f`, { stdio: 'ignore' });
  execSync(`reg delete "HKCU\\Software\\Classes\\FSEB.Configuration" /f`, { stdio: 'ignore' });
  console.log('SUCCESS: Removed FSEB user-level associations (seb, sebs, seb-config, .seb).');
} catch (err) {
  console.log('No user-level keys found or already removed.');
}
