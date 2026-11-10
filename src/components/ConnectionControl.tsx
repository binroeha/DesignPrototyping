import type { Status } from '../lib/device'
import { isDemoMode } from '../lib/supabase'

export function ConnectionControl({
  status,
  onToggle,
}: {
  status: Status
  onToggle: () => void
}) {
  const connected = status === 'connected'
  const busy = status === 'connecting'
  const statusText: Record<Status, string> = isDemoMode
    ? {
        disconnected: '데모 대기',
        connecting: '데모 시작 중…',
        connected: '데모 실행 중',
        error: '데모 시작 실패',
      }
    : {
        disconnected: '연결 안 됨',
        connecting: '연결 중…',
        connected: '연결됨',
        error: '연결 실패, 다시 시도',
      }
  const buttonText = isDemoMode
    ? connected
      ? '데모 중지'
      : '데모 시작'
    : connected
      ? '연결 끊기'
      : '센서 연결'

  return (
    <div className="control-row">
      <div className="control-copy">
        <span className="t-label control-name">센서</span>
        <span className={`t-label connection-status status-${status}`} role="status">
          <span className="status-dot" aria-hidden="true" />
          {statusText[status]}
        </span>
      </div>
      <button
        className={`t-label connection-button${connected ? ' button-secondary' : ''}`}
        type="button"
        onClick={onToggle}
        disabled={busy}
      >
        {buttonText}
      </button>
    </div>
  )
}
