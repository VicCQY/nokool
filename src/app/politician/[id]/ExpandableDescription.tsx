"use client";

import { useState } from "react";

export function ExpandableDescription({
  description,
}: {
  description: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (description.length < 120) {
    return (
      <p className="mt-3 text-sm text-[#4A4A4A] leading-relaxed">
        {description}
      </p>
    );
  }

  return (
    <div className="mt-3">
      <p className="text-sm text-[#4A4A4A] leading-relaxed">
        {expanded ? description : `${description.slice(0, 120)}...`}
      </p>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-1 text-xs font-medium text-[#2563EB] hover:underline"
      >
        {expanded ? "Show less" : "Read more"}
      </button>
    </div>
  );
}
