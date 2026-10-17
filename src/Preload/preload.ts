import { contextBridge, ipcRenderer } from 'electron';

export interface AppInfo {
  name: string;
  version: string;
}

export interface AiAnalyzeOptions {
  apiKey: string;
  provider?: 'gemini' | 'openai' | 'custom';
  model?: string;
  customEndpoint?: string;
  prompt?: string;
  includeScreen?: boolean;
  includeText?: boolean;
}

export interface AiAnalyzeResult {
  success: boolean;
  text?: string;
  error?: string;
  modelUsed?: string;
}

export interface FsebAPI {
  openFilePicker: () => Promise<string | null>;
  startExamFromFile: (filePath: string) => Promise<boolean>;
  retryLoading: () => Promise<void>;
  closeApplication: () => Promise<void>;
  reloadExam: () => Promise<void>;
  getAppInfo: () => Promise<AppInfo>;
  onStateUpdate: (callback: (state: string, details?: Record<string, unknown>) => void) => void;
  onShowQuitModal: (callback: () => void) => void;
  // AI Screen Analysis methods
  analyzeScreenWithAi: (options: AiAnalyzeOptions) => Promise<AiAnalyzeResult>;
  capturePreview: () => Promise<string | null>;
  toggleAiPanel: (isOpen: boolean, width?: number) => Promise<void>;
  onAiToggleShortcut: (callback: () => void) => void;
}

const api: FsebAPI = {
  openFilePicker: () => ipcRenderer.invoke('fseb:open-file-picker'),
  startExamFromFile: (filePath: string) => ipcRenderer.invoke('fseb:start-exam', filePath),
  retryLoading: () => ipcRenderer.invoke('fseb:retry-loading'),
  closeApplication: () => ipcRenderer.invoke('fseb:close-app'),
  reloadExam: () => ipcRenderer.invoke('fseb:reload-exam'),
  getAppInfo: () => ipcRenderer.invoke('fseb:get-app-info'),
  onStateUpdate: (callback) => {
    ipcRenderer.on('fseb:state-update', (_event, { state, details }) => {
      callback(state, details);
    });
  },
  onShowQuitModal: (callback) => {
    ipcRenderer.on('fseb:show-quit-modal', () => {
      callback();
    });
  },
  analyzeScreenWithAi: (options: AiAnalyzeOptions) => ipcRenderer.invoke('fseb:ai:capture-and-analyze', options),
  capturePreview: () => ipcRenderer.invoke('fseb:ai:capture-preview'),
  toggleAiPanel: (isOpen: boolean, width?: number) => ipcRenderer.invoke('fseb:ai:toggle-panel', { isOpen, width }),
  onAiToggleShortcut: (callback) => {
    ipcRenderer.on('fseb:ai:toggle-shortcut', () => {
      callback();
    });
  },
};

contextBridge.exposeInMainWorld('fsebAPI', api);
