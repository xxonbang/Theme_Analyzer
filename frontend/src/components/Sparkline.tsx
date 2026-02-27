interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  className?: string
}

export function Sparkline({ data, width = 56, height = 18, color, className }: SparklineProps) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const hasNegative = min < 0
  const range = max - min || 1
  const pad = 1

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2)
    const y = pad + (1 - (v - min) / range) * (height - pad * 2)
    return `${x},${y}`
  }).join(" ")

  const strokeColor = color ?? (data[data.length - 1] >= data[0] ? "#ef4444" : "#3b82f6")

  // 음수값이 있으면 0 기준선 표시
  const zeroY = hasNegative
    ? pad + (1 - (0 - min) / range) * (height - pad * 2)
    : null

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      {zeroY != null && (
        <line
          x1={pad} y1={zeroY} x2={width - pad} y2={zeroY}
          stroke="currentColor" strokeWidth={0.5} strokeDasharray="2,2" opacity={0.3}
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
