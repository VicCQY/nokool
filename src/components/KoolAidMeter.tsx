"use client";

import { useEffect, useRef, useState } from "react";
import { calculateKoolAidLevel } from "@/lib/koolaid";

interface KoolAidMeterProps {
  size: "sm" | "md" | "lg";
  fulfillmentPercent: number;
}

const SIZES = {
  sm: { width: 48, height: 64 },
  md: { width: 80, height: 120 },
  lg: { width: 120, height: 180 },
};

export function KoolAidMeter({ size, fulfillmentPercent }: KoolAidMeterProps) {
  const { koolAidPercent, tier, tagline, color } =
    calculateKoolAidLevel(fulfillmentPercent);
  const [fillHeight, setFillHeight] = useState(0);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    // Animate fill from 0 to target
    const start = performance.now();
    const duration = 1500;
    const target = koolAidPercent;

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setFillHeight(target * eased);
      if (progress < 1) requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }, [visible, koolAidPercent]);

  const { width, height } = SIZES[size];
  const isOverflowing = koolAidPercent > 80;

  // Glass geometry — tapered tumbler
  // Coordinate system: viewBox matches pixel size
  const rimWidth = width * 0.82;
  const baseWidth = width * 0.6;
  const glassTop = height * 0.12;
  const glassBottom = height * 0.88;
  const glassHeight = glassBottom - glassTop;

  const rimLeft = (width - rimWidth) / 2;
  const rimRight = rimLeft + rimWidth;
  const baseLeft = (width - baseWidth) / 2;
  const baseRight = baseLeft + baseWidth;

  // Liquid fill area
  const liquidTop = glassBottom - (glassHeight * fillHeight) / 100;

  // Interpolate glass width at liquidTop
  const t = fillHeight / 100; // 0 at bottom, 1 at top
  const liquidLeftAtTop = baseLeft + (rimLeft - baseLeft) * t;
  const liquidRightAtTop = baseRight + (rimRight - baseRight) * t;

  // Wave amplitude
  const waveAmp = size === "sm" ? 1.5 : size === "md" ? 2.5 : 3.5;

  const ariaLabel = `Kool-Aid Meter: ${koolAidPercent}% — ${tier}. ${tagline}`;

  // Unique ID for clip paths (avoid collisions with multiple instances)
  const clipId = useRef(
    `glass-clip-${Math.random().toString(36).slice(2, 8)}`,
  ).current;
  const waveId = useRef(
    `wave-${Math.random().toString(36).slice(2, 8)}`,
  ).current;

  return (
    <div ref={containerRef} className="flex flex-col items-center">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="overflow-visible"
      >
        <defs>
          {/* Glass clip path */}
          <clipPath id={clipId}>
            <path
              d={`M ${rimLeft} ${glassTop} L ${rimRight} ${glassTop} L ${baseRight} ${glassBottom} L ${baseLeft} ${glassBottom} Z`}
            />
          </clipPath>
        </defs>

        {/* Liquid */}
        {fillHeight > 0 && (
          <g clipPath={`url(#${clipId})`}>
            {/* Liquid body */}
            <rect
              x={0}
              y={liquidTop + waveAmp}
              width={width}
              height={glassBottom - liquidTop}
              fill={color}
              opacity={0.85}
            />
            {/* Wave surface */}
            <path
              id={waveId}
              d={`M ${liquidLeftAtTop - 4} ${liquidTop}
                  Q ${liquidLeftAtTop + (liquidRightAtTop - liquidLeftAtTop) * 0.25} ${liquidTop - waveAmp},
                    ${liquidLeftAtTop + (liquidRightAtTop - liquidLeftAtTop) * 0.5} ${liquidTop}
                  Q ${liquidLeftAtTop + (liquidRightAtTop - liquidLeftAtTop) * 0.75} ${liquidTop + waveAmp},
                    ${liquidRightAtTop + 4} ${liquidTop}
                  L ${liquidRightAtTop + 4} ${liquidTop + waveAmp * 2 + 2}
                  L ${liquidLeftAtTop - 4} ${liquidTop + waveAmp * 2 + 2} Z`}
              fill={color}
              opacity={0.85}
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                values={`0,0; ${waveAmp * 0.5},${-waveAmp * 0.3}; 0,0; ${-waveAmp * 0.5},${waveAmp * 0.3}; 0,0`}
                dur="3s"
                repeatCount="indefinite"
              />
            </path>
          </g>
        )}

        {/* Glass outline */}
        <path
          d={`M ${rimLeft} ${glassTop} L ${rimRight} ${glassTop} L ${baseRight} ${glassBottom} L ${baseLeft} ${glassBottom} Z`}
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={size === "sm" ? 1.2 : 1.8}
          strokeLinejoin="round"
        />

        {/* Glass reflection highlight */}
        <path
          d={`M ${rimLeft + (rimWidth * 0.08)} ${glassTop + 3}
              L ${baseLeft + (baseWidth * 0.08)} ${glassBottom - 3}
              L ${baseLeft + (baseWidth * 0.22)} ${glassBottom - 3}
              L ${rimLeft + (rimWidth * 0.2)} ${glassTop + 3} Z`}
          fill="rgba(255,255,255,0.12)"
        />

        {/* Overflow drips */}
        {isOverflowing && fillHeight > 80 && (
          <>
            <ellipse
              cx={rimRight - rimWidth * 0.15}
              cy={glassTop + (size === "sm" ? 8 : size === "md" ? 14 : 20)}
              rx={size === "sm" ? 2 : size === "md" ? 3 : 4}
              ry={size === "sm" ? 3 : size === "md" ? 4.5 : 6}
              fill={color}
              opacity={0.75}
            >
              <animate
                attributeName="cy"
                values={`${glassTop + (size === "sm" ? 6 : size === "md" ? 10 : 14)};${glassTop + (size === "sm" ? 14 : size === "md" ? 24 : 36)};${glassTop + (size === "sm" ? 6 : size === "md" ? 10 : 14)}`}
                dur="2.5s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.75;0.3;0.75"
                dur="2.5s"
                repeatCount="indefinite"
              />
            </ellipse>
            <ellipse
              cx={rimLeft + rimWidth * 0.08}
              cy={glassTop + (size === "sm" ? 11 : size === "md" ? 18 : 26)}
              rx={size === "sm" ? 1.5 : size === "md" ? 2.5 : 3}
              ry={size === "sm" ? 2.5 : size === "md" ? 3.5 : 5}
              fill={color}
              opacity={0.6}
            >
              <animate
                attributeName="cy"
                values={`${glassTop + (size === "sm" ? 9 : size === "md" ? 14 : 20)};${glassTop + (size === "sm" ? 18 : size === "md" ? 30 : 44)};${glassTop + (size === "sm" ? 9 : size === "md" ? 14 : 20)}`}
                dur="3.2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.6;0.2;0.6"
                dur="3.2s"
                repeatCount="indefinite"
              />
            </ellipse>
          </>
        )}
      </svg>

      {/* Tier name (md, lg) */}
      {size !== "sm" && (
        <p
          className={`mt-1.5 font-bold text-center ${
            size === "lg" ? "text-sm" : "text-xs"
          }`}
          style={{ color }}
        >
          {tier}
        </p>
      )}

      {/* Tagline (lg only) */}
      {size === "lg" && (
        <p className="text-xs text-gray-400 text-center mt-0.5">{tagline}</p>
      )}
    </div>
  );
}
