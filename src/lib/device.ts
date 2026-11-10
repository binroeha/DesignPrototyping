import type { RealtimeChannel } from '@supabase/supabase-js'
import { DEVICE_ID, MAX_POINTS } from '../product'
import { db, isDemoMode } from './supabase'

export type Reading = { value: number; created_at: string }
export type Status = 'disconnected' | 'connecting' | 'connected' | 'error'
export type PowerUpdate = { success: boolean; localOnly: boolean }

type ConnectOptions = {
  onInit: (rows: Reading[]) => void
  onReading: (row: Reading) => void
  onStatus: (status: Status) => void
}

let activeChannel: RealtimeChannel | null = null

function createDemoReading(): Reading {
  return {
    value: 2048,
    created_at: new Date().toISOString(),
  }
}

function isReading(value: unknown): value is Reading {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.value === 'number' &&
    Number.isFinite(candidate.value) &&
    typeof candidate.created_at === 'string' &&
    Number.isFinite(Date.parse(candidate.created_at))
  )
}

export async function connectSensor({
  onInit,
  onReading,
  onStatus,
}: ConnectOptions): Promise<void> {
  onStatus('connecting')

  if (isDemoMode || db === null) {
    onInit([])
    onReading(createDemoReading())
    onStatus('connected')
    return
  }

  let readingTable: 'sensor_readings' | 'readings' = 'sensor_readings'
  try {
    let { data, error } = await db
      .from('sensor_readings')
      .select('value, created_at')
      .eq('device_id', DEVICE_ID)
      .order('created_at', { ascending: false })
      .limit(MAX_POINTS)

    if (error?.code === 'PGRST205') {
      readingTable = 'readings'
      const legacyResult = await db
        .from(readingTable)
        .select('value, created_at')
        .order('created_at', { ascending: false })
        .limit(MAX_POINTS)
      data = legacyResult.data
      error = legacyResult.error
      if (!error) {
        console.info(
          'sensor_readings 테이블이 없어 기존 readings 테이블을 사용합니다.',
        )
      }
    }
    if (error) throw error
    onInit((data ?? []).reverse())

    activeChannel = db
      .channel(`sensor-readings-${DEVICE_ID}`)
      .on(
        'postgres_changes',
        readingTable === 'sensor_readings'
          ? {
          event: 'INSERT',
          schema: 'public',
          table: readingTable,
          filter: `device_id=eq.${DEVICE_ID}`,
            }
          : {
              event: 'INSERT',
              schema: 'public',
              table: readingTable,
            },
        (payload) => {
          if (isReading(payload.new)) {
            onReading({
              value: payload.new.value,
              created_at: payload.new.created_at,
            })
          } else {
            console.error('센서 데이터 형식이 올바르지 않습니다.', payload.new)
          }
        },
      )
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') onStatus('connected')
        if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          console.error(`Supabase Realtime 연결 실패: ${state}`)
          onStatus('error')
        }
      })
  } catch (error) {
    onStatus('error')
    throw error
  }
}

export async function disconnectSensor(): Promise<void> {
  if (activeChannel !== null && db !== null) {
    const channel = activeChannel
    activeChannel = null
    await db.removeChannel(channel)
  }
}

export async function setLedPower(on: boolean): Promise<PowerUpdate> {
  if (isDemoMode || db === null) return { success: true, localOnly: true }

  const { error } = await db.from('device_state').upsert(
    {
      device_id: DEVICE_ID,
      led_on: on,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'device_id' },
  )

  if (error) {
    if (error.code === 'PGRST205') {
      console.warn('device_state 테이블이 없어 전원 상태는 이 화면에서만 변경됩니다.')
      return { success: true, localOnly: true }
    }
    console.error('device_state 전원 값을 저장하지 못했습니다.', error)
    return { success: false, localOnly: false }
  }
  return { success: true, localOnly: false }
}

export async function loadPower(): Promise<{ on: boolean; localOnly: boolean }> {
  if (isDemoMode || db === null) return { on: false, localOnly: true }

  const { data, error } = await db
    .from('device_state')
    .select('led_on')
    .eq('device_id', DEVICE_ID)
    .maybeSingle()

  if (error) {
    if (error.code === 'PGRST205') {
      console.warn('device_state 테이블이 없어 전원 상태는 이 화면에서만 변경됩니다.')
      return { on: true, localOnly: true }
    }
    console.error('device_state 전원 값을 불러오지 못했습니다.', error)
    return { on: false, localOnly: false }
  }
  return { on: data?.led_on ?? false, localOnly: false }
}
