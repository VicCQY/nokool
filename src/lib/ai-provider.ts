// AI Provider abstraction layer.
// Currently uses Perplexity (sonar-pro with built-in web search).

export {
  researchPromises,
  researchNews,
} from "./ai-research";

export type { ResearchedPromise, ResearchedArticle } from "./ai-research";

export { isPerplexityConfigured as isAiConfigured } from "./perplexity-api";
