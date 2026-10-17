import * as path from 'path';
import * as fs from 'fs';
import { session, app } from 'electron';
import { Logger } from '../Core/Logger';
import { ExamPolicy } from '../Core/ExamPolicy';

export class GeminiExtensionManager {
  private static readonly logger = Logger.getInstance();
  private static loadedExtensionId: string | null = null;

  /**
   * Resolves the path to the unpacked Gemini extension
   */
  public static getExtensionPath(): string {
    const candidates = [
      path.join(__dirname, '../../extensions/gemini'),
      path.join(process.cwd(), 'extensions', 'gemini'),
      ...(app?.getAppPath ? [path.join(app.getAppPath(), 'extensions', 'gemini')] : []),
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.existsSync(path.join(cand, 'manifest.json'))) {
        return cand;
      }
    }

    return candidates[0];
  }

  /**
   * Loads the unpacked Gemini extension if authorized by the exam policy
   */
  public static async loadIfAuthorized(policy?: ExamPolicy): Promise<string | null> {
    if (policy) {
      const aiPolicy = policy.getAiPolicy();
      if (!aiPolicy.enabled || !aiPolicy.gemini) {
        this.logger.info('GeminiExtensionManager', 'Gemini extension is disabled by exam configuration policy.');
        return null;
      }
    }

    const extensionPath = this.getExtensionPath();
    if (!fs.existsSync(extensionPath)) {
      this.logger.warn('GeminiExtensionManager', `Gemini extension directory not found at: ${extensionPath}`);
      return null;
    }

    try {
      this.logger.info('GeminiExtensionManager', `Loading unpacked Gemini extension from: ${extensionPath}`);
      const extension = await session.defaultSession.extensions.loadExtension(extensionPath, {
        allowFileAccess: true,
      });

      this.loadedExtensionId = extension.id;
      this.logger.info('GeminiExtensionManager', `Successfully loaded Gemini extension. ID: ${extension.id}`);
      return extension.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('GeminiExtensionManager', `Failed to load Gemini extension: ${msg}`);
      return null;
    }
  }

  /**
   * Unloads the extension
   */
  public static async unload(): Promise<void> {
    if (this.loadedExtensionId) {
      try {
        await session.defaultSession.extensions.removeExtension(this.loadedExtensionId);
        this.logger.info('GeminiExtensionManager', `Unloaded Gemini extension ID: ${this.loadedExtensionId}`);
      } catch (err) {
        this.logger.warn('GeminiExtensionManager', 'Error while unloading Gemini extension', { error: String(err) });
      }
      this.loadedExtensionId = null;
    }
  }
}
