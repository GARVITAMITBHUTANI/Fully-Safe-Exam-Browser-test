import { ExamConfiguration } from './ExamConfiguration';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class SebValidator {
  public static validate(config: ExamConfiguration): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Validate Start URL
    if (!config.startUrl || typeof config.startUrl !== 'string') {
      errors.push('Exam start URL is missing or empty.');
    } else {
      const trimmed = config.startUrl.trim();
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('file://')) {
        errors.push(`Invalid start URL protocol: "${config.startUrl}". Only HTTP, HTTPS, and local file URLs are supported.`);
      } else {
        try {
          const parsed = new URL(trimmed);
          if (parsed.protocol === 'http:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
            warnings.push('Start URL is using insecure HTTP. Production exams should use HTTPS.');
          }
        } catch {
          errors.push(`Invalid URL format: "${config.startUrl}".`);
        }
      }
    }

    // 2. Validate Allowed URLs
    if (config.allowedUrls && Array.isArray(config.allowedUrls)) {
      for (const pattern of config.allowedUrls) {
        if (typeof pattern !== 'string' || pattern.trim().length === 0) {
          warnings.push(`Empty or invalid entry in allowed URLs list.`);
        }
      }
    }

    // 3. Security sanity checks
    if (config.developerTools) {
      warnings.push('Developer tools are explicitly enabled in this exam configuration.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

