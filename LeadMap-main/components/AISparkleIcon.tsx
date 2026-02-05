'use client'

import React from 'react'

export interface AISparkleIconProps {
  /** Size of the main icon (width/height). Default 24. */
  size?: number
  /** Optional className for the SVG element. */
  className?: string
  /** Whether to show the subtle pulse-glow animation (e.g. when "thinking"). */
  animate?: boolean
  /** Unique id for gradient/pattern to avoid clashes when multiple icons on page. */
  gradientId?: string
  /** Variant: 'full' = main + secondary sparkles; 'compact' = single sparkle only (e.g. small badges). */
  variant?: 'full' | 'compact'
  /** If true, use currentColor (e.g. white on gradient background). Otherwise use indigo-to-cyan gradient fill. */
  useCurrentColor?: boolean
}

const SPARKLE_PATH = 'M12 2L14.39 9.61L22 12L14.39 14.39L12 22L9.61 14.39L2 12L9.61 9.61L12 2Z'
const SPARKLE_PATH_SM = 'M12 4L13.5 9.5L19 11L13.5 12.5L12 18L10.5 12.5L5 11L10.5 9.5L12 4Z'

export default function AISparkleIcon({
  size = 24,
  className = '',
  animate = false,
  gradientId = 'ai_sparkle_gradient',
  variant = 'full',
  useCurrentColor = false,
}: AISparkleIconProps) {
  const fill = useCurrentColor ? 'currentColor' : `url(#${gradientId})`
  const viewBox = '0 0 24 24'

  return (
    <svg
      className={`${animate ? 'animate-pulse-glow' : ''} ${className}`}
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {!useCurrentColor && (
        <defs>
          <linearGradient
            id={gradientId}
            x1="2"
            y1="2"
            x2="22"
            y2="22"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#6366f1" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
      )}
      {variant === 'compact' ? (
        <path
          d={SPARKLE_PATH_SM}
          fill={fill}
          stroke="white"
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <path
            className="origin-center"
            d={SPARKLE_PATH}
            fill={fill}
            stroke="white"
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={SPARKLE_PATH_SM}
            fill={fill}
            className="opacity-70"
            transform="translate(6, -2) scale(0.4)"
          />
          <path
            d={SPARKLE_PATH_SM}
            fill={fill}
            className="opacity-60"
            transform="translate(-4, 4) scale(0.28)"
          />
        </>
      )}
    </svg>
  )
}
