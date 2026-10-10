import { contextBridge } from 'electron';

// Expose SafeExamBrowser object expected by modern assessment platforms (CodeChef, Moodle, etc.)
try {
  contextBridge.exposeInMainWorld('SafeExamBrowser', {
    version: 'SEB_Windows_3.10.2',
    platform: 'Windows',
  });
} catch (err) {
  // Fallback direct assignment
  try {
    (window as unknown as { SafeExamBrowser: unknown }).SafeExamBrowser = {
      version: 'SEB_Windows_3.10.2',
      platform: 'Windows',
    };
  } catch {
    // Ignored
  }
}

