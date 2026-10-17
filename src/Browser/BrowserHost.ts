import * as path from 'path';
import { BrowserView, BrowserWindow, Menu, MenuItem } from 'electron';
import { ExamPolicy } from '../Core/ExamPolicy';
import { Logger } from '../Core/Logger';

export interface BrowserHostOptions {
  parentWindow: BrowserWindow;
  policy: ExamPolicy;
  onPageTitleUpdated?: (title: string) => void;
  onLoadingStatusChanged?: (isLoading: boolean) => void;
  onLoadError?: (errorDescription: string) => void;
  onQuitRequested?: () => void;
}

export class BrowserHost {
  private static readonly logger = Logger.getInstance();
  private browserView: BrowserView | null = null;
  private readonly parentWindow: BrowserWindow;
  private policy: ExamPolicy;
  private options: BrowserHostOptions;

  constructor(options: BrowserHostOptions) {
    this.options = options;
    this.parentWindow = options.parentWindow;
    this.policy = options.policy;
  }

  public getWebContents() {
    return this.browserView?.webContents;
  }

  public updatePolicy(policy: ExamPolicy): void {
    this.policy = policy;
  }

  /**
   * Initializes the Chromium BrowserView and attaches security and navigation policies
   */
  public initialize(): void {
    if (this.browserView) {
      return;
    }

    BrowserHost.logger.info('BrowserHost', 'Initializing Chromium BrowserHost with Safe Exam Browser emulation...');

    const sebVer = this.policy.getConfiguration().compatibility.sebVersion || '3.10.2';
    const customUserAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SEB/${sebVer}`;

    this.browserView = new BrowserView({
      webPreferences: {
        preload: path.join(__dirname, '../Preload/exam-preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        spellcheck: this.policy.browser.isSpellCheckEnabled(),
      },
    });

    const webContents = this.browserView.webContents;
    webContents.setUserAgent(customUserAgent);

    this.parentWindow.addBrowserView(this.browserView);
    this.resizeToParent();

    // 1. Keyboard event policy interception
    webContents.on('before-input-event', (event, input) => {
      const decision = this.policy.evaluateKey({
        type: input.type,
        key: input.key,
        code: input.code,
        control: input.control,
        alt: input.alt,
        shift: input.shift,
        meta: input.meta,
        isAutoRepeat: input.isAutoRepeat,
      });

      if (!decision.allowed) {
        event.preventDefault();
      }
    });

    // 2. Navigation interception (will-navigate)
    webContents.on('will-navigate', (event, navigationUrl) => {
      // Check for SEB quit URL navigation (e.g. /quit-seb or configured quitURL)
      const quitUrl = this.policy.getConfiguration().taskbar.quitUrl;
      if (navigationUrl.includes('/quit-seb') || (quitUrl && navigationUrl.includes(quitUrl))) {
        event.preventDefault();
        BrowserHost.logger.info('BrowserHost', `Quit URL detected: ${navigationUrl}. Prompting user to quit.`);
        this.options.onQuitRequested?.();
        return;
      }

      const decision = this.policy.evaluateNavigation(navigationUrl);
      if (!decision.allowed) {
        event.preventDefault();
        BrowserHost.logger.warn('BrowserHost', `Blocked navigation to: ${navigationUrl}`, {
          reason: decision.reason,
        });
      } else {
        BrowserHost.logger.info('BrowserHost', `Allowed navigation to: ${navigationUrl}`);
      }
    });

    // 3. Navigation redirection (will-redirect)
    webContents.on('will-redirect', (event, redirectUrl) => {
      const quitUrl = this.policy.getConfiguration().taskbar.quitUrl;
      if (redirectUrl.includes('/quit-seb') || (quitUrl && redirectUrl.includes(quitUrl))) {
        event.preventDefault();
        BrowserHost.logger.info('BrowserHost', `Quit redirect detected: ${redirectUrl}. Prompting user to quit.`);
        this.options.onQuitRequested?.();
        return;
      }

      const decision = this.policy.evaluateNavigation(redirectUrl);
      if (!decision.allowed) {
        event.preventDefault();
        BrowserHost.logger.warn('BrowserHost', `Blocked redirect to: ${redirectUrl}`, {
          reason: decision.reason,
        });
      }
    });

    // 4. Popups / new window requests interception
    webContents.setWindowOpenHandler((details) => {
      const decision = this.policy.evaluateNavigation(details.url);
      if (!decision.allowed || this.policy.browser.shouldBlockPopups()) {
        BrowserHost.logger.warn('BrowserHost', `Blocked popup to: ${details.url}`, {
          reason: decision.reason,
        });
        return { action: 'deny' };
      }

      // If allowed by navigation policy and not blocking popups, navigate in place
      webContents.loadURL(details.url);
      return { action: 'deny' };
    });

    // 5. Developer tools restriction
    webContents.on('devtools-opened', () => {
      if (!this.policy.devTools.canOpenDevTools()) {
        BrowserHost.logger.warn('BrowserHost', 'DevTools opened without permission. Closing immediately.');
        webContents.closeDevTools();
      }
    });

    // 6. Controlled context menu (permitting copy/paste/selectAll only)
    webContents.on('context-menu', (_event, params) => {
      const menu = new Menu();

      if (this.policy.clipboard.canCopy() && params.selectionText.trim().length > 0) {
        menu.append(new MenuItem({ label: 'Copy', role: 'copy' }));
      }

      if (this.policy.clipboard.canPaste() && params.isEditable) {
        menu.append(new MenuItem({ label: 'Paste', role: 'paste' }));
      }

      if (this.policy.clipboard.canSelectAll()) {
        menu.append(new MenuItem({ label: 'Select All', role: 'selectAll' }));
      }

      // If page is allowed to reload
      if (this.policy.getConfiguration().navigation.allowReload) {
        menu.append(new MenuItem({ type: 'separator' }));
        menu.append(
          new MenuItem({
            label: 'Reload Exam Page',
            click: () => webContents.reload(),
          })
        );
      }

      // Only display menu if it has allowed actions
      if (menu.items.length > 0) {
        menu.popup({ window: this.parentWindow });
      }
    });

    // 7. Loading lifecycle events
    webContents.on('did-start-loading', () => {
      this.options.onLoadingStatusChanged?.(true);
    });

    webContents.on('did-stop-loading', () => {
      this.options.onLoadingStatusChanged?.(false);
    });

    webContents.on('page-title-updated', (_event, title) => {
      this.options.onPageTitleUpdated?.(title);
    });

    webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      if (errorCode === -3) return; // ERR_ABORTED

      BrowserHost.logger.error('BrowserHost', `Failed to load URL: ${validatedURL}`, {
        errorCode,
        errorDescription,
      });
      this.options.onLoadError?.(`${errorDescription} (${errorCode})`);
    });

    // 8. Download management
    webContents.session.on('will-download', (event, item) => {
      const decision = this.policy.evaluateDownload(item.getURL(), item.getFilename());
      if (!decision.allowed) {
        event.preventDefault();
        item.cancel();
      }
    });
  }

  /**
   * Loads the configured exam URL into the Chromium view
   */
  public async loadExamUrl(url: string): Promise<void> {
    if (!this.browserView) {
      this.initialize();
    }

    BrowserHost.logger.info('BrowserHost', `Loading exam start URL: ${url}`);
    await this.browserView!.webContents.loadURL(url);
  }

  public reloadExam(): void {
    if (this.browserView) {
      this.browserView.webContents.reload();
    }
  }

  private sidePanelWidth: number = 0;

  /**
   * Captures the current visible rendered screen of the exam page as a JPEG buffer
   */
  public async captureScreen(): Promise<{ imageBuffer: Buffer; base64: string } | null> {
    if (!this.browserView || !this.browserView.webContents) {
      return null;
    }
    const nativeImg = await this.browserView.webContents.capturePage();
    const imageBuffer = nativeImg.toJPEG(85);
    const base64 = imageBuffer.toString('base64');
    return { imageBuffer, base64 };
  }

  /**
   * Safely extracts text content or active selection from the exam page
   */
  public async extractPageText(): Promise<string> {
    if (!this.browserView || !this.browserView.webContents) {
      return '';
    }
    try {
      const text = await this.browserView.webContents.executeJavaScript(
        'window.getSelection()?.toString() || document.body?.innerText || ""'
      );
      return typeof text === 'string' ? text.slice(0, 5000) : '';
    } catch {
      return '';
    }
  }

  /**
   * Sets the width reserved for the AI assistant side panel
   */
  public setSidePanelWidth(width: number): void {
    this.sidePanelWidth = Math.max(0, width);
    this.resizeToParent();
  }

  /**
   * Resizes the embedded BrowserView to completely fill the parent window,
   * reserving space for the authentic SEB bottom taskbar and side panel if enabled.
   */
  public resizeToParent(): void {
    if (!this.browserView || this.parentWindow.isDestroyed()) return;

    const bounds = this.parentWindow.getContentBounds();
    const config = this.policy.getConfiguration();
    const taskbarHeight = config.taskbar?.showTaskBar ? (config.taskbar.taskBarHeight || 40) : 0;
    const availableWidth = Math.max(300, bounds.width - this.sidePanelWidth);

    this.browserView.setBounds({
      x: 0,
      y: 0,
      width: availableWidth,
      height: Math.max(100, bounds.height - taskbarHeight),
    });
  }

  /**
   * Temporarily hides or detaches the browser view
   */
  public hide(): void {
    if (this.browserView && !this.parentWindow.isDestroyed()) {
      this.parentWindow.removeBrowserView(this.browserView);
    }
  }

  /**
   * Re-attaches the browser view
   */
  public show(): void {
    if (this.browserView && !this.parentWindow.isDestroyed()) {
      this.parentWindow.addBrowserView(this.browserView);
      this.resizeToParent();
    }
  }

  /**
   * Cleans up and destroys the browser view
   */
  public destroy(): void {
    if (this.browserView) {
      try {
        this.hide();
        (this.browserView.webContents as unknown as { destroy?: () => void })?.destroy?.();
      } catch (err) {
        BrowserHost.logger.warn('BrowserHost', 'Error during browser view cleanup', { error: String(err) });
      }
      this.browserView = null;
    }
  }
}
