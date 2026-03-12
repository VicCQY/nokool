export interface KoolAidLevel {
  koolAidPercent: number;
  tier: string;
  tagline: string;
  color: string;
}

export function calculateKoolAidLevel(
  fulfillmentPercentage: number,
): KoolAidLevel {
  const koolAidPercent = Math.max(0, Math.min(100, 100 - fulfillmentPercentage));

  if (koolAidPercent <= 20) {
    return {
      koolAidPercent,
      tier: "Dry Cup",
      tagline: "Refreshingly honest.",
      color: "#FFE0E0",
    };
  }
  if (koolAidPercent <= 40) {
    return {
      koolAidPercent,
      tier: "Few Sips",
      tagline: "Stay skeptical.",
      color: "#F8A0A0",
    };
  }
  if (koolAidPercent <= 60) {
    return {
      koolAidPercent,
      tier: "Half Full",
      tagline: "Proceed with caution.",
      color: "#E85050",
    };
  }
  if (koolAidPercent <= 80) {
    return {
      koolAidPercent,
      tier: "Heavy Pour",
      tagline: "Don't drink this.",
      color: "#D03030",
    };
  }
  return {
    koolAidPercent,
    tier: "Overflowing",
    tagline: "Pure Kool-Aid.",
    color: "#DC2626",
  };
}
