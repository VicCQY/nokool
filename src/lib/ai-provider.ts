// AI Provider abstraction layer.
// To switch to Perplexity, replace the implementation in anthropic-client.ts
// with a Perplexity API client — no other files need to change.

export {
  researchPromises,
  fetchNews,
  isAnthropicConfigured as isAiConfigured,
} from "./anthropic-client";

export type { ResearchedPromise, FetchedArticle } from "./anthropic-client";
