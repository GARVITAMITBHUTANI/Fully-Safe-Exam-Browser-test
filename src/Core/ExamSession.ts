import { EventEmitter } from 'events';
import { ExamConfiguration } from '../Configuration/ExamConfiguration';
import { ExamPolicy } from './ExamPolicy';
import { Logger } from './Logger';

export enum SessionState {
  STARTING = 'STARTING',
  READY = 'READY',
  LOADING_CONFIGURATION = 'LOADING_CONFIGURATION',
  VALIDATING_CONFIGURATION = 'VALIDATING_CONFIGURATION',
  STARTING_EXAM = 'STARTING_EXAM',
  EXAM_RUNNING = 'EXAM_RUNNING',
  FOCUS_LOST = 'FOCUS_LOST',
  ERROR = 'ERROR',
  CLOSING = 'CLOSING',
}

export interface StateChangeEvent {
  previousState: SessionState;
  currentState: SessionState;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export class ExamSession extends EventEmitter {
  private static readonly logger = Logger.getInstance();
  private state: SessionState = SessionState.STARTING;
  private currentConfig: ExamConfiguration | null = null;
  private policy: ExamPolicy;
  private sessionStartTime: Date | null = null;
  private lastErrorMessage: string | null = null;

  constructor() {
    super();
    this.policy = new ExamPolicy();
    ExamSession.logger.info('ExamSession', 'ExamSession instance created in STARTING state');
  }

  public getState(): SessionState {
    return this.state;
  }

  public getPolicy(): ExamPolicy {
    return this.policy;
  }

  public getCurrentConfiguration(): ExamConfiguration | null {
    return this.currentConfig;
  }

  public getLastErrorMessage(): string | null {
    return this.lastErrorMessage;
  }

  public getSessionDurationSeconds(): number {
    if (!this.sessionStartTime) return 0;
    return Math.floor((Date.now() - this.sessionStartTime.getTime()) / 1000);
  }

  /**
   * Transition state machine
   */
  public transitionTo(newState: SessionState, metadata?: Record<string, unknown>): void {
    const previousState = this.state;
    if (previousState === newState) return;

    this.state = newState;

    const event: StateChangeEvent = {
      previousState,
      currentState: newState,
      timestamp: new Date().toISOString(),
      metadata,
    };

    ExamSession.logger.info('ExamSession', `Session state transition: ${previousState} -> ${newState}`, {
      metadata,
    });

    if (newState === SessionState.EXAM_RUNNING && !this.sessionStartTime) {
      this.sessionStartTime = new Date();
    }

    if (newState === SessionState.ERROR && metadata?.['error']) {
      this.lastErrorMessage = String(metadata['error']);
    }

    this.emit('stateChange', event);
    this.emit(newState, event);
  }

  /**
   * Loads and attaches an exam configuration
   */
  public attachConfiguration(config: ExamConfiguration): void {
    this.currentConfig = config;
    this.policy.updateConfiguration(config);
    ExamSession.logger.info('ExamSession', 'Attached exam configuration to active session', {
      startUrl: config.startUrl,
    });
  }

  /**
   * Handles focus change events gracefully
   */
  public handleFocusChange(hasFocus: boolean): void {
    if (this.state === SessionState.EXAM_RUNNING && !hasFocus) {
      this.transitionTo(SessionState.FOCUS_LOST, { reason: 'Application lost window focus' });
    } else if (this.state === SessionState.FOCUS_LOST && hasFocus) {
      this.transitionTo(SessionState.EXAM_RUNNING, { reason: 'Application regained window focus' });
    }
  }

  /**
   * Resets active session back to READY
   */
  public resetToReady(): void {
    this.currentConfig = null;
    this.sessionStartTime = null;
    this.lastErrorMessage = null;
    this.transitionTo(SessionState.READY);
  }
}

