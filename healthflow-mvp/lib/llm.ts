/**
 * Anthropic 호출을 한 곳으로 모음.
 * 프롬프트에 민감정보를 넘기지 않는 규칙은 호출부(caller)에서 지켜야 하고,
 * 여기서는 재시도/타임아웃/에러 변환만 책임진다.
 */
const TIMEOUT_MS = 8000;

export async function callClaude(prompt: string, maxTokens = 300): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`LLM call failed: ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? '';
  } finally {
    clearTimeout(timeout);
  }
}
