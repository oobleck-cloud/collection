'use client'

import { type FC, useMemo } from 'react'
import { Plus } from '@oobleck/systheme'
import type { PropertyDef, PropertyValue, ViewConfig } from '@oobleck/collection'
import { resolveTitleKey, resolveVisibleColumns, viewRows, type Row } from '@oobleck/collection'
import { RecordCard } from './record-card'
import { formatTitleText } from '@oobleck/collection'
import { firstDateKey, orderByRecency } from './feed-order'
import { useCollectionLocale } from '../i18n'
import { feedViewCopy } from './FeedView.messages'
import type { ViewSurfaceProps } from './ViewSurface'

// @oobleck/collection — 피드 뷰 렌더러(ViewConfig.type='feed', #33).
//
// 피드 = 단일 열 세로 카드 스트림(최신순). 도메인 무관 — 어떤 블록팩 문서든 시간순으로 흘린다.
// groupBy 미지원(평탄 스트림) — 레지스트리 supports:{} 라 그룹 컨트롤이 노출되지 않는다(죽은 컨트롤 방지).
// 카드는 RecordCard 프리미티브 재사용(갤러리와 동일) — 제목/보조 프로퍼티 규칙도 동일.
//
// 정렬: 코어 viewRows(필터 + view.sort)를 먼저 적용. view.sort 가 비었으면 첫 date 속성 기준
//   최신순으로 폴백(orderByRecency, 순수 모듈). date 속성이 없으면 입력 순서 유지.
//   드래그·인라인 편집 없음 — 카드 클릭 = onOpen.

// ─── 내부 헬퍼 ───────────────────────────────────────────────────────────────────

/**
 * 카드에 표시할 보조 속성 목록 — visibleProps 순서(resolveVisibleColumns)에서 titleKey 만 제외.
 * (피드는 supports:{} — cover/groupBy 어포던스가 없으므로 coverKey/groupBy 제외도 두지 않는다.)
 */
function resolveDisplayProps(
  schema: PropertyDef[],
  view: ViewConfig,
  titleKey: string | undefined,
): PropertyDef[] {
  return resolveVisibleColumns(schema, view).filter((d) => d.key !== titleKey)
}

// ─── FeedView ────────────────────────────────────────────────────────────────────

/**
 * FeedView — 단일 열 세로 카드 스트림 뷰(ViewConfig.type='feed').
 *
 * - 제목 = visibleProps 의 첫 컬럼(resolveTitleKey, board/gallery 와 동일 규칙). schema[0] 직접 사용 금지.
 * - 정렬: viewRows(필터·view.sort) 적용 후, view.sort 가 비면 첫 date 속성 기준 최신순 폴백.
 * - cover/groupBy 없음(supports:{}, 평탄 스트림). 드래그·인라인 편집 없음. 카드 클릭 = onOpen.
 */
export const FeedView: FC<ViewSurfaceProps> = ({
  records,
  pack,
  view,
  schema,
  onOpen,
  onCreate,
  createLabel,
}) => {
  const c = feedViewCopy(useCollectionLocale())
  const propertySchema = schema ?? pack.propertySchema
  const titleKey = resolveTitleKey(propertySchema, view)

  const displayPropDefs = useMemo(
    () => resolveDisplayProps(propertySchema, view, titleKey),
    [propertySchema, view, titleKey],
  )

  const rows = useMemo<Row<Record<string, PropertyValue>>[]>(() => {
    const all: Row<Record<string, PropertyValue>>[] = records.map((r) => ({
      id: r.id,
      props: pack.readProperties(r.doc) as Record<string, PropertyValue>,
    }))
    // 코어 viewRows 가 필터 + view.sort 를 일괄 처리(재구현 금지).
    const ordered = viewRows(all, view)
    // view.sort 가 비어있을 때만 최신순 폴백 — 명시 정렬이 있으면 그대로 존중(이중 정렬 방지).
    if (view.sort.length > 0) return ordered
    return orderByRecency(ordered, firstDateKey(propertySchema))
  }, [records, pack, view, propertySchema])

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-fg-muted">
        {c.noRecords}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => {
        const titleValue = titleKey ? row.props[titleKey] : null
        const titleText = formatTitleText(titleValue ?? null)
        const displayProps = displayPropDefs.map((def) => ({
          def,
          value: row.props[def.key] ?? null,
        }))
        return (
          <RecordCard
            key={row.id}
            cover={null}
            title={titleText}
            displayProps={displayProps}
            size="L"
            onOpen={onOpen ? (e) => onOpen(row.id, e) : undefined}
          />
        )
      })}
      {onCreate && (
        <button
          type="button"
          onClick={() => void onCreate()}
          className="inline-flex items-center gap-1 self-start rounded-md px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-surface hover:text-fg"
        >
          <Plus className="size-3.5" aria-hidden />
          {createLabel ?? c.newItem}
        </button>
      )}
    </div>
  )
}
