import { Logger } from '../Core/Logger';

export interface AiAnalysisRequest {
  apiKey: string;
  provider?: 'gemini' | 'openai' | 'custom';
  model?: string;
  customEndpoint?: string;
  prompt?: string;
  imageBuffer?: Buffer; // Screenshot bitmap from webContents.capturePage()
  pageText?: string;
}

export interface AiAnalysisResponse {
  success: boolean;
  text?: string;
  modelUsed?: string;
  error?: string;
}

export class GeminiService {
  private static readonly logger = Logger.getInstance();

  /**
   * Analyzes an exam screen image and optional page text using Google Gemini or compatible vision models
   */
  public static async analyzeScreen(request: AiAnalysisRequest): Promise<AiAnalysisResponse> {
    const provider = request.provider || 'gemini';
    const apiKey = request.apiKey?.trim();

    if (!apiKey) {
      return {
        success: false,
        error: 'API key is required. Please enter your Google Gemini API key in the AI Assistant settings.',
      };
    }

    if (provider === 'gemini') {
      return this.callGeminiApi(request);
    } else if (provider === 'openai') {
      return this.callOpenAiApi(request);
    } else {
      return this.callCustomApi(request);
    }
  }

  private static async callGeminiApi(request: AiAnalysisRequest): Promise<AiAnalysisResponse> {
    // Migrate deprecated gemini-2.0-flash to gemini-2.5-flash or gemini-1.5-flash
    let requestedModel = request.model?.trim() || 'gemini-2.5-flash';
    if (requestedModel === 'gemini-2.0-flash') {
      requestedModel = 'gemini-2.5-flash';
    }

    // Candidate fallback models in priority order
    const candidateModels = [
      requestedModel,
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-2.5-pro',
      'gemini-1.5-pro',
    ];

    const modelsToTry = Array.from(new Set(candidateModels));
    let lastError = '';

    for (const model of modelsToTry) {
      const result = await this.tryGeminiModel(request, model);
      if (result.success) {
        return result;
      }

      lastError = result.error || 'Failed to generate response';

      // If invalid API key, quota exceeded, or content violation, fail immediately
      const lowerErr = lastError.toLowerCase();
      if (
        lowerErr.includes('api_key') ||
        lowerErr.includes('api key not valid') ||
        lowerErr.includes('quota') ||
        lowerErr.includes('permission_denied')
      ) {
        return result;
      }

      // If the model is not found / deprecated / no longer available, continue to next fallback
      this.logger.warn('GeminiService', `Gemini model ${model} returned error: ${lastError}. Attempting fallback model...`);
    }

    return {
      success: false,
      error: lastError,
    };
  }

  private static async tryGeminiModel(request: AiAnalysisRequest, model: string): Promise<AiAnalysisResponse> {
    const apiKey = request.apiKey.trim();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const defaultInstruction =
      'You are an expert academic and examination assistant. Carefully examine the attached screenshot of the examination screen.\n' +
      '1. Identify the question, prompt, or problem statement.\n' +
      '2. If it is multiple-choice, identify all options and state the single correct option explicitly first (e.g. **Correct Answer: B**).\n' +
      '3. Provide a clear, concise, step-by-step solution or justification.\n' +
      '4. If it is a coding question, write clean, optimized code.\n' +
      'Format your output using clean Markdown.';

    const userPrompt = request.prompt?.trim()
      ? `${defaultInstruction}\n\nUser specific question / instruction: ${request.prompt.trim()}`
      : defaultInstruction;

    const parts: Array<Record<string, unknown>> = [{ text: userPrompt }];

    if (request.pageText && request.pageText.trim().length > 0) {
      parts.push({
        text: `Extracted page text context:\n\`\`\`\n${request.pageText.trim().slice(0, 4000)}\n\`\`\``,
      });
    }

    if (request.imageBuffer) {
      const base64Data = request.imageBuffer.toString('base64');
      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: base64Data,
        },
      });
    }

    const payload = {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    };

    try {
      this.logger.info('GeminiService', `Sending screen analysis request to Gemini model: ${model}`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error('GeminiService', `Gemini API returned HTTP ${response.status}`, { errorBody });
        let errMsg = `Gemini API error (${response.status})`;
        try {
          const parsed = JSON.parse(errorBody);
          if (parsed.error?.message) errMsg = parsed.error.message;
        } catch {
          // ignore json parse error
        }
        return { success: false, error: errMsg };
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      const answer = candidate?.content?.parts?.map((p: { text?: string }) => p.text || '').join('\n') || '';

      if (!answer) {
        return {
          success: false,
          error: 'Gemini returned an empty response. The content may have been flagged or no text was generated.',
        };
      }

      return {
        success: true,
        text: answer,
        modelUsed: model,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('GeminiService', 'Failed to connect to Gemini API', { error: msg });
      return {
        success: false,
        error: `Network error connecting to Gemini: ${msg}`,
      };
    }
  }

  private static async callOpenAiApi(request: AiAnalysisRequest): Promise<AiAnalysisResponse> {
    const model = request.model || 'gpt-4o';
    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const defaultPrompt =
      'You are an expert exam assistant. Analyze this exam screen carefully. Identify the question, find the correct answer, and explain step-by-step. If multiple choice, clearly state the correct option.';
    const promptText = request.prompt?.trim() ? `${defaultPrompt}\n\n${request.prompt.trim()}` : defaultPrompt;

    const content: Array<Record<string, unknown>> = [{ type: 'text', text: promptText }];

    if (request.imageBuffer) {
      const base64Data = request.imageBuffer.toString('base64');
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${base64Data}`,
        },
      });
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${request.apiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content }],
          temperature: 0.2,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `OpenAI API error (${response.status}): ${errorText}` };
      }

      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || '';
      return { success: true, text: answer, modelUsed: model };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Network error connecting to OpenAI: ${msg}` };
    }
  }

  private static async callCustomApi(request: AiAnalysisRequest): Promise<AiAnalysisResponse> {
    if (!request.customEndpoint) {
      return { success: false, error: 'Custom API endpoint URL is required.' };
    }
    return this.callOpenAiApi({
      ...request,
      customEndpoint: request.customEndpoint,
    });
  }
}
