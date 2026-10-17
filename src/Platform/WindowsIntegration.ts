import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { app } from 'electron';
import { Logger } from '../Core/Logger';

export class WindowsIntegration {
  private static readonly logger = Logger.getInstance();

  /**
   * Parses command-line arguments to find a launch target:
   * - local .seb or .json file
   * - seb://, sebs://, or seb-config protocol URL (e.g. from Chrome)
   * - https:// or http:// exam URL
   */
  public static extractLaunchTarget(argv: string[]): string | null {
    if (!Array.isArray(argv)) return null;

    for (const rawArg of argv) {
      if (typeof rawArg !== 'string') continue;
      let arg = rawArg.trim();

      // Strip escaped or normal outer quotes (e.g. "\"file.seb\"" or '"file.seb"')
      arg = arg.replace(/^["']+|["']+$/g, '').trim();
      arg = arg.replace(/^[\\"]+|[\\"]+$/g, '').trim();
      arg = arg.replace(/^["']+|["']+$/g, '').trim();

      if (!arg) continue;

      // Skip standard Electron/Chromium flags
      if (arg.startsWith('--') || arg === '.') continue;

      // Strip file:/// prefix if passed by browser
      if (arg.toLowerCase().startsWith('file:///')) {
        arg = decodeURIComponent(arg.replace(/^file:\/\/\/?/i, ''));
        // On Windows, fix /C:/ to C:/
        if (/^\/[a-zA-Z]:/.test(arg)) {
          arg = arg.slice(1);
        }
      }

      // 1. Protocol links from browsers (seb://, sebs://, seb-config:, seb-config?, etc.)
      const lower = arg.toLowerCase();
      if (
        lower.startsWith('seb://') ||
        lower.startsWith('sebs://') ||
        lower.startsWith('seb-config:') ||
        lower.startsWith('seb-config?') ||
        lower.startsWith('seb-config//')
      ) {
        this.logger.info('WindowsIntegration', `Found protocol URL target: ${arg}`);
        return arg;
      }

      // 2. Local exam configuration file (.seb, .json)
      const cleanPath = arg.split('?')[0].replace(/[/\\]+$/, '');
      if (cleanPath.toLowerCase().endsWith('.seb') || (cleanPath.toLowerCase().endsWith('.json') && !cleanPath.endsWith('package.json'))) {
        const resolved = path.resolve(cleanPath);
        this.logger.info('WindowsIntegration', `Found file target: ${resolved}`);
        return resolved;
      }

      // 3. Direct http/https URL passed via CLI
      if (lower.startsWith('http://') || lower.startsWith('https://')) {
        this.logger.info('WindowsIntegration', `Found direct web URL target: ${arg}`);
        return arg;
      }
    }
    return null;
  }

  /**
   * Backward-compatibility alias for extractLaunchTarget
   */
  public static extractSebFilePath(argv: string[]): string | null {
    return this.extractLaunchTarget(argv);
  }

  /**
   * Registers FSEB with Electron as the default handler for seb://, sebs://, and seb-config
   */
  public static registerProtocolClients(): void {
    if (!process.platform || process.platform !== 'win32') {
      return;
    }

    const protocols = ['seb', 'sebs', 'seb-config'];

    try {
      if (app && typeof app.setAsDefaultProtocolClient === 'function') {
        const isPackaged = app.isPackaged;
        for (const proto of protocols) {
          if (isPackaged) {
            app.setAsDefaultProtocolClient(proto);
          } else {
            // In development, specify execPath and project args so Windows forwards correctly
            const appPath = path.resolve(process.argv[1] || '.');
            app.setAsDefaultProtocolClient(proto, process.execPath, [appPath]);
          }
        }
        this.logger.info('WindowsIntegration', `Registered protocols (${protocols.join(', ')}) in Electron.`);
      }
    } catch (err) {
      this.logger.warn('WindowsIntegration', 'Failed to register protocol client with Electron', { error: String(err) });
    }
  }

  /**
   * Registers FSEB directly in Windows User Registry (HKCU) so that clicking
   * "Open in Safe Exam Browser" in Chrome / Edge / Firefox or double-clicking .seb
   * launches FSEB immediately without "Electron not located" errors.
   */
  public static registerWindowsUserRegistry(exePath?: string): boolean {
    if (process.platform !== 'win32') return false;

    // Determine target executable and open command
    const appPath = app && typeof app.getAppPath === 'function' ? app.getAppPath() : process.cwd();
    const packagedExe = path.join(appPath, 'release', 'win-unpacked', 'FSEB.exe');
    const isPackaged = app ? Boolean(app.isPackaged) : false;

    let targetExe: string;
    let openCommand: string;

    if (exePath) {
      targetExe = exePath;
      openCommand = `"${targetExe}" "%1"`;
    } else if (isPackaged && app && typeof app.getPath === 'function') {
      targetExe = app.getPath('exe');
      openCommand = `"${targetExe}" "%1"`;
    } else if (fs.existsSync(packagedExe)) {
      targetExe = packagedExe;
      openCommand = `"${targetExe}" "%1"`;
    } else {
      // In development when packaged executable is not built yet,
      // pass the app directory to electron so it doesn't fail with "Electron not located"
      const electronExe = app && typeof app.getPath === 'function' ? app.getPath('exe') : process.execPath;
      targetExe = electronExe;
      openCommand = `"${electronExe}" "${appPath}" "%1"`;
    }

    this.logger.info('WindowsIntegration', `Registering FSEB in Windows Registry for target: ${targetExe} with command: ${openCommand}`);

    try {
      const escapedOpenCmd = openCommand.replace(/"/g, '\\"');
      const protocols = ['seb', 'sebs', 'seb-config'];
      for (const proto of protocols) {
        const keyBase = `HKCU\\Software\\Classes\\${proto}`;
        execSync(`reg add "${keyBase}" /ve /t REG_SZ /d "URL:Safe Exam Browser Protocol" /f`, { stdio: 'ignore' });
        execSync(`reg add "${keyBase}" /v "URL Protocol" /t REG_SZ /d "" /f`, { stdio: 'ignore' });
        execSync(`reg add "${keyBase}\\DefaultIcon" /ve /t REG_SZ /d "\\"${targetExe}\\",0" /f`, { stdio: 'ignore' });
        execSync(`reg add "${keyBase}\\shell\\open\\command" /ve /t REG_SZ /d "${escapedOpenCmd}" /f`, { stdio: 'ignore' });
      }

      // Register .seb file extension in HKCU
      const fileExtKey = `HKCU\\Software\\Classes\\.seb`;
      const progIdKey = `HKCU\\Software\\Classes\\FSEB.Configuration`;
      execSync(`reg add "${fileExtKey}" /ve /t REG_SZ /d "FSEB.Configuration" /f`, { stdio: 'ignore' });
      execSync(`reg add "${progIdKey}" /ve /t REG_SZ /d "FSEB Exam Configuration File" /f`, { stdio: 'ignore' });
      execSync(`reg add "${progIdKey}\\DefaultIcon" /ve /t REG_SZ /d "\\"${targetExe}\\",0" /f`, { stdio: 'ignore' });
      execSync(`reg add "${progIdKey}\\shell\\open\\command" /ve /t REG_SZ /d "${escapedOpenCmd}" /f`, { stdio: 'ignore' });

      // Also override ConfigurationFileExtension (used by official SEB) in HKCU
      const officialProgIdKey = `HKCU\\Software\\Classes\\ConfigurationFileExtension`;
      execSync(`reg add "${officialProgIdKey}" /ve /t REG_SZ /d "SEB Configuration File" /f`, { stdio: 'ignore' });
      execSync(`reg add "${officialProgIdKey}\\DefaultIcon" /ve /t REG_SZ /d "\\"${targetExe}\\",0" /f`, { stdio: 'ignore' });
      execSync(`reg add "${officialProgIdKey}\\shell\\open\\command" /ve /t REG_SZ /d "${escapedOpenCmd}" /f`, { stdio: 'ignore' });

      // Clean up any stale UserChoice in Explorer that might point to a non-existent or broken executable
      try {
        execSync(`reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.seb\\UserChoice" /f`, { stdio: 'ignore' });
      } catch {
        // Ignored if UserChoice doesn't exist
      }

      // Ensure FSEB.Configuration is registered in OpenWithProgids
      try {
        execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.seb\\OpenWithProgids" /v "FSEB.Configuration" /t REG_NONE /f`, { stdio: 'ignore' });
      } catch {
        // Ignored
      }

      this.logger.info('WindowsIntegration', 'Successfully registered FSEB for seb, sebs, seb-config, and .seb in Windows Registry.');
      return true;
    } catch (err) {
      this.logger.error('WindowsIntegration', 'Failed to write Windows registry keys', { error: String(err) });
      return false;
    }
  }

  /**
   * Removes HKCU overrides if user wants to restore standard system defaults
   */
  public static unregisterWindowsUserRegistry(): boolean {
    if (process.platform !== 'win32') return false;

    try {
      execSync(`reg delete "HKCU\\Software\\Classes\\seb" /f`, { stdio: 'ignore' });
      execSync(`reg delete "HKCU\\Software\\Classes\\sebs" /f`, { stdio: 'ignore' });
      execSync(`reg delete "HKCU\\Software\\Classes\\seb-config" /f`, { stdio: 'ignore' });
      execSync(`reg delete "HKCU\\Software\\Classes\\.seb" /f`, { stdio: 'ignore' });
      execSync(`reg delete "HKCU\\Software\\Classes\\FSEB.Configuration" /f`, { stdio: 'ignore' });
      execSync(`reg delete "HKCU\\Software\\Classes\\ConfigurationFileExtension" /f`, { stdio: 'ignore' });
      this.logger.info('WindowsIntegration', 'Unregistered FSEB protocol handlers from Windows Registry.');
      return true;
    } catch {
      return false;
    }
  }
}
