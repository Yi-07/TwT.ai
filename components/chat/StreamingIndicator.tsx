interface StreamingIndicatorProps {
  isSlow: boolean;
}

export function StreamingIndicator({ isSlow }: StreamingIndicatorProps) {
  return (
    <div className="flex flex-col items-start gap-2 px-4 py-3">
      <div className="flex items-center gap-1.5">
        <span className="sr-only">AI is responding</span>
        <svg
          width="40"
          height="40"
          viewBox="0 0 128 128"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="shrink-0"
        >
          <defs>
            <radialGradient id="si-bg" cx="38%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#253555" />
              <stop offset="100%" stopColor="#1a2540" />
            </radialGradient>

            <linearGradient id="si-eye" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%">
                <animate attributeName="stop-color"
                  values="#A09BE8;#D4C8FF;#A09BE8" dur="2.2s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%">
                <animate attributeName="stop-color"
                  values="#D4C8FF;#A09BE8;#D4C8FF" dur="2.2s" repeatCount="indefinite" />
              </stop>
            </linearGradient>

            <linearGradient id="si-mouth" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%">
                <animate attributeName="stop-color"
                  values="#67E8C9;#B8F5E8;#67E8C9" dur="2.2s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%">
                <animate attributeName="stop-color"
                  values="#B8F5E8;#67E8C9;#B8F5E8" dur="2.2s" repeatCount="indefinite" />
              </stop>
            </linearGradient>

            <filter id="si-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="si-outer-glow" x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
              <feColorMatrix in="blur" type="matrix"
                values="0.3 0 0.5 0 0
                        0.2 0 0.6 0 0
                        0.8 0 1   0 0
                        0   0 0   0.45 0"
                result="colored" />
              <feMerge>
                <feMergeNode in="colored" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <style>{`
            .si-float {
              animation: si-face-float 2.4s ease-in-out infinite;
              transform-origin: 64px 64px;
            }
            @keyframes si-face-float {
              0%,100% { transform: translateY(0)    scale(1);    }
              50%      { transform: translateY(-4px) scale(1.04); }
            }
            .si-eye {
              transform-box: fill-box;
              transform-origin: center;
              animation: si-blink 3s ease-in-out infinite;
            }
            @keyframes si-blink {
              0%,38%,62%,100% { transform: scaleY(1);    }
              50%              { transform: scaleY(0.07); }
            }
            .si-brow {
              transform-box: fill-box;
              transform-origin: center;
              animation: si-brow-lift 3s ease-in-out infinite;
            }
            @keyframes si-brow-lift {
              0%,38%,62%,100% { transform: translateY(0);   }
              50%              { transform: translateY(-3px); }
            }
          `}</style>

          {/* Outer glow */}
          <g filter="url(#si-outer-glow)">
            <rect width="128" height="128" rx="28" fill="url(#si-bg)" />
          </g>

          {/* Top highlight streak */}
          <rect x="0" y="0" width="128" height="56" rx="28" fill="white" opacity="0.05" />

          {/* Face group — floats as a unit */}
          <g className="si-float">
            {/* Left eyebrow */}
            <rect className="si-brow" x="24" y="22" width="30" height="6" rx="3"
              fill="url(#si-eye)" filter="url(#si-glow)" />
            {/* Left eye */}
            <rect className="si-eye" x="33" y="34" width="7" height="24" rx="3.5"
              fill="url(#si-eye)" filter="url(#si-glow)" />
            {/* Right eyebrow */}
            <rect className="si-brow" x="74" y="22" width="30" height="6" rx="3"
              fill="url(#si-eye)" filter="url(#si-glow)" />
            {/* Right eye */}
            <rect className="si-eye" x="88" y="34" width="7" height="24" rx="3.5"
              fill="url(#si-eye)" filter="url(#si-glow)" />
            {/* ω mouth */}
            <path d="M36 84 Q45 98 64 88 Q83 98 92 84"
              fill="none" stroke="url(#si-mouth)" strokeWidth="6.5"
              strokeLinecap="round" strokeLinejoin="round"
              filter="url(#si-glow)" />
            <path d="M36 84 Q33 79 36 75"
              fill="none" stroke="url(#si-mouth)" strokeWidth="6.5"
              strokeLinecap="round" />
            <path d="M92 84 Q95 79 92 75"
              fill="none" stroke="url(#si-mouth)" strokeWidth="6.5"
              strokeLinecap="round" />
          </g>
        </svg>
      </div>
      {isSlow && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          模型响应较慢，请耐心等待...或点击取消后重试
        </p>
      )}
    </div>
  );
}
