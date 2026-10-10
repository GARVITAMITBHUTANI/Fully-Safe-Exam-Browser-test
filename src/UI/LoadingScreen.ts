export interface LoadingScreenOptions {
  message?: string;
  subMessage?: string;
}

export class LoadingScreen {
  public static getTitle(): string {
    return 'FSEB — Loading examination...';
  }
}

