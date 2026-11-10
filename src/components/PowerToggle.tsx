import { useState } from 'react'

export function PowerToggle({
  power,
  localOnly,
  onChange,
}: {
  power: boolean
  localOnly: boolean
  onChange: (nextPower: boolean) => Promise<boolean>
}) {
  const [failed, setFailed] = useState(false)
  const [pending, setPending] = useState(false)

  const togglePower = async () => {
    if (pending) return
    setPending(true)
    setFailed(false)
    try {
      setFailed(!(await onChange(!power)))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="power-control">
      <div className="control-row">
        <div className="control-copy">
          <span className="t-label control-name">LED 전원</span>
          <span className="t-caption power-state">{power ? '켜짐' : '꺼짐'}</span>
        </div>
        <button
          className="switch-button"
          type="button"
          role="switch"
          aria-checked={power}
          aria-label="LED 전원"
          onClick={() => void togglePower()}
          disabled={pending}
        >
          <span className={`switch-track${power ? ' is-on' : ''}`}>
            <span className="switch-thumb" />
          </span>
        </button>
      </div>
      {failed && (
        <p className="t-caption power-error" role="status">
          전원 변경 실패, 다시 시도
        </p>
      )}
      {localOnly && (
        <p className="t-caption power-local">화면 밝기 미리보기 전용</p>
      )}
    </div>
  )
}
