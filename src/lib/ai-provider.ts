// AI Provider abstraction layer.
// Currently uses Perplexity (sonar-pro with built-in web search).

export {
  researchPromises,
  researchNews,
  matchPromisesToBills,
  checkPromiseStatuses,
} from "./ai-research";

export type { ResearchedPromise, ResearchedArticle, SuggestedMatch, StatusSuggestion } from "./ai-research";

export { isPerplexityConfigured as isAiConfigured } from "./perplexity-api";
