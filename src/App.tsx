import { useEffect, useMemo, useRef, useState } from 'react'

const periods = ['1일 이내', '2일 이내', '3일 이내', '10일 이내', '1개월 이내', '3개월 이내', '6개월 이내', '1년 이내', '1년 초과']
const totals = [213691, 11941, 16135, 120264, 237910, 300945, 135562, 80592, 103302]
const crimes = [
  { name: '지능범죄', total: 303077, values: [6444,534,668,6556,29436,84343,63329,44084,66377], color: '#7c3aed' },
  { name: '교통범죄', total: 207373, values: [107345,3724,4958,28897,36818,19522,3317,1055,1700], color: '#0ea5e9' },
  { name: '폭력범죄', total: 188287, values: [38453,2422,4421,32765,56079,39886,7794,2927,3277], color: '#f97316' },
  { name: '절도범죄', total: 121862, values: [11222,1993,2261,19029,39045,34896,7974,2568,2670], color: '#14b8a6' },
  { name: '특별경제범죄', total: 102790, values: [7353,924,968,8630,18886,40036,14130,5719,5160], color: '#ec4899' },
  { name: '강력범죄', total: 22473, values: [3801,151,158,1395,4892,7631,2111,938,1192], color: '#ef4444' },
  { name: '풍속범죄', total: 23388, values: [2953,96,154,1000,2741,6081,3422,3741,3037], color: '#d946ef' },
  { name: '마약범죄', total: 10557, values: [1662,133,109,562,1483,2516,1660,1249,1095], color: '#6366f1' },
  { name: '보건범죄', total: 7899, values: [276,79,104,1026,2176,2101,890,493,706], color: '#10b981' },
  { name: '환경범죄', total: 2269, values: [43,30,19,288,686,687,223,122,144], color: '#84cc16' },
  { name: '노동범죄', total: 275, values: [8,2,5,21,48,60,55,33,43], color: '#f59e0b' },
  { name: '안보범죄', total: 355, values: [6,2,0,9,11,46,36,80,155], color: '#64748b' },
  { name: '선거범죄', total: 1872, values: [256,63,61,258,463,444,217,43,54], color: '#06b6d4' },
  { name: '병역범죄', total: 7816, values: [105,109,133,968,1987,2576,774,453,688], color: '#8b5cf6' },
  { name: '기타범죄', total: 224752, values: [33764,1679,2116,18860,43159,60120,29630,17087,17004], color: '#94a3b8' },
]

const format = (value: number) => new Intl.NumberFormat('ko-KR').format(value)

const shadeRank = (values: number[], index: number) => {
  const sorted = [...values].sort((a, b) => b - a)
  return `shade-${sorted.indexOf(values[index]) + 1}`
}

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon">{children}</span>
}

type ArduinoPort = {
  open: (options: { baudRate: number }) => Promise<void>
  close: () => Promise<void>
  readable: ReadableStream<Uint8Array> | null
}

export default function App() {
  const [selected, setSelected] = useState('전체 범죄')
  const [activePeriod, setActivePeriod] = useState(5)
  const [page, setPage] = useState<'dashboard' | 'insights' | 'sensors'>('dashboard')
  const [sensors, setSensors] = useState({ angle: 11, dev: 0, level: 0, brightness: 0, origin: 11 })
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [serialConnected, setSerialConnected] = useState(false)
  const [serialConnecting, setSerialConnecting] = useState(false)
  const [serialMessage, setSerialMessage] = useState('데모 데이터 표시 중')
  const [serialValue, setSerialValue] = useState<number | null>(null)
  const [serialHistory, setSerialHistory] = useState<number[]>([])
  const serialPort = useRef<ArduinoPort | null>(null)
  const serialConnectingRef = useRef(false)
  const visible = useMemo(() => selected === '전체 범죄'
    ? [{ name: '전체 범죄', total: 1225045, values: totals, color: '#7c3aed' }]
    : crimes.filter((c) => c.name === selected), [selected])
  const selectedCrime = crimes.find((crime) => crime.name === selected)
  const chartValues = selectedCrime?.values ?? totals
  const total = selectedCrime?.total ?? 1225045
  const max = Math.max(...chartValues)
  const peakIndex = chartValues.indexOf(max)
  const withinDay = chartValues[0]
  const afterYear = chartValues[8]
  const rate = (value: number) => (value / total * 100).toFixed(1)
  const serialChartPoints = useMemo(() => {
    if (serialHistory.length < 2) return ''
    const min = Math.min(...serialHistory)
    const range = Math.max(...serialHistory) - min || 1
    return serialHistory.map((value, index) => {
      const x = index / (serialHistory.length - 1) * 800
      const y = 190 - (value - min) / range * 170
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }, [serialHistory])

  useEffect(() => {
    if (page !== 'sensors' || serialConnected) return
    const timer = window.setInterval(() => {
      setSensors((current) => {
        const dev = +(current.dev + (Math.random() - .48) * 3).toFixed(1)
        const level = dev > 6 ? Math.max(current.level, Math.min(1, (dev - 6) / 54)) : dev < -15 ? 0 : current.level
        return { ...current, angle: +(current.origin + dev).toFixed(1), dev, level: +level.toFixed(2), brightness: Math.round(Math.pow(level, 1.8) * 255) }
      })
      setLastUpdate(new Date())
    }, 2500)
    return () => window.clearInterval(timer)
  }, [page, serialConnected])

  const connectSerial = async () => {
    if (serialConnectingRef.current || serialPort.current) return
    const serial = (navigator as Navigator & { serial?: { requestPort: () => Promise<ArduinoPort> } }).serial
    if (!serial) {
      setSerialMessage('이 브라우저는 Web Serial을 지원하지 않습니다')
      return
    }

    serialConnectingRef.current = true
    setSerialConnecting(true)
    let port: ArduinoPort | null = null
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
    let streamEnded = false
    try {
      port = await serial.requestPort()
      await port.open({ baudRate: 9600 })
      serialPort.current = port
      setSerialConnected(true)
      setSerialMessage('Arduino Uno · 9600 baud')
      const readable = port.readable
      if (!readable) throw new Error('선택한 포트에서 데이터를 읽을 수 없습니다')
      reader = readable.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })
        const lines = buffer.split(/\r?\n/)
        buffer = done ? '' : lines.pop() ?? ''
        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine) continue
          const originMatch = trimmedLine.match(/origin:\s*(-?[\d.]+)/i)
          if (originMatch) setSensors((current) => ({ ...current, origin: Number(originMatch[1]) }))
          const data = trimmedLine.match(/angle:\s*(-?[\d.]+)\s+dev:\s*(-?[\d.]+)\s+level:\s*([\d.]+)\s+brightness:\s*(\d+)/i)
          const value = data ? Number(data[1]) : Number(trimmedLine)
          if (Number.isFinite(value)) {
            setSerialValue(value)
            setSerialHistory((current) => [...current, value].slice(-100))
            setLastUpdate(new Date())
          }
          if (data) {
            setSensors((current) => ({ ...current, angle: Number(data[1]), dev: Number(data[2]), level: Number(data[3]), brightness: Number(data[4]) }))
          }
        }
        if (done) {
          streamEnded = true
          break
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류'
      setSerialMessage(error instanceof DOMException && error.name === 'NotFoundError'
        ? '포트 선택이 취소되었습니다'
        : `시리얼 연결 오류: ${message}`)
    } finally {
      reader?.releaseLock()
      if (port) {
        if (serialPort.current === port) serialPort.current = null
        try {
          await port.close()
          if (streamEnded) setSerialMessage('시리얼 연결이 종료되었습니다')
        } catch (error) {
          const message = error instanceof Error ? error.message : '알 수 없는 오류'
          setSerialMessage(`시리얼 포트 종료 오류: ${message}`)
        }
      }
      serialConnectingRef.current = false
      setSerialConnecting(false)
      setSerialConnected(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">D</span><span>DATA SCOPE</span></div>
        <nav>
          <p className="nav-label">OVERVIEW</p>
          <a className={`nav-item ${page === 'dashboard' ? 'active' : ''}`} href="#dashboard" onClick={() => setPage('dashboard')}><Icon>⌁</Icon>분석 대시보드</a>
          <a className={`nav-item ${page === 'insights' ? 'active' : ''}`} href="#insights" onClick={() => setPage('insights')}><Icon>◇</Icon>핵심 인사이트</a>
          <a className={`nav-item ${page === 'sensors' ? 'active' : ''}`} href="#sensors" onClick={() => setPage('sensors')}><Icon>◉</Icon>센서 모니터링</a>
          <p className="nav-label second">DATA</p>
          <a className="nav-item" href="/crime-arrest-period-2025.csv" download><Icon>↓</Icon>데이터 다운로드</a>
        </nav>
        <div className="source-card">
          <div className="source-icon">i</div>
          <strong>데이터 출처</strong>
          <p>경찰청 범죄통계<br />2025년 기준</p>
          <span>최근 업데이트 2026.10.27</span>
        </div>
      </aside>

      <main>
        <div className={`dashboard-page ${page !== 'dashboard' ? 'is-hidden' : ''}`} id="dashboard">
        <header>
          <div>
            <p className="eyebrow">CRIME DATA INSIGHT</p>
            <h1>범죄 발생부터 검거까지</h1>
            <p className="subtitle">2025년 범죄 유형별 검거 소요기간을 한눈에 살펴보세요.</p>
          </div>
          <div className="header-actions">
            <label className="select-wrap">
              <span>범죄 유형</span>
              <select value={selected} onChange={(e) => { setSelected(e.target.value); setActivePeriod(5) }}>
                <option>전체 범죄</option>
                {crimes.map((c) => <option key={c.name}>{c.name}</option>)}
              </select>
            </label>
            <button className="serial-button dashboard-serial-button" onClick={connectSerial} disabled={serialConnected || serialConnecting}>
              {serialConnected ? '시리얼 연결됨' : serialConnecting ? '포트 선택 중…' : '시리얼 연결'}
            </button>
            <a className="download" href="/crime-arrest-period-2025.csv" download>↓&nbsp;&nbsp;CSV 내보내기</a>
          </div>
        </header>

        <section className="kpis">
          <article className="kpi">
            <div className="kpi-top"><span>전체 검거 건수</span><b className="purple">TOTAL</b></div>
            <strong>{format(total)}<small>건</small></strong>
            <p><em>{selected === '전체 범죄' ? '전체' : selected}</em> 선택 결과</p>
          </article>
          <article className="kpi">
            <div className="kpi-top"><span>1일 이내 검거</span><b className="blue">FAST</b></div>
            <strong>{format(withinDay)}<small>건</small></strong>
            <p><em>{rate(withinDay)}%</em> 선택 유형 중</p>
          </article>
          <article className="kpi">
            <div className="kpi-top"><span>평균 검거 집중 구간</span><b className="teal">PEAK</b></div>
            <strong>{periods[peakIndex]}</strong>
            <p><em>{rate(max)}%</em> {format(max)}건</p>
          </article>
          <article className="kpi">
            <div className="kpi-top"><span>1년 초과 장기 검거</span><b className="orange">LONG</b></div>
            <strong>{format(afterYear)}<small>건</small></strong>
            <p><em className="orange-text">{rate(afterYear)}%</em> 선택 유형 중</p>
          </article>
        </section>

        <section className="serial-dashboard">
          <article className="panel serial-current">
            <div className="panel-heading">
              <div><h2>현재 시리얼 값</h2><p>{serialConnected ? 'Arduino에서 실시간 수신 중' : serialMessage}</p></div>
              <span className={`live-dot ${serialConnected ? '' : 'demo'}`} />
            </div>
            <strong>{serialValue === null ? '—' : serialValue.toLocaleString('ko-KR', { maximumFractionDigits: 4 })}</strong>
            <span>{serialValue === null ? '연결 후 숫자 데이터가 표시됩니다' : `최근 수신 ${lastUpdate.toLocaleTimeString('ko-KR')}`}</span>
          </article>
          <article className="panel serial-chart-panel">
            <div className="panel-heading">
              <div><h2>최근 수신값</h2><p>시리얼 입력의 최근 100개 · 메모리에서만 표시</p></div>
              <span className="serial-chart-legend"><i />값</span>
            </div>
            <div className="serial-chart">
              <div className="chart-grid"><i /><i /><i /><i /></div>
              <svg viewBox="0 0 800 210" preserveAspectRatio="none" role="img" aria-label="시리얼 데이터 최근 100개 선 그래프">
                {serialHistory.length > 1 && <polyline points={serialChartPoints} />}
                {serialHistory.length === 1 && <circle cx="400" cy="105" r="4" />}
              </svg>
              {serialHistory.length === 0 && <span className="serial-chart-empty">시리얼 연결 후 데이터가 표시됩니다</span>}
            </div>
            <div className="serial-chart-footer"><span>{serialHistory.length} / 100개</span><span>9600 baud</span></div>
          </article>
        </section>

        <section className="grid">
          <article className="panel distribution">
            <div className="panel-heading">
              <div><h2>검거 소요기간 분포</h2><p>전체 범죄의 기간별 검거 건수</p></div>
              <span className="legend"><i /> 검거 건수</span>
            </div>
            <div className="chart">
              {chartValues.map((value, index) => (
                <button className={`bar-item ${activePeriod === index ? 'selected' : ''}`} key={periods[index]} onClick={() => setActivePeriod(index)}>
                  <span className="bar-value">{format(value)}</span>
                  <span className="bar-track"><span className="bar" style={{ height: `${Math.max(6, value / max * 100)}%` }} /></span>
                  <span className="bar-label">{periods[index]}</span>
                </button>
              ))}
            </div>
            <div className="chart-note">
              <span><b>{periods[activePeriod]}</b> 선택 구간의 검거 현황입니다.</span>
              <strong>{format(chartValues[activePeriod])}건 · {rate(chartValues[activePeriod])}%</strong>
            </div>
          </article>

        </section>

        <section className="panel comparison">
          <div className="panel-heading">
            <div><h2>{selected === '전체 범죄' ? '전체 범죄 검거 속도' : `${selected} 검거 속도`}</h2><p>전체 검거 건수를 모수로 9개 검거기간의 비중을 비교합니다</p></div>
            <div className="speed-legend"><span><i className="d1" />진한 색일수록 높은 비중</span></div>
          </div>
          <div className="crime-list">
            {visible.map((crime) => (
              <div className="crime-row" key={crime.name}>
                <div className="crime-name"><span style={{ background: crime.color }} /> <b>{crime.name}</b><small>{format(crime.total)}건</small></div>
                <div className="stack-visual">
                  <div className="segment-labels">
                    {crime.values.map((value, index, segments) => (
                      <span className={shadeRank(segments, index).replace('shade', 'text')} key={index} style={{ width: `${value / crime.total * 100}%` }}>
                        <small>{periods[index]}</small>
                        <b>{(value / crime.total * 100).toFixed(1)}%</b>
                      </span>
                    ))}
                  </div>
                  <div className="stack">
                    {crime.values.map((value, index, segments) => (
                      <i className={shadeRank(segments, index)} key={index} style={{ width: `${value / crime.total * 100}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        </div>

        <section className={`insights-page ${page !== 'insights' ? 'is-hidden' : ''}`} id="insights">
          <header>
            <div>
              <p className="eyebrow">CRIME DATA INSIGHT</p>
              <h1>핵심 인사이트</h1>
              <p className="subtitle">2025년 범죄 검거 데이터에서 발견한 주요 특징입니다.</p>
            </div>
          </header>
          <div className="insight-grid">
            <article className="panel insight-card violet-card">
              <span className="insight-num violet">01</span>
              <p className="insight-kicker">FASTEST ARREST</p>
              <h2>교통범죄는 절반 이상이<br />하루 안에 검거됩니다</h2>
              <strong className="insight-stat">51.8%</strong>
              <p>현장 적발 비중이 높아 전체 범죄유형 중 1일 이내 검거율이 가장 높습니다.</p>
            </article>
            <article className="panel insight-card sky-card">
              <span className="insight-num sky">02</span>
              <p className="insight-kicker">LONG-TERM INVESTIGATION</p>
              <h2>지능범죄는 장기 수사가<br />두드러집니다</h2>
              <strong className="insight-stat">57.7%</strong>
              <p>사기·횡령 등 복잡한 사건이 많아 3개월 이후 검거 비중이 가장 높습니다.</p>
            </article>
            <article className="panel insight-card amber-card">
              <span className="insight-num amber">03</span>
              <p className="insight-kicker">GOLDEN TIME</p>
              <h2>사건 해결의 골든타임은<br />수사 개시 후 3개월입니다</h2>
              <strong className="insight-stat">65.4%</strong>
              <p>전체 사건의 약 3분의 2가 발생 이후 3개월 이내에 검거로 이어집니다.</p>
            </article>
          </div>
        </section>

        <section className={`sensors-page ${page !== 'sensors' ? 'is-hidden' : ''}`} id="sensors">
          <header>
            <div>
              <p className="eyebrow">ARDUINO SENSOR MONITOR</p>
              <h1>MPU6050 조명 제어 모니터</h1>
              <p className="subtitle">기울기와 LED 스트립 PWM 출력 상태를 실시간으로 확인하세요.</p>
            </div>
            <div className="sensor-status">
              <span className={`live-dot ${serialConnected ? '' : 'demo'}`} />
              <div><strong>{serialConnected ? '실제 장치 연결됨' : serialMessage}</strong><small>최근 갱신 {lastUpdate.toLocaleTimeString('ko-KR')}</small></div>
              <button className="serial-button" onClick={connectSerial} disabled={serialConnected || serialConnecting}>{serialConnected ? '연결됨' : serialConnecting ? '포트 선택 중…' : '장치 연결'}</button>
            </div>
          </header>

          <div className="sensor-kpis">
            <article className="panel sensor-card temperature">
              <div className="sensor-card-top"><span className="sensor-symbol">∠</span><em>ROLL</em></div>
              <p>현재 측정 각도</p><strong>{sensors.angle.toFixed(1)}<small>°</small></strong>
              <div className="sensor-range"><i style={{ width: `${Math.min(100, Math.max(0, (sensors.angle + 90) / 1.8))}%` }} /></div>
              <span>MPU6050 roll 축 측정값</span>
            </article>
            <article className="panel sensor-card humidity">
              <div className="sensor-card-top"><span className="sensor-symbol">Δ</span><em>{sensors.dev > 6 ? '앞' : sensors.dev < -15 ? '뒤' : '유지'}</em></div>
              <p>보정된 기울기</p><strong>{sensors.dev.toFixed(1)}<small>°</small></strong>
              <div className="sensor-range"><i style={{ width: `${Math.min(100, Math.max(0, (sensors.dev + 60) / 1.2))}%` }} /></div>
              <span>smoothDev · 원점 대비 편차</span>
            </article>
            <article className="panel sensor-card air">
              <div className="sensor-card-top"><span className="sensor-symbol">L</span><em>{sensors.level > 0 ? '켜짐' : '꺼짐'}</em></div>
              <p>밝기 레벨</p><strong>{(sensors.level * 100).toFixed(0)}<small>%</small></strong>
              <div className="sensor-range"><i style={{ width: `${sensors.level * 100}%` }} /></div>
              <span>level {sensors.level.toFixed(2)} · 이전 최대값 유지</span>
            </article>
            <article className="panel sensor-card light">
              <div className="sensor-card-top"><span className="sensor-symbol">P</span><em>PIN 9</em></div>
              <p>PWM 출력</p><strong>{sensors.brightness}<small>/ 255</small></strong>
              <div className="sensor-range"><i style={{ width: `${sensors.brightness / 2.55}%` }} /></div>
              <span>감마 1.8 적용 출력값</span>
            </article>
          </div>

          <div className="sensor-layout">
            <article className="panel sensor-chart-panel">
              <div className="panel-heading">
                <div><h2>실시간 기울기 변화</h2><p>roll 각도와 보정 편차의 최근 변화</p></div>
                <div className="sensor-legend"><span><i className="temp-line" />angle</span><span><i className="humid-line" />smoothDev</span></div>
              </div>
              <div className="sensor-chart">
                <div className="chart-grid"><i /><i /><i /><i /></div>
                <svg viewBox="0 0 800 210" preserveAspectRatio="none" aria-label="최근 기울기 변화 그래프">
                  <polyline className="temp-path" points="0,126 80,119 160,128 240,109 320,114 400,92 480,99 560,78 640,87 720,70 800,74" />
                  <polyline className="humid-path" points="0,76 80,88 160,81 240,95 320,84 400,102 480,96 560,110 640,103 720,118 800,111" />
                </svg>
                <div className="chart-times"><span>50초 전</span><span>40초 전</span><span>30초 전</span><span>20초 전</span><span>현재</span></div>
              </div>
            </article>
            <article className="panel device-panel">
              <div className="panel-heading"><div><h2>제어 설정</h2><p>현재 스케치 기준값</p></div></div>
              <div className="device-visual"><div className="board"><span>UNO</span><i /><i /><i /><i /></div></div>
              <dl>
                <div><dt>센서 / 주소</dt><dd>MPU6050 / 0x68</dd></div>
                <div><dt>축 / 방향</dt><dd>ROLL / +1.0</dd></div>
                <div><dt>자동 원점</dt><dd>{sensors.origin.toFixed(2)}°</dd></div>
                <div><dt>유지 / 최대 구간</dt><dd>6° / 60°</dd></div>
                <div><dt>OFF 기준 / 확인</dt><dd>-15° / 100ms</dd></div>
                <div><dt>평활 / 감마</dt><dd>0.4 / 1.8</dd></div>
                <div><dt>수집 주기</dt><dd>20ms · 50Hz</dd></div>
                <div><dt>스트립 상태</dt><dd className={sensors.brightness > 0 ? 'online' : ''}>{sensors.brightness > 0 ? `출력 중 · ${sensors.brightness}` : '꺼짐'}</dd></div>
              </dl>
              <p className="demo-note">{serialConnected ? 'Arduino 시리얼 데이터를 실시간 수신하고 있습니다.' : '장치 연결을 누르면 브라우저에서 Arduino 포트를 선택할 수 있습니다. 연결 전에는 샘플 데이터가 표시됩니다.'}</p>
            </article>
          </div>
        </section>
        <footer>{page === 'sensors'
          ? '센서 화면은 샘플 데이터로 동작합니다. 실제 측정값 사용을 위해 Arduino 시리얼 연동이 필요합니다.'
          : '경찰청 범죄통계 원자료를 기반으로 시각화했습니다. 단위: 건, 구성비는 반올림으로 합계가 다를 수 있습니다.'}</footer>
      </main>
    </div>
  )
}
