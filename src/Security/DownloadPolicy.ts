import { ExamConfiguration } from '../Configuration/ExamConfiguration';
import { Logger } from '../Core/Logger';

export interface DownloadDecision {
  allowed: boolean;
  reason?: string;
}

export class DownloadPolicy {
  private static readonly logger = Logger.getInstance();
  private config: ExamConfiguration;

  constructor(config: ExamConfiguration) {
    this.config = config;
  }

  public updateConfiguration(config: ExamConfiguration): void {
    this.config = config;
  }

  public evaluateDownload(url: string, filename: string): DownloadDecision {
    if (this.config.downloads) {
      DownloadPolicy.logger.info('DownloadPolicy', `Permitting download of "${filename}" based on configuration.`);
      return { allowed: true };
    }

    const reason = `File download of "${filename}" blocked by exam security policy.`;
    DownloadPolicy.logger.warn('DownloadPolicy', reason, { url });
    return { allowed: false, reason };
  }
}

