import * as assert from 'assert';
import { GeminiService } from '../src/AI/GeminiService';
import { GeminiExtensionManager } from '../src/Security/GeminiExtensionManager';
import { SebLoader } from '../src/Configuration/SebLoader';
import { DEFAULT_EXAM_CONFIGURATION } from '../src/Configuration/ExamConfiguration';

export async function runAiAssistantTests(): Promise<void> {
  console.log('\n--- Running Gemini & AI Assistant Tests ---');

  // Test 1: GeminiService requires API key
  const noKeyResult = await GeminiService.analyzeScreen({
    apiKey: '',
    prompt: 'Solve this question',
  });
  assert.strictEqual(noKeyResult.success, false);
  assert.ok(noKeyResult.error?.includes('API key is required'));
  console.log('✔ Test 1: GeminiService requires API key and fails gracefully when empty');

  // Test 2: GeminiExtensionManager locates unpacked extension directory
  const extPath = GeminiExtensionManager.getExtensionPath();
  assert.ok(extPath.includes('gemini'));
  console.log('✔ Test 2: GeminiExtensionManager correctly resolves unpacked extension path');

  // Test 3: Default configuration has AI policy enabled
  assert.strictEqual(DEFAULT_EXAM_CONFIGURATION.aiPolicy.enabled, true);
  assert.strictEqual(DEFAULT_EXAM_CONFIGURATION.aiPolicy.gemini, true);
  assert.strictEqual(DEFAULT_EXAM_CONFIGURATION.aiPolicy.screenshots, true);
  console.log('✔ Test 3: Default ExamConfiguration includes enabled aiPolicy settings');

  // Test 4: SebLoader parses aiPolicy from JSON configuration
  const jsonConfig = JSON.stringify({
    startURL: 'https://example.edu/exam/test',
    aiPolicy: {
      enabled: true,
      gemini: true,
      pageContext: false,
      screenshots: true,
      defaultModel: 'gemini-1.5-pro',
    },
  });
  const parsed = SebLoader.parseContent(Buffer.from(jsonConfig, 'utf8'), 'test.json');
  assert.ok(parsed.success);
  assert.strictEqual(parsed.configuration?.aiPolicy.gemini, true);
  assert.strictEqual(parsed.configuration?.aiPolicy.pageContext, false);
  assert.strictEqual(parsed.configuration?.aiPolicy.defaultModel, 'gemini-1.5-pro');
  console.log('✔ Test 4: SebLoader parses and validates custom aiPolicy configurations');
}
