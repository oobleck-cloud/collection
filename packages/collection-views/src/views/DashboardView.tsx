'use client'

import { type FC, type ReactNode, useMemo } from 'react'
import { cn } from '../kit'
import type { PropertyValue } from '@oobleck/collection'
import { viewRows, type Row } from '@oobleck/collection'
import { buildDashboardMetrics } from './dashboard-metrics'
import type { ChartBar } from './chart-bars'
import { useCollectionLocale } from '../i18n'
import { dashboardViewCopy } from './DashboardView.messages'
import type { ViewSurfaceProps } from './ViewSurface'

/**
 * DS Tag 색 → Tailwind 배경 클래스 맵. optionColor 가 반환하는 색 이름과 일치해야 한다.
 * (ChartView 와 동일 — 분포 막대/스와치 색에 재사용.)
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

// @oobleck/collection — 대시보드 뷰 렌더러(ViewConfig.type='dashboard', #37). 스키마 파생 자동 지표 요약.
//
// v1 은 설정 가능한 위젯 캔버스가 아니라 *읽기 전용* 자동 요약이다(영속 스키마·위젯 레이아웃 없음 — S1
// 죽은 컨트롤 금지). 카드는 필터(viewRows) 적용 후의 레코드에서 계산한다:
//   1) Total 카드 = 필터된 총 레코드 수(항상 표시 — 분포가 없어도 동작).
//   2) 분포 카드 = select/multi_select 프로퍼티마다(앞에서 최대 4개) 값 분포 미니 가로 막대.
// 분포 막대는 차트 뷰와 동일한 toBars 모델을 재사용한다(buildDashboardMetrics 안에서) — 막대 수학 재구현 없음.
// 지표 계산은 순수 모듈 dashboard-metrics 로 분리(DOM 무관, 커버리지 게이트) — 여기선 렌더만.

/** 한 분포 카드의 미니 가로 막대 목록(ChartView 막대 렌더의 축약형 — 카드 안에 들어가는 콤팩트 버전). */
function DistributionBars({ bars }: { bars: ChartBar[] }) {
  return (
    <div className="flex flex-col gap-1.5" role="list">
      {bars.map((bar) => {
        // 옵션 색이 있으면 그 색, 없으면 중립색. 스와치·막대 공통.
        // (GROUP_EMPTY 는 색 맵에 없어 bar.color 가 항상 undefined → 자동으로 중립색.)
        const colorClass = bar.color
          ? (TAG_SWATCH_CLASS[bar.color] ?? 'bg-neutral-400')
          : 'bg-neutral-300'
        return (
          <div key={bar.key} role="listitem" className="flex items-center gap-2">
            {/* 좌측: 색 스와치 + 라벨(고정폭 — 막대 정렬을 위해). */}
            <div className="flex w-20 shrink-0 items-center gap-1.5">
              <span
                className={cn('size-2 shrink-0 rounded-full', colorClass)}
                aria-hidden
                data-testid="dashboard-bar-swatch"
              />
              <span className="truncate text-xs text-fg" title={bar.label}>
                {bar.label}
              </span>
            </div>
            {/* 막대 트랙: 너비 = pct%(최대 그룹 대비). 길이 0이어도 트랙은 보인다. */}
            <div className="h-3.5 min-w-0 flex-1 overflow-hidden rounded bg-surface/60">
              <div
                className={cn('h-full rounded transition-all', colorClass)}
                style={{ width: `${bar.pct}%` }}
                aria-hidden
              />
            </div>
            {/* 우측: 절대 count. */}
            <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-fg-muted">
              {bar.count}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** 카드 컨테이너 — 제목 + 본문. 분포 카드/Total 카드 공통 셸. */
function MetricCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface/40 p-4">
      <span className="text-xs font-medium text-fg-muted">{title}</span>
      {children}
    </div>
  )
}

/**
 * DashboardView — 스키마 파생 자동 지표 요약 뷰(ViewConfig.type='dashboard').
 *
 * - 외부 차트 라이브러리 없이 div 너비(Tailwind)로 막대를 그린다(ChartView 동일 방식).
 * - 카드 = Total(총 레코드 수) + select/multi_select 분포(앞에서 최대 4개).
 * - 읽기 전용 — onViewChange/편집 콜백 미소비(supports:{} — 죽은 컨트롤 없음).
 * - 빈 상태: 레코드 0개 → 안내. 레코드는 있으나 분포 대상 프로퍼티가 없으면 Total 카드만.
 */
export const DashboardView: FC<ViewSurfaceProps> = ({
  records,
  pack,
  view,
  schema,
  queryMode = 'client',
  totalCount,
}) => {
  const c = dashboardViewCopy(useCollectionLocale())
  const propertySchema = schema ?? pack.propertySchema
  const isServerMode = queryMode === 'server'

  // 레코드 → 속성 추출 후 코어 viewRows(필터·정렬) 적용. 그 행으로 순수 지표 계산(buildDashboardMetrics).
  //
  // server 모드는 viewRows 를 건너뛴다 — 행은 이미 서버가 걸러 보낸 한 페이지다. 여기서 필터를
  // 한 번 더 걸면 서버가 맞힌 행이 클라 semantics 로 사라진다(TableView 가 이미 같은 분기를 쓴다).
  const metrics = useMemo(() => {
    const all: Row<Record<string, PropertyValue>>[] = records.map((r) => ({
      id: r.id,
      props: pack.readProperties(r.doc) as Record<string, PropertyValue>,
    }))
    const rows = isServerMode ? all : viewRows(all, view)
    return buildDashboardMetrics(rows, propertySchema, view, { preFiltered: isServerMode })
  }, [records, pack, view, propertySchema, isServerMode])

  // Total 은 전체를 답할 수 있다 — 서버가 필터 적용 후의 전체 수(totalCount)를 함께 보내면 그 값이다.
  // 분포는 그럴 수 없다. 한 페이지의 값만 들고 있으므로 **모수를 밝힌다** — 전체인 척하지 않는다.
  const totalIsExact = !isServerMode || totalCount !== undefined
  const displayTotal = totalCount ?? metrics.total
  const distributionsArePageScoped = isServerMode && metrics.distributions.length > 0

  // 레코드 0개 → 안내 상태(훅은 위에서 모두 무조건 호출 — Rules-of-Hooks 안전).
  if (metrics.total === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-fg-muted">
        {c.noRecords}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total 카드 — 항상 첫 칸. 분포가 없어도 대시보드가 빈 화면이 되지 않게. */}
        <MetricCard title={c.totalRecords}>
          <span className="text-3xl font-semibold tabular-nums text-fg">{displayTotal}</span>
          {!totalIsExact && <span className="text-[11px] text-fg-muted">{c.scopePage}</span>}
        </MetricCard>
        {/* 분포 카드 — select/multi_select 프로퍼티마다 값 분포 미니 막대. */}
        {metrics.distributions.map((dist) => (
          <MetricCard key={dist.key} title={dist.label}>
            <DistributionBars bars={dist.bars} />
          </MetricCard>
        ))}
      </div>
      {/*
        모수 고지 — 서버가 페이지를 잘라 보내는 목록에서 분포는 그 페이지만 센 것이다.
        숫자를 지우는 대신 범위를 밝힌다(표 footer 의 "(이 페이지)" 와 같은 규약).
      */}
      {distributionsArePageScoped && (
        <p className="text-[11px] text-fg-muted">{c.distributionPageScope}</p>
      )}
    </div>
  )
}
