import { ExamConfiguration } from '../Configuration/ExamConfiguration';
import { Logger } from '../Core/Logger';

export class ClipboardPolicy {
  private static readonly logger = Logger.getInstance();
  private config: ExamConfiguration;

  constructor(config: ExamConfiguration) {
    this.config = config;
  }

  public updateConfiguration(config: ExamConfiguration): void {
    this.config = config;
  }

  /**
   * Evaluates if text copying is permitted.
   */
  public canCopy(): boolean {
    const allowed = this.config.clipboard.copy;
    ClipboardPolicy.logger.debug('ClipboardPolicy', `canCopy evaluated: ${allowed}`);
    return allowed;
  }

  /**
   * Evaluates if text pasting is permitted.
   * Note: NEVER read, inspect, or log the actual clipboard content.
   */
  public canPaste(): boolean {
    const allowed = this.config.clipboard.paste;
    ClipboardPolicy.logger.debug('ClipboardPolicy', `canPaste evaluated: ${allowed}`);
    return allowed;
  }

  /**
   * Evaluates if selecting all text is permitted.
   */
  public canSelectAll(): boolean {
    const allowed = this.config.clipboard.selectAll;
    ClipboardPolicy.logger.debug('ClipboardPolicy', `canSelectAll evaluated: ${allowed}`);
    return allowed;
  }
}

