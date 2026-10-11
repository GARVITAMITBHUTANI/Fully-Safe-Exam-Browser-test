import * as path from 'path';
import { BrowserWindow, dialog, ipcMain, app } from 'electron';
import { ExamSession, SessionState } from '../Core/ExamSession';
import { BrowserHost } from '../Browser/BrowserHost';
import { SebLoader } from '../Configuration/SebLoader';
import { AppConfiguration } from '../Core/AppConfiguration';
import { Logger } from '../Core/Logger';

export class MainWindow {
  private static readonly logger = Logger.getInstance();
  private window: BrowserWindow | null = null;
  private browserHost: BrowserHost | null = null;
  private readonly session: ExamSession;
  private currentSebPath: string | null = null;

  constructor(session: ExamSession) {
    this.session = session;
    this.registerIpcHandlers();
    this.subscribeToSessionEvents();
  }

  public getWindow(): BrowserWindow | null {
    return this.window;
  }

  /**
   * Creates and initializes the primary desktop window
   */
  public createWindow(): BrowserWindow {
    MainWindow.logger.info('MainWindow', 'Creating main window...');

    this.window = new BrowserWindow({
      width: 1024,
      height: 768,
      minWidth: 800,
      minHeight: 600,
      center: true,
      backgroundColor: '#00000000',
      transparent: true,
      show: false,
      autoHideMenuBar: true,
      frame: false,
      webPreferences: {
        preload: path.join(__dirname, '../Preload/preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    // Initialize Chromium BrowserHost for exam viewing
    this.browserHost = new BrowserHost({
      parentWindow: this.window,
      policy: this.session.getPolicy(),
      onPageTitleUpdated: (title) => {
        if (this.window && !this.window.isDestroyed()) {
          this.window.setTitle(`${title} — FSEB`);
        }
      },
      onLoadError: (errorDesc) => {
        this.session.transitionTo(SessionState.ERROR, { error: `Network error: ${errorDesc}` });
      },
      onQuitRequested: () => {
        this.showQuitConfirmation();
      },
    });

    // Window focus and blur handling (window switching support)
    this.window.on('focus', () => {
      this.session.handleFocusChange(true);
    });

    this.window.on('blur', () => {
      this.session.handleFocusChange(false);
    });

    this.window.on('resize', () => {
      if (this.session.getState() === SessionState.EXAM_RUNNING && this.browserHost) {
        this.browserHost.resizeToParent();
      }
    });

    // Load initial UI shell (Start screen)
    const viewPath = path.join(__dirname, 'views/index.html');
    this.window.loadFile(viewPath);

    this.window.once('ready-to-show', () => {
      if (this.window) {
        this.window.show();
        this.session.transitionTo(SessionState.READY);
      }
    });

    this.window.on('closed', () => {
      this.browserHost?.destroy();
      this.browserHost = null;
      this.window = null;
    });

    return this.window;
  }

  /**
   * Loads an exam from a target (.seb file path, seb:// / sebs:// protocol URL, or web URL)
   */
  public async loadExamFromTarget(target: string): Promise<boolean> {
    this.currentSebPath = target;
    MainWindow.logger.info('MainWindow', `Initiating exam load from target: ${target}`);

    this.session.transitionTo(SessionState.LOADING_CONFIGURATION, { target });

    const loadResult = await SebLoader.loadFromTarget(target);
    if (!loadResult.success || !loadResult.configuration) {
      MainWindow.logger.error('MainWindow', 'Failed to load or validate target configuration', { error: loadResult.error });
      this.session.transitionTo(SessionState.ERROR, {
        error: loadResult.error || 'Failed to load configuration.',
      });
      return false;
    }

    this.session.transitionTo(SessionState.VALIDATING_CONFIGURATION);
    const config = loadResult.configuration;
    this.session.attachConfiguration(config);

    if (this.browserHost) {
      this.browserHost.updatePolicy(this.session.getPolicy());
    }

    // Apply window policy (e.g., fullscreen)
    if (this.window) {
      this.session.getPolicy().window.applyPolicyToWindow(this.window);
    }

    this.session.transitionTo(SessionState.STARTING_EXAM, { startUrl: config.startUrl });

    try {
      if (!this.browserHost) {
        throw new Error('Browser host is not initialized');
      }

      await this.browserHost.loadExamUrl(config.startUrl);
      this.browserHost.show();
      this.session.transitionTo(SessionState.EXAM_RUNNING, { startUrl: config.startUrl });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      MainWindow.logger.error('MainWindow', `Failed to start exam session: ${msg}`);
      this.session.transitionTo(SessionState.ERROR, { error: `Failed to load exam start URL: ${msg}` });
      return false;
    }
  }

  public async loadExamFromSeb(filePath: string): Promise<boolean> {
    return this.loadExamFromTarget(filePath);
  }

  private registerIpcHandlers(): void {
    ipcMain.handle('fseb:open-file-picker', async () => {
      if (!this.window) return null;

      const result = await dialog.showOpenDialog(this.window, {
        title: 'Open Exam Configuration',
        buttonLabel: 'Select Configuration',
        filters: [
          { name: 'Safe Exam Browser Config (*.seb)', extensions: ['seb'] },
          { name: 'JSON Exam Config (*.json)', extensions: ['json'] },
          { name: 'All Files (*.*)', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
      }
      return null;
    });

    ipcMain.handle('fseb:start-exam', async (_event, filePath: string) => {
      return this.loadExamFromSeb(filePath);
    });

    ipcMain.handle('fseb:retry-loading', async () => {
      if (this.currentSebPath) {
        await this.loadExamFromSeb(this.currentSebPath);
      } else {
        this.session.resetToReady();
      }
    });

    ipcMain.handle('fseb:reload-exam', async () => {
      this.browserHost?.reloadExam();
    });

    ipcMain.handle('fseb:request-quit-confirm', async () => {
      await this.showQuitConfirmation();
    });

    ipcMain.handle('fseb:close-app', async () => {
      await this.showQuitConfirmation();
    });

    ipcMain.handle('fseb:get-app-info', async () => {
      const appConfig = AppConfiguration.getInstance();
      return {
        name: appConfig.metadata.name,
        version: appConfig.metadata.version,
      };
    });
  }

  public async showQuitConfirmation(): Promise<void> {
    if (!this.window) return;
    const result = await dialog.showMessageBox(this.window, {
      type: 'question',
      buttons: ['Quit Exam', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Quit Safe Exam Browser',
      message: 'Are you sure you want to quit the exam session?',
      detail: 'Exiting now will terminate your exam attempt. Any unsaved answers may be lost.',
      noLink: true,
    });
    if (result.response === 0) {
      MainWindow.logger.info('MainWindow', 'User confirmed exam quit. Closing application.');
      this.session.transitionTo(SessionState.CLOSING);
      app.quit();
    }
  }

  private subscribeToSessionEvents(): void {
    this.session.on('stateChange', (event) => {
      // Notify renderer
      if (this.window && !this.window.isDestroyed() && this.window.webContents) {
        this.window.webContents.send('fseb:state-update', {
          state: event.currentState,
          details: event.metadata,
        });
      }

      // Hide browser view if returned to ERROR, READY, or LOADING
      if (
        event.currentState === SessionState.ERROR ||
        event.currentState === SessionState.READY ||
        event.currentState === SessionState.LOADING_CONFIGURATION
      ) {
        this.browserHost?.hide();
      }
    });
  }
}

