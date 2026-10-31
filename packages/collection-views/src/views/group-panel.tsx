'use client'

// @oobleck/collection — 그룹 기준 선택 패널.
//
// gallery/list/board 가 supports.group:true 로 노출되므로 그룹 기준을 바꿀 UI 를 제공한다.
// 이미 구현된 viewGroups(코어) 에 연결만 한다.
//
// 사용: 노션식 구조에 맞춰 LayoutPanel(view-layout-panel.tsx) 안에서 직접 렌더한다
// ("그룹 기준" 설정은 레이아웃 패널 소속). 별도 ⊞ 허브 슬롯으로 노출하지 않는다.

import { Select, Switch, cn } from '@oobleck/systheme'
import { isMultiValueType, isOptionBackedType } from '@oobleck/collection'
import type { PropertyDef, ViewConfig } from '@oobleck/collection'
import { useCollectionLocale } from '../i18n'
import { groupPanelCopy } from './group-panel.messages'

// ─── 후보 필터링 ─────────────────────────────────────────────────────────────

/**
 * 그룹 기준으로 쓸 수 있는 컬럼만 추린다.
 * select / multi_select 와 사람(person / multi_person)만 그룹핑에 의미 있다 — 값이 열거형이어야
 * 그룹을 나눌 수 있기 때문(사람은 계정 명단이 열거다). 다중값은 board 코어의 fan-out 규칙을 따른다.
 */
function resolveGroupCandidates(schema: PropertyDef[]): PropertyDef[] {
  return schema.filter((d) => isOptionBackedType(d.type))
}

// ─── GroupPanel 컴포넌트 ─────────────────────────────────────────────────────

type GroupPanelProps = {
  schema: PropertyDef[]
  view: ViewConfig
  onViewChange: (next: Partial<ViewConfig>) => void
}

/**
 * 그룹 기준 선택 패널.
 * - select / multi_select 컬럼을 후보로 라디오 선택.
 * - "그룹 없음"을 선택하면 groupBy = undefined(그룹 해제).
 * - multi_select 그룹일 때 한 카드가 여러 그룹에 표시됨을 안내.
 */
export function GroupPanel({ schema, view, onViewChange }: GroupPanelProps) {
  const c = groupPanelCopy(useCollectionLocale())
  const candidates = resolveGroupCandidates(schema)
  const currentGroupBy = view.groupBy

  const selectedDef = currentGroupBy ? candidates.find((d) => d.key === currentGroupBy) : undefined

  const handleSelect = (key: string | undefined) => {
    onViewChange({ groupBy: key })
  }

  // 후보 없음 — 빈 상태 안내
  if (candidates.length === 0) {
    return (
      <div className="flex flex-col gap-1 py-1">
        <p className="text-xs text-fg-muted">{c.noCandidatesTitle}</p>
        <p className="text-[11px] text-fg-muted">{c.noCandidatesHint}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {/* "그룹 없음" 선택지 */}
      <button
        type="button"
        role="radio"
        aria-checked={!currentGroupBy}
        onClick={() => handleSelect(undefined)}
        className={cn(
          'flex items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition-colors',
          !currentGroupBy ? 'bg-primary/10 font-medium text-primary' : 'text-fg hover:bg-surface',
        )}
      >
        <span
          className={cn(
            'flex size-3.5 shrink-0 items-center justify-center rounded-full border',
            !currentGroupBy ? 'border-primary bg-primary' : 'border-border',
          )}
        >
          {!currentGroupBy && <span className="size-1.5 rounded-full bg-primary-fg" />}
        </span>
        <span>{c.noGroup}</span>
      </button>

      {/* 후보 컬럼 목록 */}
      {candidates.map((def) => {
        const isSelected = currentGroupBy === def.key
        return (
          <button
            key={def.key}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => handleSelect(def.key)}
            className={cn(
              'flex items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition-colors',
              isSelected ? 'bg-primary/10 font-medium text-primary' : 'text-fg hover:bg-surface',
            )}
          >
            <span
              className={cn(
                'flex size-3.5 shrink-0 items-center justify-center rounded-full border',
                isSelected ? 'border-primary bg-primary' : 'border-border',
              )}
            >
              {isSelected && <span className="size-1.5 rounded-full bg-primary-fg" />}
            </span>
            <span className="min-w-0 flex-1 truncate">{def.label}</span>
            {isMultiValueType(def.type) && (
              <span className="shrink-0 text-[10px] text-fg-muted">{c.multiBadge}</span>
            )}
          </button>
        )
      })}

      {/* multi_select 선택 시 fan-out 안내 */}
      {selectedDef && isMultiValueType(selectedDef.type) && (
        <p className="mt-1 border-t border-border pt-1.5 text-[11px] text-fg-muted">
          {c.fanOutHint}
        </p>
      )}

      {/* 빈 그룹 숨김 토글 + 그룹 정렬 모드 — groupBy 설정된 경우에만 표시. */}
      {currentGroupBy && (
        <div className="mt-1 border-t border-border pt-1.5 flex flex-col gap-1">
          <div className="flex w-full items-center justify-between px-1.5 py-1 text-xs text-fg">
            <span>{c.hideEmptyGroups}</span>
            <Switch
              checked={view.hideEmptyGroups ?? false}
              onCheckedChange={(hideEmptyGroups) => onViewChange({ hideEmptyGroups })}
            />
          </div>
          <div className="flex w-full items-center justify-between gap-2 px-1.5 py-1 text-xs text-fg">
            <span className="shrink-0">{c.groupSort}</span>
            <Select
              size="sm"
              options={[
                { value: 'manual', label: c.sortManual },
                { value: 'name', label: c.sortName },
                { value: 'count', label: c.sortCount },
              ]}
              value={view.groupSort ?? 'manual'}
              onChange={(groupSort) =>
                onViewChange({ groupSort: groupSort as 'manual' | 'name' | 'count' })
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}
