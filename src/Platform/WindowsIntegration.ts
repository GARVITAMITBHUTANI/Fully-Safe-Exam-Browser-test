import * as path from 'path';
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
    for (const rawArg of argv) {
      if (typeof rawArg !== 'string') continue;
      const arg = rawArg.trim().replace(/^"(.*)"$/, '$1');

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
      if (lower.endsWith('.seb') || (lower.endsWith('.json') && !lower.endsWith('package.json'))) {
        const resolved = path.resolve(arg);
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
      if (app) {
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
   * "Open in Safe Exam Browser" in Chrome / Edge / Firefox launches FSEB immediately!
   */
  public static registerWindowsUserRegistry(exePath?: string): boolean {
    if (process.platform !== 'win32') return false;

    const isPackaged = app ? app.isPackaged : false;
    let commandString: string;

    if (exePath) {
      commandString = `\\"${exePath}\\" \\"%1\\"`;
    } else if (isPackaged && app) {
      commandString = `\\"${app.getPath('exe')}\\" \\"%1\\"`;
    } else {
      // In development mode, command must launch electron with project directory
      const electronExe = process.execPath;
      const projectDir = path.resolve(process.argv[1] || '.');
      commandString = `\\"${electronExe}\\" \\"${projectDir}\\" \\"%1\\"`;
    }

    this.logger.info('WindowsIntegration', `Registering FSEB in Windows Registry with command: ${commandString}`);

    try {
      const protocols = ['seb', 'sebs', 'seb-config'];
      for (const proto of protocols) {
        const keyBase = `HKCU\\Software\\Classes\\${proto}`;
        execSync(`reg add "${keyBase}" /ve /t REG_SZ /d "URL:Safe Exam Browser Protocol" /f`, { stdio: 'ignore' });
        execSync(`reg add "${keyBase}" /v "URL Protocol" /t REG_SZ /d "" /f`, { stdio: 'ignore' });
        execSync(`reg add "${keyBase}\\shell\\open\\command" /ve /t REG_SZ /d "${commandString}" /f`, { stdio: 'ignore' });
      }

      // Also register .seb file extension in HKCU
      const fileExtKey = `HKCU\\Software\\Classes\\.seb`;
      const progIdKey = `HKCU\\Software\\Classes\\FSEB.Configuration`;
      execSync(`reg add "${fileExtKey}" /ve /t REG_SZ /d "FSEB.Configuration" /f`, { stdio: 'ignore' });
      execSync(`reg add "${progIdKey}" /ve /t REG_SZ /d "FSEB Exam Configuration File" /f`, { stdio: 'ignore' });
      execSync(`reg add "${progIdKey}\\shell\\open\\command" /ve /t REG_SZ /d "${commandString}" /f`, { stdio: 'ignore' });

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
      this.logger.info('WindowsIntegration', 'Unregistered FSEB protocol handlers from Windows Registry.');
      return true;
    } catch {
      return false;
    }
  }
}
