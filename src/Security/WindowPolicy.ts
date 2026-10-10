import { BrowserWindow } from 'electron';
import { ExamConfiguration } from '../Configuration/ExamConfiguration';
import { Logger } from '../Core/Logger';

export class WindowPolicy {
  private static readonly logger = Logger.getInstance();
  private config: ExamConfiguration;

  constructor(config: ExamConfiguration) {
    this.config = config;
  }

  public updateConfiguration(config: ExamConfiguration): void {
    this.config = config;
  }

  public isWindowSwitchingAllowed(): boolean {
    return this.config.windowSwitching;
  }

  public isFullscreenRequired(): boolean {
    return this.config.fullscreen;
  }

  /**
   * Applies the window presentation policy to the given window.
   */
  public applyPolicyToWindow(window: BrowserWindow): void {
    WindowPolicy.logger.info('WindowPolicy', 'Applying window presentation policy', {
      fullscreen: this.config.fullscreen,
      windowSwitching: this.config.windowSwitching,
    });

    if (this.config.fullscreen) {
      window.setFullScreen(true);
      window.setMenuBarVisibility(false);
      window.setAutoHideMenuBar(true);
    } else {
      window.setFullScreen(false);
      window.maximize();
    }
  }

  /**
   * Restores normal window state if needed.
   */
  public exitFullscreen(window: BrowserWindow): void {
    if (window && !window.isDestroyed()) {
      window.setFullScreen(false);
    }
  }
}

