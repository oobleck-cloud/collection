'use client'

import { type FC, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, cn } from '@oobleck/systheme'
import type { PropertyValue } from '@oobleck/collection'
import { resolveTitleKey, viewRows } from '@oobleck/collection'
import { dateValueEnd } from '@oobleck/collection'
import { buildMonthGrid, isoToDayKey } from './calendar-grid'
import { layoutWeek, type CalendarEvent } from './calendar-layout'
import { formatTitleText } from '@oobleck/collection'
import { useCollectionLocale } from '../i18n'
import { calendarViewCopy } from './CalendarView.messages'
import type { ViewSurfaceProps } from './ViewSurface'

// @oobleck/collection — 캘린더 뷰 렌더러(#34, ViewConfig.type='calendar').
//
// 결정(타임라인과 동형): 도메인 무관 제네릭 ViewSurface. Phase/청구일 도메인과 결선하지 않음.
// 날짜 프로퍼티(PropertyType='date')의 값을 가진 레코드를 월 그리드에 배치한다. 기간(종료일) 값은
// 시작~종료 일자에 걸친 *가로 막대(span bar)* 로, 단일/시간 값은 시작 일자 한 칸 막대로 렌더한다.
//
// 날짜 키 선택(자율 스키마 확장 금지): 새 영속 설정 필드를 만들지 않고, 스키마의 *첫 date 속성*을
// 자동 선택한다. date 속성이 없으면 안내 상태(타임라인의 미설정 안내와 동형).
//
// 순수성 분리: 그리드 계산은 calendar-grid.ts, 주별 막대 배치는 calendar-layout.ts(둘 다 순수, UTC).
// 이 .tsx 는 표시 월 선택에만 wall-clock(new Date())을 쓴다.
//
// 훅 규칙(B2): 모든 훅은 조기 반환 *이전*에 무조건 호출한다.

// 한 주에 노출할 최대 막대 lane 수. 초과분은 열별 "+k" 로 접는다.
const MAX_LANES = 3

// 한국 달력 관습: 일요일 시작(일·월·화·수·목·금·토). calendar-grid 의 그리드 시작과 일치.
// 요일 라벨은 로캘 문구(calendarViewCopy)에서 해석한다.

/**
 * CalendarView — 날짜 속성 기준 월 그리드 뷰(ViewConfig.type='calendar').
 *
 * 날짜 키 자동 선택: schema(없으면 pack.propertySchema)의 첫 date 속성. 없으면 안내 상태.
 * 월 이동: 로컬 상태(표시 연/월) + 이전/다음 버튼. 초기 월 = 현재 월(new Date()는 여기서만 허용).
 * filter·sort 는 viewRows 로 먼저 적용한 뒤 이벤트(시작~종료)로 환산해 주별 막대로 배치한다.
 */
export const CalendarView: FC<ViewSurfaceProps> = ({ records, pack, view, schema, onOpen }) => {
  const c = calendarViewCopy(useCollectionLocale())
  const titleNone = c.titleNone
  const propertySchema = schema ?? pack.propertySchema
  const titleKey = resolveTitleKey(propertySchema, view)

  // 자동 선택한 날짜 키 — 스키마의 첫 date 속성(없으면 undefined → 아래 안내 상태).
  const dateKey = useMemo(
    () => propertySchema.find((d) => d.type === 'date')?.key,
    [propertySchema],
  )

  // 표시 월(로컬 상태) — 초기값은 현재 월(UTC). new Date()는 이 .tsx 에서만 허용(순수 모듈 아님).
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getUTCFullYear(), month0: now.getUTCMonth() }
  })

  // 레코드 → 캘린더 이벤트(시작~종료 일자 키). filter·sort(viewRows) 순서 = 막대 lane 우선순위.
  const events = useMemo<CalendarEvent[]>(() => {
    if (!dateKey) return []
    const allRows = records.map((r) => ({
      id: r.id,
      props: pack.readProperties(r.doc) as Record<string, PropertyValue>,
    }))
    const sorted = viewRows(allRows, view)
    const out: CalendarEvent[] = []
    for (const row of sorted) {
      const rawDate = row.props[dateKey]
      if (typeof rawDate !== 'string') continue
      const startKey = isoToDayKey(rawDate) // isoToDayKey 는 기간/시간 값의 *시작* 일자를 준다.
      if (!startKey) continue
      const endRaw = dateValueEnd(rawDate)
      let endKey = endRaw ? isoToDayKey(endRaw) : startKey
      if (!endKey || endKey < startKey) endKey = startKey // 방어: 종료<시작이면 단일로.
      const titleVal = titleKey ? row.props[titleKey] : null
      const title = formatTitleText(titleVal ?? null) || titleNone
      out.push({ id: row.id, title, startKey, endKey })
    }
    return out
  }, [records, pack, view, titleKey, dateKey, titleNone])

  // 표시 월의 그리드(순수 계산, UTC) → 주(7칸) 단위로 청크.
  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month0), [cursor])
  const weeks = useMemo(() => {
    const rows: { date: string; inMonth: boolean }[][] = []
    for (let i = 0; i < grid.days.length; i += 7) rows.push(grid.days.slice(i, i + 7))
    return rows
  }, [grid])

  // ── 안내 상태 분기(모든 훅 호출 이후). ──
  if (!dateKey) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border p-10 text-center">
        <CalendarDays className="size-8 text-fg-muted" aria-hidden />
        <p className="text-sm font-medium text-fg">{c.needDateProp}</p>
        <p className="text-xs text-fg-muted">{c.needDatePropHint}</p>
      </div>
    )
  }

  const monthLabel = c.monthLabel(cursor.year, cursor.month0)

  // 이전/다음 달 이동 — month0 오버/언더플로는 연도 보정.
  function shiftMonth(delta: number) {
    setCursor((prev) => {
      const total = prev.year * 12 + prev.month0 + delta
      return { year: Math.floor(total / 12), month0: ((total % 12) + 12) % 12 }
    })
  }

  return (
    <div className="w-full">
      {/* 헤더: 월 라벨 + 이전/다음 네비게이션 */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label={c.prevMonth}
            className="rounded border border-border p-1 text-fg-muted transition-colors hover:bg-surface"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label={c.nextMonth}
            className="rounded border border-border p-1 text-fg-muted transition-colors hover:bg-surface"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* 요일 헤더(일~토) */}
      <div className="grid grid-cols-7 border-b border-border">
        {c.weekdayLabels.map((label) => (
          <div key={label} className="px-1 py-1 text-center text-[11px] font-medium text-fg-muted">
            {label}
          </div>
        ))}
      </div>

      {/* 주별 그리드 — 배경 일자 칸 + 정렬된 막대 오버레이 */}
      {weeks.map((week) => {
        const weekKeys = week.map((d) => d.date)
        const { segments, overflowByCol } = layoutWeek(weekKeys, events, MAX_LANES)
        const laneCount = segments.reduce((m, s) => Math.max(m, s.lane + 1), 0)
        const hasOverflow = overflowByCol.some((n) => n > 0)
        return (
          <div key={weekKeys[0]} className="relative">
            {/* 배경: 일자 칸(열 구분선·일자 번호) */}
            <div className="grid grid-cols-7">
              {week.map((day) => (
                <div
                  key={day.date}
                  className={cn(
                    'min-h-[104px] border-b border-r border-border/60 p-1',
                    !day.inMonth && 'bg-surface/40',
                  )}
                >
                  <span
                    className={cn(
                      'text-[11px] tabular-nums',
                      day.inMonth ? 'text-fg' : 'text-fg-muted',
                    )}
                  >
                    {Number(day.date.slice(8, 10))}
                  </span>
                </div>
              ))}
            </div>

            {/* 오버레이: 일자 번호 아래(top-6)부터 막대 lane 들을 배경과 같은 7열에 정렬해 얹는다. */}
            <div className="pointer-events-none absolute inset-x-0 top-6 flex flex-col gap-0.5">
              {Array.from({ length: laneCount }).map((_, lane) => (
                <div key={lane} className="grid grid-cols-7">
                  {segments
                    .filter((s) => s.lane === lane)
                    .map((seg) => (
                      <button
                        key={seg.id}
                        type="button"
                        onClick={onOpen ? () => onOpen(seg.id) : undefined}
                        title={seg.title}
                        aria-label={seg.title}
                        style={{ gridColumn: `${seg.colStart + 1} / ${seg.colEnd + 2}` }}
                        className={cn(
                          'pointer-events-auto mx-0.5 truncate px-1 py-0.5 text-left text-[11px]',
                          'border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/20',
                          seg.continuesLeft ? 'rounded-l-none border-l-0' : 'rounded-l',
                          seg.continuesRight ? 'rounded-r-none border-r-0' : 'rounded-r',
                          !onOpen && 'cursor-default',
                        )}
                      >
                        {seg.title}
                      </button>
                    ))}
                </div>
              ))}
              {hasOverflow && (
                <div className="grid grid-cols-7">
                  {overflowByCol.map((n, c) => (
                    <span key={c} className="px-1 text-[10px] text-fg-muted">
                      {n > 0 ? `+${n}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
