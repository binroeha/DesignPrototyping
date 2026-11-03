import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

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

type ReadingRow = {
  id: number | string
  value: number
  created_at: string
}

function isReadingRow(row: unknown): row is ReadingRow {
  if (typeof row !== 'object' || row === null) return false
  const candidate = row as Record<string, unknown>
  return (
    (typeof candidate.id === 'number' || typeof candidate.id === 'string') &&
    typeof candidate.value === 'number' &&
    Number.isFinite(candidate.value) &&
    typeof candidate.created_at === 'string' &&
    Number.isFinite(Date.parse(candidate.created_at))
  )
}

function mergeReadings(current: ReadingRow[], incoming: ReadingRow[]) {
  const byId = new Map(current.map((reading) => [String(reading.id), reading]))
  for (const reading of incoming) byId.set(String(reading.id), reading)
  return [...byId.values()]
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || String(a.id).localeCompare(String(b.id)))
    .slice(-100)
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

export default function App() {
  const [selected, setSelected] = useState('전체 범죄')
  const [activePeriod, setActivePeriod] = useState(5)
  const [page, setPage] = useState<'dashboard' | 'insights' | 'sensors'>('dashboard')
  const [readings, setReadings] = useState<ReadingRow[]>([])
  const [readingsLoading, setReadingsLoading] = useState(true)
  const [readingsError, setReadingsError] = useState('')
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
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
  const readingValues = useMemo(() => readings.map((reading) => reading.value), [readings])
  const latestReading = readings.at(-1)
  const readingChartPoints = useMemo(() => {
    if (readingValues.length < 2) return ''
    return readingValues.map((value, index) => {
      const x = 56 + index / (readingValues.length - 1) * 744
      const clampedValue = Math.min(60, Math.max(-30, value))
      const y = 190 - (clampedValue + 30) * 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }, [readingValues])
  const latestReadingY = latestReading
    ? 190 - (Math.min(60, Math.max(-30, latestReading.value)) + 30) * 2
    : 130

  useEffect(() => {
    if (!supabase) {
      setReadingsError('VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY가 .env에 없습니다.')
      setReadingsLoading(false)
      setRealtimeStatus('error')
      return
    }

    let active = true
    let initialLoadComplete = false
    const pendingRealtimeRows: ReadingRow[] = []
    const channel = supabase
      .channel('dashboard-readings')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'readings' }, (payload) => {
        const row: unknown = payload.new
        if (!isReadingRow(row)) {
          setReadingsError('Realtime 행에서 id, value, created_at 값을 읽을 수 없습니다.')
          return
        }
        if (initialLoadComplete) {
          setReadings((current) => mergeReadings(current, [row]))
        } else {
          pendingRealtimeRows.push(row)
        }
      })
      .subscribe((status) => {
        if (!active) return
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected')
          setReadingsError('')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('error')
          setReadingsError(`Supabase Realtime 연결 실패: ${status}`)
        } else if (status === 'CLOSED') {
          setRealtimeStatus('error')
        }
      })

    const loadReadings = async () => {
      const { data, error } = await supabase
        .from('readings')
        .select('id, value, created_at')
        .order('created_at', { ascending: false })
        .limit(100)

      if (!active) return
      if (error) {
        setReadingsError(`Supabase readings 조회 실패: ${error.message}`)
        setReadingsLoading(false)
        initialLoadComplete = true
        if (pendingRealtimeRows.length) setReadings((current) => mergeReadings(current, pendingRealtimeRows))
        return
      }

      const initialRows = (data ?? []).filter(isReadingRow).reverse()
      setReadings(mergeReadings(initialRows, pendingRealtimeRows))
      initialLoadComplete = true
      setReadingsLoading(false)
    }

    void loadReadings()
    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [supabase])

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
              <p className="eyebrow">MPU TILT MONITOR</p>
              <h1>기울기 측정</h1>
              <p className="subtitle">기준 자세에서 벗어난 기울기만 Supabase에서 실시간으로 확인합니다.</p>
            </div>
            <div className="sensor-status">
              <span className={`live-dot ${realtimeStatus === 'connected' ? '' : 'demo'}`} />
              <div>
                <strong>{readingsError || (realtimeStatus === 'connected' ? 'Supabase Realtime 연결됨' : 'Supabase Realtime 연결 중')}</strong>
                <small>{readingsLoading ? '초기 데이터 조회 중' : 'readings INSERT 구독'}</small>
              </div>
            </div>
          </header>

          <div className="sensor-kpis tilt-kpis">
            <article className="panel sensor-card temperature">
              <div className="sensor-card-top"><span className="sensor-symbol">∠</span><em>기울기</em></div>
              <p>기준 자세 대비 기울기</p>
              <strong>{latestReading ? latestReading.value.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) : '—'}<small>°</small></strong>
              <span>{readingsLoading ? 'Supabase에서 데이터 조회 중' : readingsError || (latestReading ? `마지막 측정 ${new Date(latestReading.created_at).toLocaleString('ko-KR')}` : '아직 저장된 기울기 값이 없습니다')}</span>
            </article>
          </div>

          <div className="sensor-layout">
            <article className="panel sensor-chart-panel">
              <div className="panel-heading">
                <div><h2>최근 기울기 변화</h2><p>원점 대비 편차(dev) · 최근 100개</p></div>
                <span className="serial-chart-legend"><i />각도 (°)</span>
              </div>
              <div className="serial-chart">
                <svg viewBox="0 0 800 210" preserveAspectRatio="none" role="img" aria-label="기준 자세 대비 기울기 최근 100개 선 그래프">
                  <text className="tilt-axis-title" x="14" y="100" transform="rotate(-90 14 100)">기울기 (°)</text>
                  <line className="tilt-axis" x1="52" y1="10" x2="52" y2="190" />
                  <line className="tilt-gridline" x1="52" y1="10" x2="800" y2="10" />
                  <line className="tilt-gridline" x1="52" y1="70" x2="800" y2="70" />
                  <line className="tilt-zero-axis" x1="52" y1="130" x2="800" y2="130" />
                  <line className="tilt-gridline" x1="52" y1="190" x2="800" y2="190" />
                  <text className="tilt-axis-label" x="44" y="14" textAnchor="end">60°</text>
                  <text className="tilt-axis-label" x="44" y="74" textAnchor="end">30°</text>
                  <text className="tilt-axis-label" x="44" y="134" textAnchor="end">0°</text>
                  <text className="tilt-axis-label" x="44" y="194" textAnchor="end">-30°</text>
                  {readingValues.length > 1 && <polyline points={readingChartPoints} />}
                  {readingValues.length === 1 && <circle cx="428" cy={latestReadingY} r="4" />}
                </svg>
                {readingValues.length === 0 && <span className="serial-chart-empty">{readingsLoading ? '데이터 조회 중…' : readingsError || '표시할 측정값이 없습니다'}</span>}
              </div>
              <div className="serial-chart-footer">
                <span>{readings.length} / 100개</span>
                <span>{readingsError || (realtimeStatus === 'connected' ? 'Realtime 구독 중' : 'Realtime 연결 안 됨')}</span>
              </div>
            </article>
            <article className="panel device-panel">
              <div className="panel-heading"><div><h2>Supabase 데이터 연결</h2><p>.env 설정 · Realtime 구독</p></div></div>
              <dl>
                <div><dt>테이블</dt><dd>public.readings</dd></div>
                <div><dt>값 열</dt><dd>value</dd></div>
                <div><dt>초기 조회 범위</dt><dd>최신 100개</dd></div>
                <div><dt>새 행 구독</dt><dd className={realtimeStatus === 'connected' ? 'online' : ''}>{realtimeStatus === 'connected' ? '연결됨' : '연결 안 됨'}</dd></div>
                <div><dt>마지막 기록</dt><dd>{latestReading ? new Date(latestReading.created_at).toLocaleString('ko-KR') : '없음'}</dd></div>
              </dl>
              <p className="demo-note">{readingsError || (readingsLoading ? 'Supabase에서 측정값을 불러오고 있습니다.' : '측정 데이터는 Supabase에서 읽으며, 이 화면에서는 데모 측정값을 생성하지 않습니다.')}</p>
            </article>
          </div>
        </section>
        <footer>{page === 'sensors'
          ? '이 화면은 Supabase readings 데이터만 표시합니다. 임의의 데모 측정값은 생성하지 않습니다.'
          : '경찰청 범죄통계 원자료를 기반으로 시각화했습니다. 단위: 건, 구성비는 반올림으로 합계가 다를 수 있습니다.'}</footer>
      </main>
    </div>
  )
}
