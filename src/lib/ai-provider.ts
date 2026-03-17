// AI Provider abstraction layer.
// Currently uses Perplexity (sonar-pro with built-in web search).

export {
  researchPromises,
  researchNews,
  matchPromisesToBills,
} from "./ai-research";

export type { ResearchedPromise, ResearchedArticle, SuggestedMatch, TimelineEvent } from "./ai-research";

export { isPerplexityConfigured as isAiConfigured } from "./perplexity-api";
