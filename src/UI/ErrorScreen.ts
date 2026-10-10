export interface ErrorDetails {
  title: string;
  message: string;
  canRetry: boolean;
}

export class ErrorScreen {
  public static formatError(error: unknown): ErrorDetails {
    const message = error instanceof Error ? error.message : String(error);
    return {
      title: 'Unable to start examination',
      message: message || 'An unexpected error occurred while preparing the exam environment.',
      canRetry: true,
    };
  }
}

