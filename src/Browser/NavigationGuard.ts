import { ExamConfiguration } from '../Configuration/ExamConfiguration';
import { Logger } from '../Core/Logger';

export interface NavigationDecision {
  allowed: boolean;
  reason: string;
}

export class NavigationGuard {
  private static readonly logger = Logger.getInstance();
  private config: ExamConfiguration;

  constructor(config: ExamConfiguration) {
    this.config = config;
  }

  public updateConfiguration(config: ExamConfiguration): void {
    this.config = config;
  }

  /**
   * Determines whether navigating to the specified URL is permitted.
   */
  public evaluateNavigation(targetUrl: string): NavigationDecision {
    if (!targetUrl || targetUrl.trim() === '') {
      return { allowed: false, reason: 'Empty destination URL' };
    }

    const trimmed = targetUrl.trim();

    // Allow internal harmless schemes
    if (trimmed === 'about:blank') {
      return { allowed: true, reason: 'Harmless blank page' };
    }

    // Block dangerous protocols outright
    const lower = trimmed.toLowerCase();
    if (
      lower.startsWith('javascript:') ||
      lower.startsWith('data:') ||
      lower.startsWith('file:') && !this.config.startUrl.startsWith('file:')
    ) {
      const reason = `Blocked potentially dangerous protocol: ${trimmed.split(':')[0]}`;
      NavigationGuard.logger.warn('NavigationGuard', reason, { url: targetUrl });
      return { allowed: false, reason };
    }

    // Exact match or prefix match with startUrl
    if (this.config.startUrl) {
      if (trimmed === this.config.startUrl || trimmed.startsWith(this.config.startUrl)) {
        return { allowed: true, reason: 'Matches exam start URL' };
      }

      // Check same origin
      try {
        const startParsed = new URL(this.config.startUrl);
        const targetParsed = new URL(trimmed);
        if (startParsed.origin === targetParsed.origin) {
          return { allowed: true, reason: 'Matches start URL origin' };
        }
      } catch {
        // Fall through to allowedUrls check
      }
    }

    // Check against explicit allowedUrls list
    for (const pattern of this.config.allowedUrls) {
      if (this.matchesPattern(trimmed, pattern)) {
        return { allowed: true, reason: `Matches allowed URL pattern: ${pattern}` };
      }
    }

    const reason = 'URL is not in permitted exam navigation scope.';
    NavigationGuard.logger.warn('NavigationGuard', reason, { url: targetUrl });
    return { allowed: false, reason };
  }

  /**
   * Checks whether targetUrl matches a pattern (supports wildcards *).
   */
  public matchesPattern(targetUrl: string, pattern: string): boolean {
    const cleanPattern = pattern.trim();
    if (!cleanPattern) return false;

    // Direct match
    if (targetUrl === cleanPattern) return true;

    // Prefix match without wildcard
    if (!cleanPattern.includes('*')) {
      return targetUrl.startsWith(cleanPattern);
    }

    // Wildcard matching: Convert wildcard pattern to regular expression safely
    const escaped = cleanPattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');

    try {
      const regex = new RegExp(`^${escaped}$`, 'i');
      if (regex.test(targetUrl)) return true;

      // Also try matching target without query/hash
      const baseTarget = targetUrl.split('?')[0].split('#')[0];
      if (regex.test(baseTarget)) return true;
    } catch {
      // In case regex fails, fallback to prefix before wildcard
      const prefix = cleanPattern.split('*')[0];
      if (prefix && targetUrl.startsWith(prefix)) return true;
    }

    return false;
  }
}

