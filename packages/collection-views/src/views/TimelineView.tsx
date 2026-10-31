'use client'

import { type FC, useMemo } from 'react'
import { CalendarDays, cn } from '@oobleck/systheme'
import type { PropertyValue } from '@oobleck/collection'
import { resolveTitleKey, viewRows } from '@oobleck/collection'
import { dateValueStart } from '@oobleck/collection'
import type { ViewSurfaceProps } from './ViewSurface'
import { formatTitleText } from '@oobleck/collection'
import { useCollectionLocale } from '../i18n'
import { timelineViewCopy } from './TimelineView.messages'
import { type ZoomLevel, buildTicks, tickLabel } from './timeline-ticks'

// @oobleck/collection — 타임라인 뷰 렌더러(WAVE3/레인2, ViewConfig.type='timeline').
//
// 결정 C3: 도메인 무관 제네릭 ViewSurface. Phase/청구일 도메인과 결선하지 않음.
// 날짜 프로퍼티(PropertyType='date') 기반의 일반 타임라인.
//
// 순수성 원칙:
//  - wall-clock(zero-arg new Date() / Date.now()) 호출 없음 — 축 범위는 레코드 데이터
//    날짜값에서만 파생한다(현재 시각 비의존). new Date(ts)/new Date(date) 는 데이터 파생값이라 정당.
//  - viewRows 로 필터·정렬 적용. resolveTitleKey 로 제목 결정.
//  - 읽기 전용 배치 + 줌. 드래그 리스케줄·종속성 화살표는 범위 밖(후속 단계).

// ─── 날짜 파싱 헬퍼 ──────────────────────────────────────────────────────────────

/** ISO date string(기간/시간 포함) → *시작* timestamp(ms). 파싱 실패·null 이면 null 반환. */
function parseDate(v: PropertyValue): number | null {
  if (typeof v !== 'string' || v.length === 0) return null
  const t = Date.parse(dateValueStart(v))
  return Number.isNaN(t) ? null : t
}

// 줌 헬퍼·틱 생성·라벨은 순수 모듈로 분리(timeline-ticks.ts) — UTC 일관 보장 + 단위 테스트 용이.

// ─── 축 범위 계산 ────────────────────────────────────────────────────────────────

type AxisRange = { startMs: number; endMs: number }

/**
 * 레코드의 날짜값에서 축 범위를 파생한다 — '현재 시각' 의존 없음.
 * 데이터 min/max 로 범위를 구하고, 줌 단위로 양 끝을 여유분 한 칸씩 확장.
 */
function deriveAxisRange(entries: TimelineEntry[], zoom: ZoomLevel): AxisRange | null {
  if (entries.length === 0) return null

  let minTs = Infinity
  let maxTs = -Infinity
  for (const e of entries) {
    if (e.startMs !== null && e.startMs < minTs) minTs = e.startMs
    if (e.startMs !== null && e.startMs > maxTs) maxTs = e.startMs
    if (e.endMs !== null && e.endMs > maxTs) maxTs = e.endMs
  }
  if (!Number.isFinite(minTs) || !Number.isFinite(maxTs)) return null

  // 줌 단위로 여유분 확장(각 1 단위).
  const PADDING_MS: Record<ZoomLevel, number> = {
    day: 86_400_000,
    week: 7 * 86_400_000,
    month: 31 * 86_400_000,
    quarter: 92 * 86_400_000,
  }
  const pad = PADDING_MS[zoom]
  return { startMs: minTs - pad, endMs: maxTs + pad }
}

// ─── 타입 ────────────────────────────────────────────────────────────────────────

type TimelineEntry = {
  id: string
  title: string
  startMs: number | null
  endMs: number | null
}

// ─── 막대 레이아웃 계산 ──────────────────────────────────────────────────────────

type BarLayout = {
  leftPct: number
  widthPct: number
  hasEnd: boolean
}

function calcBarLayout(
  entry: TimelineEntry,
  axisRange: AxisRange,
  minBarPct: number,
): BarLayout | null {
  const { startMs, endMs } = entry
  if (startMs === null) return null

  const totalMs = axisRange.endMs - axisRange.startMs
  if (totalMs <= 0) return null

  const leftPct = ((startMs - axisRange.startMs) / totalMs) * 100
  const hasEnd = endMs !== null && endMs > startMs

  let widthPct: number
  if (hasEnd && endMs !== null) {
    widthPct = ((endMs - startMs) / totalMs) * 100
  } else {
    widthPct = minBarPct
  }

  // 클램프: 0~100 범위 내.
  const clampedLeft = Math.max(0, Math.min(leftPct, 100))
  const clampedWidth = Math.max(minBarPct, Math.min(widthPct, 100 - clampedLeft))

  return { leftPct: clampedLeft, widthPct: clampedWidth, hasEnd: hasEnd && endMs !== null }
}

// ─── 눈금 라인 컴포넌트 ──────────────────────────────────────────────────────────

type TickLineProps = {
  tick: Date
  axisRange: AxisRange
  zoom: ZoomLevel
  rowCount: number
}

function TickLine({ tick, axisRange, zoom, rowCount }: TickLineProps) {
  const totalMs = axisRange.endMs - axisRange.startMs
  if (totalMs <= 0) return null
  const leftPct = ((tick.getTime() - axisRange.startMs) / totalMs) * 100
  if (leftPct < 0 || leftPct > 100) return null
  return (
    <div className="absolute top-0 flex flex-col" style={{ left: `${leftPct}%` }} aria-hidden>
      {/* 헤더 라벨 */}
      <div className="absolute -top-6 -translate-x-1/2 whitespace-nowrap text-[10px] text-fg-muted">
        {tickLabel(tick, zoom)}
      </div>
      {/* 세로 점선 */}
      <div
        className="absolute border-l border-dashed border-border"
        style={{ height: `${rowCount * 36}px` }}
      />
    </div>
  )
}

// ─── 막대 컴포넌트 ───────────────────────────────────────────────────────────────

type TimelineBarProps = {
  entry: TimelineEntry
  layout: BarLayout
  onOpen?: (id: string) => void
}

function TimelineBar({ entry, layout, onOpen }: TimelineBarProps) {
  const { leftPct, widthPct, hasEnd } = layout
  return (
    <button
      type="button"
      onClick={onOpen ? () => onOpen(entry.id) : undefined}
      title={entry.title}
      aria-label={entry.title}
      className={cn(
        'absolute top-1 h-7 rounded-md px-2 text-left text-xs font-medium',
        'truncate border border-primary/40 bg-primary/10 text-primary',
        'transition-colors hover:bg-primary/20',
        !onOpen && 'cursor-default',
        !hasEnd && 'rounded-full',
      )}
      style={{
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        minWidth: '2px',
      }}
    >
      {widthPct > 6 ? entry.title : ''}
    </button>
  )
}

// ─── TimelineView ─────────────────────────────────────────────────────────────────

/**
 * TimelineView — 날짜 속성 기반 가로 막대 타임라인 뷰(ViewConfig.type='timeline').
 *
 * 결정 C3 — 도메인 무관 제네릭:
 *   - 어떤 date 타입 컬럼이든 startKey/endKey 로 지정해 타임라인화.
 *   - Montize Phase/청구일 같은 도메인 개념은 이 컴포넌트가 모른다.
 *
 * 순수성:
 *   - wall-clock(zero-arg new Date()/Date.now()) 호출 없음 — 축 범위는 레코드 날짜값
 *     (startMs/endMs)의 min/max 에서 파생. new Date(ts) 는 데이터 파생값이라 정당.
 *   - viewRows 로 필터·정렬 적용. resolveTitleKey 로 제목 결정.
 *
 * 훅 규칙(B2): 모든 useMemo 는 조기 반환 *이전*에 무조건 호출한다. 안내/빈 상태 분기는
 *   훅 계산 결과(hasValidAxis·axisRange)를 기준으로 훅 호출 *뒤*에 판단한다. 축 미설정↔설정
 *   전이 시에도 훅 개수가 일정해 "Rendered more hooks" 크래시가 없다.
 *
 * 범위 밖: 종속성 화살표, 드래그 리스케줄(후속 단계).
 */
export const TimelineView: FC<ViewSurfaceProps> = ({ records, pack, view, schema, onOpen }) => {
  const c = timelineViewCopy(useCollectionLocale())
  const titleNone = c.titleNone
  const propertySchema = schema ?? pack.propertySchema
  const titleKey = resolveTitleKey(propertySchema, view)
  const zoom: ZoomLevel = view.timeline?.zoom ?? 'month'

  const startKey = view.timeline?.startKey
  const endKey = view.timeline?.endKey

  // ── 훅: 조기 반환보다 먼저 무조건 호출(Rules of Hooks). ──

  // date 속성 목록 — startKey/endKey 유효성 검증에 사용.
  const datePropKeys = useMemo(
    () => new Set(propertySchema.filter((d) => d.type === 'date').map((d) => d.key)),
    [propertySchema],
  )

  // rows: filter + sort 적용(viewRows 코어 소비). startKey 미설정이면 빈 배열(아래 가드가 안내 상태).
  const entries = useMemo<TimelineEntry[]>(() => {
    if (!startKey || !datePropKeys.has(startKey)) return []
    const allRows = records.map((r) => ({
      id: r.id,
      props: pack.readProperties(r.doc) as Record<string, PropertyValue>,
    }))
    const sorted = viewRows(allRows, view)
    return sorted.map((row) => {
      const titleVal = titleKey ? row.props[titleKey] : null
      // 빈 제목 폴백은 형제 뷰(ListView·RecordCard)와 동일하게 괄호 없는 '제목 없음' 으로 통일(#45 리뷰).
      const title = formatTitleText(titleVal ?? null) || titleNone
      const startMs = parseDate(row.props[startKey] ?? null)
      const endMs = endKey && datePropKeys.has(endKey) ? parseDate(row.props[endKey] ?? null) : null
      return { id: row.id, title, startMs, endMs }
    })
  }, [records, pack, view, titleKey, startKey, endKey, datePropKeys, titleNone])

  // 날짜값이 있는 항목만 축 범위 계산에 포함.
  const axisRange = useMemo(
    () =>
      deriveAxisRange(
        entries.filter((e) => e.startMs !== null),
        zoom,
      ),
    [entries, zoom],
  )

  // ── 빈/안내 상태 분기(모든 훅 호출 이후). ──

  // 미설정 / date 컬럼 없음 → 안내 상태.
  const hasValidAxis = !!startKey && datePropKeys.has(startKey)
  if (!hasValidAxis) {
    const noDateCols = datePropKeys.size === 0
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border p-10 text-center">
        <CalendarDays className="size-8 text-fg-muted" aria-hidden />
        <p className="text-sm font-medium text-fg">{noDateCols ? c.noDateCols : c.pickDateProp}</p>
        <p className="text-xs text-fg-muted">
          {noDateCols ? c.noDateColsHint : c.pickDatePropHint}
        </p>
      </div>
    )
  }

  // 데이터가 없거나(필터 제거 포함) 유효한 날짜가 하나도 없는 경우.
  if (!axisRange) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-fg-muted">
        {c.noValidDates}
      </div>
    )
  }

  const ticks = buildTicks(axisRange.startMs, axisRange.endMs, zoom)
  // 점/짧은 막대의 최소 너비(%): 전체 축의 1%.
  const minBarPct = 1

  return (
    <div className="w-full overflow-auto">
      {/* 헤더: 틱 라벨 여백 */}
      <div className="relative mb-1 h-6 w-full" aria-hidden />

      {/* 타임라인 본체 */}
      <div className="relative w-full min-w-[640px]">
        {/* 배경 눈금 */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{ height: `${entries.length * 36}px` }}
        >
          {ticks.map((tick) => (
            <TickLine
              key={tick.getTime()}
              tick={tick}
              axisRange={axisRange}
              zoom={zoom}
              rowCount={entries.length}
            />
          ))}
        </div>

        {/* 레코드 행 */}
        <div className="flex flex-col">
          {entries.map((entry) => {
            const layout = calcBarLayout(entry, axisRange, minBarPct)
            return (
              <div
                key={entry.id}
                className="relative h-9 border-b border-border/50 last:border-b-0"
                role="row"
                aria-label={entry.title}
              >
                {layout && <TimelineBar entry={entry} layout={layout} onOpen={onOpen} />}
                {/* 날짜 없는 항목은 회색 텍스트로 표시 */}
                {!layout && (
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs text-fg-muted">
                    {c.noDateSuffix(entry.title)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
