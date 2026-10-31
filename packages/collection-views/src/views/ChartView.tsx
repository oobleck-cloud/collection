'use client'

import { type FC, useMemo } from 'react'
import { cn } from '@oobleck/systheme'
import type { PropertyValue } from '@oobleck/collection'
import { viewGroups, type Row } from '@oobleck/collection'
import { normalizeOptions } from '@oobleck/collection'
import { toBars } from './chart-bars'
import { useCollectionLocale } from '../i18n'
import { chartViewCopy } from './ChartView.messages'
import type { ViewSurfaceProps } from './ViewSurface'

/**
 * DS Tag 색 → Tailwind 배경 클래스 맵. optionColor 가 반환하는 색 이름과 일치해야 한다.
 * (ListView 와 동일 — 막대/스와치 색에 재사용.)
 */
const TAG_SWATCH_CLASS: Record<string, string> = {
  gray: 'bg-neutral-400',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  orange: 'bg-orange-400',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
  teal: 'bg-teal-500',
}

// @oobleck/collection — 차트 뷰 렌더러(ViewConfig.type='chart'). 그룹 기준 분포 가로 막대.
//
// 카테고리 축 = view.groupBy(영속 필드 재사용 — 신규 스키마 없음). 한 그룹 = 가로 막대 한 개,
// 막대 길이 = 그 그룹의 레코드 수(최대 그룹 = 100%로 정규화). select/multi_select 면 옵션 색 스와치 표시.
// 그룹 버킷팅은 코어 viewGroups 가 담당(필터·multi_select fan-out·그룹 정렬 재사용) — 자체 재구현 없음.
// groupBy 미설정이면 빈 차트 대신 안내 상태를 보인다.

/**
 * ChartView — 그룹 기준 집계 가로 막대 차트.
 *
 * - 외부 차트 라이브러리 없이 div 너비(Tailwind)로 막대를 그린다.
 * - groupBy 미설정 → 안내 상태(빈 차트 렌더 안 함).
 * - 색: select/multi_select 옵션 색을 스와치 + 막대에 반영(없으면 중립색).
 */
export const ChartView: FC<ViewSurfaceProps> = ({
  records,
  pack,
  view,
  schema,
  queryMode = 'client',
  totalCount,
}) => {
  const c = chartViewCopy(useCollectionLocale())
  const propertySchema = schema ?? pack.propertySchema
  const isServerMode = queryMode === 'server'
  const groupByDef = view.groupBy ? propertySchema.find((d) => d.key === view.groupBy) : undefined
  const isMulti = groupByDef?.type === 'multi_select'

  // 그룹 키 → 라벨/색 맵(ListView 동일 규칙) — select/multi_select 옵션에서 해석.
  const { groupLabelMap, groupColorMap } = useMemo(() => {
    const labelMap = new Map<string, string>()
    const colorMap = new Map<string, string>()
    if (!view.groupBy || !groupByDef) return { groupLabelMap: labelMap, groupColorMap: colorMap }
    if (groupByDef.type === 'select' || groupByDef.type === 'multi_select') {
      const opts = normalizeOptions(groupByDef.options)
      for (const opt of opts) {
        labelMap.set(opt.value, opt.label ?? opt.value)
        if (opt.color) colorMap.set(opt.value, opt.color)
      }
    }
    return { groupLabelMap: labelMap, groupColorMap: colorMap }
  }, [view.groupBy, groupByDef])

  // 레코드 → 속성 추출 후 코어 viewGroups 로 버킷팅(필터·multi_select fan-out·그룹 정렬 재사용).
  // 그 결과(키+행수)를 순수 toBars 로 막대 모델(라벨·count·pct·색)로 변환한다.
  const bars = useMemo(() => {
    const all: Row<Record<string, PropertyValue>>[] = records.map((r) => ({
      id: r.id,
      props: pack.readProperties(r.doc) as Record<string, PropertyValue>,
    }))
    // server 모드는 필터를 다시 걸지 않는다 — 행은 이미 서버가 걸러 보낸 한 페이지다.
    const groups = viewGroups(all, view, {
      multiGroup: isMulti,
      groupLabelMap,
      preFiltered: isServerMode,
    })
    return toBars(
      groups.map((g) => ({ key: g.key, count: g.rows.length })),
      groupLabelMap,
      groupColorMap,
    )
  }, [records, pack, view, isMulti, groupLabelMap, groupColorMap, isServerMode])

  // 막대는 눈앞의 한 페이지를 센 것이다. 전체 수(totalCount)를 아는 경우에도 **분포**는 모르므로
  // 모수를 밝힌다 — 20건짜리 분포가 900건 분포인 척하는 것이 이 뷰의 가장 조용한 오답이었다.
  const isPageScoped = isServerMode && (totalCount === undefined || totalCount > records.length)

  // groupBy 미설정 → 안내 상태(훅은 위에서 모두 무조건 호출 — Rules-of-Hooks 안전).
  if (!view.groupBy) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-fg-muted">
        {c.pickGroup}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 py-1">
      {isPageScoped && <p className="text-[11px] text-fg-muted">{c.pageScope}</p>}
      <div className="flex flex-col gap-2" role="list">
        {bars.map((bar) => {
          // 옵션 색이 있으면 그 색, 없으면 중립색. 스와치·막대 공통.
          // (GROUP_EMPTY 는 색 맵에 없어 bar.color 가 항상 undefined → 자동으로 중립색.)
          const colorClass = bar.color
            ? (TAG_SWATCH_CLASS[bar.color] ?? 'bg-neutral-400')
            : 'bg-neutral-300'
          return (
            <div key={bar.key} role="listitem" className="flex items-center gap-2">
              {/* 좌측: 색 스와치 + 라벨(고정폭 — 막대 정렬을 위해). */}
              <div className="flex w-32 shrink-0 items-center gap-1.5">
                <span
                  className={cn('size-2 shrink-0 rounded-full', colorClass)}
                  aria-hidden
                  data-testid="chart-bar-swatch"
                />
                <span className="truncate text-xs font-medium text-fg" title={bar.label}>
                  {bar.label}
                </span>
              </div>
              {/* 막대 트랙: 너비 = pct%(최대 그룹 대비). 길이 0이어도 트랙은 보인다. */}
              <div className="h-5 min-w-0 flex-1 overflow-hidden rounded bg-surface/60">
                <div
                  className={cn('h-full rounded transition-all', colorClass)}
                  style={{ width: `${bar.pct}%` }}
                  aria-hidden
                />
              </div>
              {/* 우측: 절대 count. */}
              <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-fg-muted">
                {bar.count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
