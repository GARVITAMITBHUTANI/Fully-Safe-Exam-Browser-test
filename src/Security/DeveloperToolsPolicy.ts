import { WebContents } from 'electron';
import { ExamConfiguration } from '../Configuration/ExamConfiguration';
import { Logger } from '../Core/Logger';

export class DeveloperToolsPolicy {
  private static readonly logger = Logger.getInstance();
  private config: ExamConfiguration;

  constructor(config: ExamConfiguration) {
    this.config = config;
  }

  public updateConfiguration(config: ExamConfiguration): void {
    this.config = config;
  }

  public canOpenDevTools(): boolean {
    return this.config.developerTools;
  }

  /**
   * Attaches enforcement listeners to the provided WebContents.
   */
  public enforce(webContents: WebContents): void {
    if (!this.config.developerTools) {
      webContents.on('devtools-opened', () => {
        DeveloperToolsPolicy.logger.warn('DeveloperToolsPolicy', 'Unauthorized DevTools open detected. Forcing close.');
        webContents.closeDevTools();
      });
    }
  }
}

