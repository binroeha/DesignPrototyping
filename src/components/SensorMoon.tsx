import { useEffect, useRef, type CSSProperties } from 'react'
import { SENSOR_MAX, SENSOR_MIN } from '../product'
import type { Reading } from '../lib/device'

export function SensorMoon({
  power,
  readings,
}: {
  power: boolean
  readings: Reading[]
}) {
  const motionRef = useRef<HTMLDivElement>(null)
  const motionLevelRef = useRef(0)
  const currentValue = readings.at(-1)?.value
  const level =
    currentValue === undefined
      ? 0
      : Math.min(
          1,
          Math.max(
            0,
            (currentValue - SENSOR_MIN) / (SENSOR_MAX - SENSOR_MIN),
          ),
        )
  const responseLevel = Math.sqrt(level)
  motionLevelRef.current = responseLevel

  const moonStyle: CSSProperties & { '--level': number } = {
    '--level': responseLevel,
  }

  useEffect(() => {
    const motion = motionRef.current
    if (motion === null) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches) return

    let frame = 0
    let previousTime = 0
    let phase = 0
    let speedLevel = motionLevelRef.current

    const animate = (time: number) => {
      if (previousTime !== 0) {
        const delta = Math.min((time - previousTime) / 1000, 0.05)
        const targetLevel = motionLevelRef.current
        speedLevel += (targetLevel - speedLevel) * (1 - Math.exp(-delta * 3))
        phase += (2 * Math.PI * delta) / (4 - speedLevel * 3.2)
        motion.style.transform =
          `translateY(${Math.sin(phase) * 10}px) ` +
          `rotateX(${Math.sin(phase) * 14}deg)`
      }
      previousTime = time
      frame = window.requestAnimationFrame(animate)
    }

    frame = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return (
    <section className="moon-section" aria-label="달 상태">
      <div
        className="moon"
        role="img"
        aria-label={
          power
            ? `달 밝기 ${Math.round(responseLevel * 100)}%`
            : '달 꺼짐'
        }
        data-power={power ? 'on' : 'off'}
        style={moonStyle}
      >
        <div className="moon-motion" ref={motionRef}>
          <img src={`${import.meta.env.BASE_URL}images/moon.webp`} alt="" />
        </div>
      </div>
      <p className="t-value sensor-value">
        {currentValue === undefined
          ? '—'
          : new Intl.NumberFormat('ko-KR').format(currentValue)}
      </p>
    </section>
  )
}
