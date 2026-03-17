// AI Provider abstraction layer.
// Currently uses Perplexity (sonar-pro with built-in web search).

export {
  researchPromises,
  researchTimelines,
  researchNews,
  matchPromisesToBills,
} from "./ai-research";

export type {
  ResearchedPromiseBase,
  ResearchedPromise,
  TimelineResult,
  ResearchedArticle,
  SuggestedMatch,
  TimelineEvent,
} from "./ai-research";

export { isPerplexityConfigured as isAiConfigured } from "./perplexity-api";
