import { useEffect, useRef, useState } from 'react'
import { SENSOR_MAX, SENSOR_MIN } from '../product'
import type { Reading } from '../lib/device'

const chartHeight = 200
const chartTop = 8
const chartBottom = 20
const chartLeft = 40
const chartRight = 8
const chartRange = chartHeight - chartTop - chartBottom

export function SensorChart({ readings }: { readings: Reading[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const latestValue = readings.at(-1)?.value
  const points =
    readings.length > 1 && width > chartLeft + chartRight
      ? readings
          .map((reading, index) => {
            const x =
              chartLeft +
              (index / (readings.length - 1)) * (width - chartLeft - chartRight)
            const value = Math.min(SENSOR_MAX, Math.max(SENSOR_MIN, reading.value))
            const y = chartTop + (1 - value / SENSOR_MAX) * chartRange
            return `${x.toFixed(1)},${y.toFixed(1)}`
          })
          .join(' ')
      : ''

  useEffect(() => {
    const container = containerRef.current
    if (container === null) return

    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="sensor-chart" aria-label="실시간 센서값">
      {readings.length === 0 ? (
        <p className="t-body chart-empty">
          센서를 연결하면 값이 여기에 그려집니다.
        </p>
      ) : (
        <div className="chart-container" ref={containerRef}>
          <svg
            width={width}
            height={chartHeight}
            role="img"
            aria-label={`센서값 추이, 현재 ${
              latestValue === undefined
                ? '—'
                : new Intl.NumberFormat('ko-KR').format(latestValue)
            }`}
          >
            {[SENSOR_MAX, SENSOR_MAX / 2, SENSOR_MIN].map((value) => {
              const y =
                chartTop +
                (1 - (value - SENSOR_MIN) / (SENSOR_MAX - SENSOR_MIN)) *
                  chartRange
              return (
                <g key={value}>
                  <line
                    className="chart-grid"
                    x1={chartLeft}
                    y1={y}
                    x2={Math.max(chartLeft, width - chartRight)}
                    y2={y}
                  />
                  <text className="chart-axis-label" x={chartLeft - 4} y={y + 4}>
                    {new Intl.NumberFormat('ko-KR').format(value)}
                  </text>
                </g>
              )
            })}
            {points && <polyline className="chart-line" points={points} />}
            <text className="chart-time-label" x={chartLeft} y={chartHeight - 2}>
              −60s
            </text>
            <text
              className="chart-time-label"
              x={Math.max(chartLeft, width - chartRight)}
              y={chartHeight - 2}
              textAnchor="end"
            >
              지금
            </text>
          </svg>
        </div>
      )}
    </section>
  )
}
