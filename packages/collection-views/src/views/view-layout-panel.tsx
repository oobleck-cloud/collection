'use client'

// @oobleck/collection — "Layout" 패널(노션식). ⊞ 뷰 옵션 허브의 첫 항목.
//
// 노션 구조(레이아웃 패널) 재현:
//  1) 레이아웃 타입 그리드(아이콘 카드 3열) — 현재 뷰 인스턴스의 type 을 고른다.
//     ★ 핵심 개념: "뷰"는 명명된 인스턴스(탭)이고, 레이아웃(표/보드/갤러리…)은 그 인스턴스의
//     *속성*이다. 그래서 레이아웃 전환을 툴바 pill 이 아니라 이 패널의 그리드에서 한다.
//  2) 표시 옵션 — Group by / Wrap all content / Card size 등(현재 지원하는 것만 실배선,
//     나머지는 노션 구조에 맞춘 '준비 중' 비활성 행).
//
// 사용: buildLayoutSlot(view, schema, onViewChange) → ViewOptionsSlot (ViewToolbar 가 허브 맨 앞에 둠).

import { type ElementType } from 'react'
import { Select, Switch, cn } from '@oobleck/systheme'
import type { PropertyDef, ViewConfig, ViewType } from '@oobleck/collection'
import { useCollectionLocale, viewTypeLabel, type CollectionLocale } from '../i18n'
import { VIEW_SURFACES, PLANNED_VIEW_SURFACES } from './CollectionView'
import { GroupPanel } from './group-panel'
import { layoutPanelCopy } from './view-layout-panel.messages'
import type { ViewOptionsSlot } from './view-options-menu'

/**
 * 아직 렌더러가 없는(준비 중) 레이아웃 — 노션 그리드 구조를 채우기 위한 시각 placeholder.
 * 지도(map)는 활성 surface 로 승격됨(#36) — 대시보드(#37)와 동일하게 VIEW_SURFACES 로 이동.
 * 현재 비어 있으나, 향후 미구현 레이아웃을 다시 여기에 둘 수 있어 구조는 유지한다.
 */
const PLACEHOLDER_LAYOUTS: { key: string; label: string; icon: ElementType }[] = []

/** 레이아웃 타입 카드 — 노션식. 선택 시 파란 테두리. */
function LayoutCard({
  icon: Icon,
  label,
  selected,
  disabled,
  onClick,
}: {
  icon: ElementType
  label: string
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  const c = layoutPanelCopy(useCollectionLocale())
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={disabled ? c.cardAriaDisabled(label) : label}
      title={disabled ? c.cardTitleDisabled(label) : label}
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-3 text-xs transition-colors',
        disabled
          ? 'cursor-not-allowed border-border text-fg-muted opacity-40'
          : selected
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-border text-fg hover:bg-surface',
      )}
    >
      <Icon className="size-5" />
      <span>{label}</span>
    </button>
  )
}

/** 옵션 행 — 라벨 + 우측 컨트롤(toggle/select/›). 노션 옵션 목록 구조. */
function OptionRow({ label, control }: { label: string; control: React.ReactNode }) {
  return (
    <div className="flex min-h-8 w-full items-center justify-between gap-2 px-1 text-sm text-fg">
      <span className="truncate">{label}</span>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

function DisabledHint() {
  const c = layoutPanelCopy(useCollectionLocale())
  return <span className="text-xs text-fg-muted">{c.preparing}</span>
}

export type LayoutPanelProps = {
  view: ViewConfig
  schema: PropertyDef[]
  onViewChange: (next: Partial<ViewConfig>) => void
}

/**
 * Layout 패널 — 레이아웃 그리드 + 표시 옵션.
 */
export function LayoutPanel({ view, schema, onViewChange }: LayoutPanelProps) {
  const locale = useCollectionLocale()
  const c = layoutPanelCopy(locale)
  const currentType: ViewType = view.type ?? 'table'
  const activeDefs = Object.values(VIEW_SURFACES).filter(Boolean)
  const plannedDefs = Object.values(PLANNED_VIEW_SURFACES).filter(Boolean)
  const activeDef = VIEW_SURFACES[currentType]
  const supports = activeDef?.supports ?? {}

  const coverCandidates = schema.filter((d) => d.type === 'url')
  const isTable = currentType === 'table'

  return (
    <div className="flex w-full flex-col gap-3">
      {/* 1) 레이아웃 타입 그리드 */}
      <div className="grid grid-cols-3 gap-2">
        {activeDefs.map((def) => (
          <LayoutCard
            key={def.kind}
            icon={def.icon}
            label={viewTypeLabel(def.kind, locale)}
            selected={currentType === def.kind}
            onClick={() => onViewChange({ type: def.kind })}
          />
        ))}
        {plannedDefs.map((def) => (
          <LayoutCard
            key={def.kind}
            icon={def.icon}
            label={viewTypeLabel(def.kind, locale)}
            disabled
          />
        ))}
        {PLACEHOLDER_LAYOUTS.map((p) => (
          <LayoutCard key={p.key} icon={p.icon} label={p.label} disabled />
        ))}
      </div>

      <div className="border-t border-border" />

      {/* 2) 표시 옵션 — 지원하는 것만 실배선, 나머지는 노션 구조에 맞춘 준비 중 행 */}
      <div className="flex flex-col">
        <OptionRow label={c.dataSourceTitle} control={<DisabledHint />} />
        <OptionRow label={c.pageIcon} control={<DisabledHint />} />
        {/* 줄바꿈·행높이는 TableView 만 소비 → table 전용(무동작 컨트롤 방지). */}
        {isTable && (
          <OptionRow
            label={c.wrapAllContent}
            control={
              <Switch
                checked={view.wrapCells ?? false}
                onCheckedChange={(wrapCells) => onViewChange({ wrapCells })}
              />
            }
          />
        )}
        {isTable && (
          <OptionRow
            label={c.rowHeight}
            control={
              <Select
                size="sm"
                options={[
                  { value: 'S', label: c.sizeS },
                  { value: 'M', label: c.sizeM },
                  { value: 'L', label: c.sizeL },
                ]}
                value={view.rowHeight ?? 'S'}
                onChange={(v) => onViewChange({ rowHeight: v as 'S' | 'M' | 'L' })}
              />
            }
          />
        )}
        {supports.group && (
          <div className="flex flex-col gap-1 py-1">
            <span className="px-1 text-sm text-fg">{c.groupBy}</span>
            {/* 노션: 그룹 설정은 레이아웃 패널 안에서. 단순 Select 대신 GroupPanel 재사용
                → 그룹 없음/후보 라디오 + 빈 그룹 숨김 + 그룹 정렬까지(board/gallery 코어가 소비). */}
            <GroupPanel schema={schema} view={view} onViewChange={onViewChange} />
          </div>
        )}
        {supports.cover && (
          <OptionRow
            label={c.cardCover}
            control={
              <Select
                size="sm"
                options={[
                  { value: '', label: c.none },
                  ...coverCandidates.map((d) => ({ value: d.key, label: d.label })),
                ]}
                value={view.coverKey ?? ''}
                onChange={(v) => onViewChange({ coverKey: v === '' ? undefined : v })}
              />
            }
          />
        )}
        <OptionRow label={c.pageOpenMode} control={<DisabledHint />} />
        <OptionRow label={c.loadLimit} control={<DisabledHint />} />
        {supports.cardSize && (
          <>
            <div className="my-1 border-t border-border" />
            <OptionRow
              label={c.cardSize}
              control={
                <Select
                  size="sm"
                  options={[
                    { value: 'S', label: c.sizeS },
                    { value: 'M', label: c.sizeM },
                    { value: 'L', label: c.sizeL },
                  ]}
                  value={view.cardSize ?? 'M'}
                  onChange={(v) => onViewChange({ cardSize: v as 'S' | 'M' | 'L' })}
                />
              }
            />
          </>
        )}
      </div>
    </div>
  )
}

/** 레이아웃 슬롯 아이콘 — 격자(레이아웃) 표현 인라인 SVG. */
function LayoutSlotIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 9v12" />
    </svg>
  )
}

/**
 * ViewToolbar 의 ⊞ 허브 맨 앞에 둘 "레이아웃" 슬롯.
 */
export function buildLayoutSlot(
  view: ViewConfig,
  schema: PropertyDef[],
  onViewChange: (next: Partial<ViewConfig>) => void,
  locale: CollectionLocale,
): ViewOptionsSlot {
  return {
    id: 'layout',
    label: layoutPanelCopy(locale).layout,
    icon: LayoutSlotIcon,
    panel: <LayoutPanel view={view} schema={schema} onViewChange={onViewChange} />,
  }
}
