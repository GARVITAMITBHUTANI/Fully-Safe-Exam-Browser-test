import { ExamSession, SessionState } from '../src/Core/ExamSession';
import { DEFAULT_EXAM_CONFIGURATION } from '../src/Configuration/ExamConfiguration';

export function runSessionTests() {
  console.log('\n--- Running ExamSession State Machine Tests ---');

  const session = new ExamSession();

  // 1. Initial state
  console.assert(session.getState() === SessionState.STARTING, 'Test 1.1 Failed: Initial state must be STARTING');

  // 2. Transition to READY
  session.transitionTo(SessionState.READY);
  console.assert(session.getState() === SessionState.READY, 'Test 2.1 Failed: State must be READY');

  // 3. Transition to LOADING_CONFIGURATION
  session.transitionTo(SessionState.LOADING_CONFIGURATION, { path: 'exam.seb' });
  console.assert(session.getState() === SessionState.LOADING_CONFIGURATION, 'Test 3.1 Failed: State must be LOADING_CONFIGURATION');

  // 4. Attach configuration and start exam
  const config = { ...DEFAULT_EXAM_CONFIGURATION, startUrl: 'https://example.edu/exam' };
  session.attachConfiguration(config);
  session.transitionTo(SessionState.EXAM_RUNNING);
  console.assert(session.getState() === SessionState.EXAM_RUNNING, 'Test 4.1 Failed: State must be EXAM_RUNNING');
  console.assert(session.getCurrentConfiguration()?.startUrl === 'https://example.edu/exam', 'Test 4.2 Failed: Configuration should be attached');

  // 5. Window focus loss (Alt+Tab / switching to another window)
  session.handleFocusChange(false);
  console.assert(session.getState() === SessionState.FOCUS_LOST, 'Test 5.1 Failed: Losing focus should enter FOCUS_LOST state');

  // 6. Window focus regained
  session.handleFocusChange(true);
  console.assert(session.getState() === SessionState.EXAM_RUNNING, 'Test 6.1 Failed: Regaining focus should return to EXAM_RUNNING state');

  // 7. Error handling
  session.transitionTo(SessionState.ERROR, { error: 'Failed to connect to exam server.' });
  console.assert(session.getState() === SessionState.ERROR, 'Test 7.1 Failed: State should be ERROR');
  console.assert(session.getLastErrorMessage() === 'Failed to connect to exam server.', 'Test 7.2 Failed: Last error message must be recorded');

  // 8. Reset to READY
  session.resetToReady();
  console.assert(session.getState() === SessionState.READY, 'Test 8.1 Failed: Reset should return to READY state');
  console.assert(session.getCurrentConfiguration() === null, 'Test 8.2 Failed: Configuration should be cleared on reset');
  console.log('✔ Test: ExamSession state transitions and focus-lost resilience operate properly');
}

