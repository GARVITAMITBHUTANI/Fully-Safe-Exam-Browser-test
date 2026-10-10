import { ExamConfiguration } from '../Configuration/ExamConfiguration';
import { Logger } from '../Core/Logger';

export class BrowserPolicy {
  private static readonly logger = Logger.getInstance();
  private config: ExamConfiguration;

  constructor(config: ExamConfiguration) {
    this.config = config;
  }

  public updateConfiguration(config: ExamConfiguration): void {
    this.config = config;
  }

  /**
   * Evaluates permission requests from the web exam application.
   */
  public evaluatePermission(permission: string): boolean {
    BrowserPolicy.logger.info('BrowserPolicy', `Evaluating web permission request: ${permission}`);

    switch (permission) {
      case 'media':
      case 'camera':
      case 'microphone':
        // Allow if exam media is enabled
        return this.config.browser.allowAudio || this.config.browser.allowVideo;
      case 'notifications':
        return false;
      case 'geolocation':
        return false;
      case 'openExternal':
        return false;
      default:
        return false;
    }
  }

  public shouldBlockPopups(): boolean {
    return this.config.navigation.blockPopups;
  }

  public isSpellCheckEnabled(): boolean {
    return this.config.browser.allowSpellCheck;
  }
}

