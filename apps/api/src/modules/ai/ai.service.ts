import type { AiConfig } from '../../core/config';
import { AiDisabledError, UpstreamError } from '../../core/errors';

const SYSTEM_PROMPT =
  'You are a reading assistant. Summarize the passage briefly (max 150 words) so the reader remembers ' +
  'what is happening. Answer in the same language as the passage.';

interface ChatCompletion {
  choices?: Array<{ message?: { content?: string } }>;
}

export class AiService {
  private static readonly TIMEOUT_MS = 20_000;

  constructor(
    private readonly config: AiConfig | null,
    private readonly fetchFn: typeof fetch,
  ) {}

  get enabled(): boolean {
    return this.config !== null;
  }

  async summarize(text: string): Promise<string> {
    if (!this.config) throw new AiDisabledError();
    let res: Response;
    try {
      res = await this.fetchFn(`${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: text },
          ],
          temperature: 0.5,
          max_tokens: 400,
        }),
        signal: AbortSignal.timeout(AiService.TIMEOUT_MS),
      });
    } catch (err) {
      throw new UpstreamError(`AI request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!res.ok) throw new UpstreamError(`AI provider responded ${res.status}`);
    const summary = ((await res.json()) as ChatCompletion).choices?.[0]?.message?.content?.trim();
    if (!summary) throw new UpstreamError('AI provider returned an empty answer');
    return summary;
  }
}
