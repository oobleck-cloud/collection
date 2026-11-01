'use client'

// @oobleck/collection — 타임라인 축 설정 패널(WAVE3/레인2).
//
// buildTimelineAxisSlot(view, schema, onViewChange): ViewOptionsSlot 을 export.
// ViewOptionsSlot 빌더 패턴(아이콘 + 라벨 + panel)을 따른다.
//
// 설정:
//   - startKey: 시작 날짜 속성(date 타입 컬럼만 선택 가능, 필수).
//   - endKey: 종료 날짜 속성(optional, 없으면 점/짧은 막대).
//   - zoom: 눈금 단위(일/주/월/분기), 미지정=월.
//
// ProductsTable 배선은 통합 단계(레인 T)에서 별도로.

import { CalendarDays, Select } from '../kit'
import type { PropertyDef, TimelineConfig, ViewConfig } from '@oobleck/collection'
import type { ViewOptionsSlot } from './view-options-menu'
import { DEFAULT_COLLECTION_LOCALE, useCollectionLocale, type CollectionLocale } from '../i18n'
import { timelineAxisPanelCopy } from './timeline-axis-panel.messages'

// ─── 줌 옵션 ─────────────────────────────────────────────────────────────────────

type ZoomOption = { value: NonNullable<TimelineConfig['zoom']>; label: string }

// ─── TimelineAxisPanel ───────────────────────────────────────────────────────────

type TimelineAxisPanelProps = {
  /** 현재 뷰 설정. timeline.startKey · endKey · zoom 을 읽는다. */
  view: ViewConfig
  /** date 타입 속성 목록 — 시작/종료 날짜 선택 드롭다운에 노출. */
  dateProps: PropertyDef[]
  /** 뷰 설정 부분 갱신 콜백(상위가 영속). */
  onViewChange: (next: Partial<ViewConfig>) => void
}

/**
 * 타임라인 축 설정 패널 — 기준 날짜 속성(startKey/endKey)과 zoom 을 설정한다.
 * ViewOptionsMenu 의 슬롯 panel 로 사용(buildTimelineAxisSlot 으로 래핑).
 *
 * 단일 진실원천: timeline 설정은 ViewConfig.timeline 에만 저장(JSON 안전).
 */
export function TimelineAxisPanel({ view, dateProps, onViewChange }: TimelineAxisPanelProps) {
  const c = timelineAxisPanelCopy(useCollectionLocale())
  const currentStartKey = view.timeline?.startKey ?? ''
  const currentEndKey = view.timeline?.endKey ?? ''
  const currentZoom = view.timeline?.zoom ?? 'month'

  const zoomOptions: ZoomOption[] = [
    { value: 'day', label: c.zoomDay },
    { value: 'week', label: c.zoomWeek },
    { value: 'month', label: c.zoomMonth },
    { value: 'quarter', label: c.zoomQuarter },
  ]

  const startOptions = [
    { value: '', label: c.selectPlaceholder },
    ...dateProps.map((d) => ({ value: d.key, label: d.label })),
  ]
  const endOptions = [
    { value: '', label: c.noneOption },
    ...dateProps.map((d) => ({ value: d.key, label: d.label })),
  ]

  function patch(patch: Partial<TimelineConfig>) {
    const prev = view.timeline ?? {}
    onViewChange({ timeline: { ...prev, ...patch } as TimelineConfig })
  }

  // 시작 날짜 변경 — '' (축 해제)이면 timeline 자체를 비운다(쓰레기 영속 방지, N1).
  // startKey 는 TimelineConfig 의 필수 키이므로 미설정 = timeline undefined 가 정규형이다.
  function patchStartKey(value: string) {
    if (value === '') {
      onViewChange({ timeline: undefined })
      return
    }
    patch({ startKey: value })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 시작 날짜 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-fg">{c.startDateLabel}</span>
        <Select
          size="sm"
          options={startOptions}
          value={currentStartKey}
          onChange={patchStartKey}
          placeholder={c.selectPlaceholder}
        />
        {dateProps.length === 0 && <p className="text-[11px] text-fg-muted">{c.noDatePropsHint}</p>}
      </div>

      {/* 종료 날짜 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-fg">{c.endDateLabel}</span>
        <Select
          size="sm"
          options={endOptions}
          value={currentEndKey}
          onChange={(v) => patch({ endKey: v === '' ? undefined : v })}
          placeholder={c.noneOption}
        />
        <p className="text-[11px] text-fg-muted">{c.endDateHint}</p>
      </div>

      {/* 줌 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-fg">{c.zoomLabel}</span>
        <Select
          size="sm"
          options={zoomOptions}
          value={currentZoom}
          onChange={(v) => patch({ zoom: v as NonNullable<TimelineConfig['zoom']> })}
        />
      </div>
    </div>
  )
}

// ─── buildTimelineAxisSlot ────────────────────────────────────────────────────────

/**
 * 타임라인 축 설정 패널을 ViewOptionsSlot 으로 감싸 반환하는 빌더.
 *
 * 통합 단계(레인 T)에서 ViewToolbar 에 배선할 때 이 함수를 호출한다.
 * 이 파일에선 export 만 하고 배선은 레인 T 소유.
 *
 * @example
 * ```ts
 * const slot = buildTimelineAxisSlot(view, schema, onViewChange)
 * // → ViewOptionsMenu 의 slots 배열에 추가
 * ```
 *
 * @param view - 현재 ViewConfig(timeline.startKey · endKey · zoom 읽기).
 * @param schema - PropertyDef 전체(date 타입 필터링에 사용).
 * @param onViewChange - 뷰 설정 부분 갱신(영속 위임).
 * @param locale - 슬롯 라벨 로캘(생략 시 ko). 슬롯 라벨은 렌더 밖 빌더에서 정해지므로 앱이 주입한다.
 * @returns ViewOptionsSlot — ViewOptionsMenu slots 배열에 전달하면 된다.
 */
export function buildTimelineAxisSlot(
  view: ViewConfig,
  schema: PropertyDef[],
  onViewChange: (next: Partial<ViewConfig>) => void,
  locale: CollectionLocale = DEFAULT_COLLECTION_LOCALE,
): ViewOptionsSlot {
  const dateProps = schema.filter((d) => d.type === 'date')
  return {
    id: 'timeline-axis',
    label: timelineAxisPanelCopy(locale).slotLabel,
    icon: CalendarDays,
    panel: <TimelineAxisPanel view={view} dateProps={dateProps} onViewChange={onViewChange} />,
  }
}
