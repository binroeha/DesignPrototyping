import { useEffect, useState } from 'react'
import { ConnectionControl } from './components/ConnectionControl'
import { PowerToggle } from './components/PowerToggle'
import { ProductHeader } from './components/ProductHeader'
import { SensorChart } from './components/SensorChart'
import { SensorMoon } from './components/SensorMoon'
import { MAX_POINTS, PRODUCT } from './product'
import { connectSensor, disconnectSensor, loadPower, setLedPower } from './lib/device'
import type { Reading, Status } from './lib/device'

export default function App() {
  const [status, setStatus] = useState<Status>('disconnected')
  const [power, setPower] = useState(false)
  const [powerLocalOnly, setPowerLocalOnly] = useState(false)
  const [readings, setReadings] = useState<Reading[]>([])

  useEffect(() => {
    let active = true
    void loadPower().then((initialPower) => {
      if (active) {
        setPower(initialPower.on)
        setPowerLocalOnly(initialPower.localOnly)
      }
    })

    return () => {
      active = false
      void disconnectSensor()
    }
  }, [])

  const handleConnect = async () => {
    if (status === 'connected') {
      try {
        await disconnectSensor()
        setStatus('disconnected')
      } catch (error) {
        console.error('센서 연결을 해제하지 못했습니다.', error)
        setStatus('error')
      }
      return
    }

    try {
      await connectSensor({
        onInit: (rows) => setReadings(rows.slice(-MAX_POINTS)),
        onReading: (reading) => {
          setReadings((current) => [...current, reading].slice(-MAX_POINTS))
        },
        onStatus: setStatus,
      })
    } catch (error) {
      console.error('센서에 연결하지 못했습니다.', error)
      setStatus('error')
    }
  }

  const handlePowerChange = async (nextPower: boolean) => {
    const previousPower = power
    setPower(nextPower)

    try {
      const result = await setLedPower(nextPower)
      setPowerLocalOnly(result.localOnly)
      if (!result.success) setPower(previousPower)
      return result.success
    } catch (error) {
      console.error('LED 전원을 변경하지 못했습니다.', error)
      setPower(previousPower)
      return false
    }
  }

  useEffect(() => {
    document.title = PRODUCT.name || '[제품 이름]'
  }, [])

  return (
    <main className="app-shell">
      <ProductHeader />
      <SensorMoon power={power} readings={readings} />
      <div className="content-grid">
        <section className="controls" aria-label="조명 제어">
          <ConnectionControl status={status} onToggle={handleConnect} />
          <PowerToggle
            power={power}
            localOnly={powerLocalOnly}
            onChange={handlePowerChange}
          />
        </section>
        <SensorChart readings={readings} />
      </div>
    </main>
  )
}
