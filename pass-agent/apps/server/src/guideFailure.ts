export function guideFailure(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
  if (status === 401 || status === 403) return { code: "credentials", retryable: false, error: "The Gemini key was rejected. Check it in your local settings." };
  if (status === 429) return { code: "quota", retryable: false, error: "Gemini's quota is reached. Built-in guidance is available; check your provider quota before retrying." };
  if ([500, 502, 503, 504].includes(status)) return { code: "provider_unavailable", retryable: true, error: "Gemini is temporarily unavailable. Built-in guidance is active. Retry AI in a little while." };
  if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) return { code: "timeout", retryable: true, error: "The AI response took too long. Built-in guidance is active; you can retry AI." };
  return { code: "unavailable", retryable: true, error: "AI guidance could not finish. Built-in guidance is active; you can retry AI." };
}
