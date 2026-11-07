import type { SavedView, SavedViewVisibility } from './types'

// @mvos/collections — 저장 뷰의 "서랍" 규칙(순수, 도메인 무관).
//
// 뷰 목록과 **탭에 꺼내 둔 목록은 다른 것**이다. 예전에는 뷰를 만들면 곧 탭이 되어 둘이
// 같았지만, 뷰 목록은 여럿이 함께 보는 것(공유)이고 무엇을 꺼내 둘지는 각자의 사정이다.
// 이 파일은 그 둘을 잇는 순수 규칙만 담는다 — 어디에 저장하는지(기기·서버)는 호출부의 몫.
//
// 여기서 정하는 것:
//  1. 공개 범위·소유 판정(미지정의 뜻을 한 군데에서만 정한다)
//  2. 서랍의 검색·섹션 분류
//  3. 탭 줄 구성(기본 뷰는 항상 첫 자리) + 꺼내기/넣기
//  4. 무엇을 고칠·지울 수 있는지의 가드
//
// **기본 뷰는 목록의 일원이 아니다.** 화면이 항상 만들어 첫 자리에 두는 것이라 없앨 수 없고,
// 그래서 꺼내기 목록(pinned)에도 들어가지 않는다. 호출부는 그 id 만 알려주면 된다.

/** 기본 뷰 id 를 아는 함수들의 공통 입력. */
export type DefaultViewRef = {
  /** 항상 첫 자리에 고정되는 뷰의 id — 이 뷰는 탭에서 뺄 수도, 지울 수도 없다. */
  defaultViewId: string
}

/** 공개 범위 — 미지정은 'private'(하위호환: 옛 payload 가 갑자기 공유되지 않게). */
export function savedViewVisibility(view: SavedView): SavedViewVisibility {
  return view.visibility === 'shared' ? 'shared' : 'private'
}

/** 조직 전체가 보는 뷰인가. */
export function isSharedSavedView(view: SavedView): boolean {
  return savedViewVisibility(view) === 'shared'
}

/**
 * 내가 만든 뷰인가 — 수정·삭제 권한의 판정.
 * `ownerId` 가 없으면 소유자 개념 이전의 뷰라 **내 것**이다(SavedView.ownerId 주석 참고).
 * currentUserId 를 모르는 화면(아직 소유자를 모르는 단계)에서도 같은 이유로 내 것으로 본다 —
 * 모른다고 남의 것으로 잠그면 자기 뷰를 자기가 못 고친다.
 */
export function isOwnSavedView(view: SavedView, currentUserId?: string | null): boolean {
  if (!view.ownerId) return true
  if (!currentUserId) return false
  return view.ownerId === currentUserId
}

/**
 * 검색 일치 — 이름과 만든 사람 이름을 본다(둘 다 목록에 보이는 글자다. 안 보이는 것으로
 * 걸러지면 왜 안 나오는지 화면에서 알 수 없다). 대소문자 무시, 앞뒤 공백 무시, 빈 질의는 전부 통과.
 */
export function matchesSavedViewQuery(view: SavedView, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  if (view.name.toLowerCase().includes(needle)) return true
  return (view.ownerName ?? '').toLowerCase().includes(needle)
}

/**
 * 서랍의 섹션 — 기본 / 내 뷰(비공개) / 공유 뷰.
 * 섹션 기준은 **소유가 아니라 공개 범위**다. 내가 만든 공유 뷰도 남들과 같은 자리에 있어야
 * "이건 모두가 보는 것"이 한눈에 읽힌다(고칠 수 있는지는 별개 판정 — isOwnSavedView).
 */
export type SavedViewSections = {
  /** 기본 뷰(검색에 걸리지 않으면 null). */
  defaultView: SavedView | null
  /** 비공개 뷰 — 서버 정책상 남의 비공개 뷰는 애초에 오지 않으므로 실질적으로 "내 뷰". */
  privateViews: SavedView[]
  /** 공유 뷰 — 만든 사람과 무관하게 조직 전체가 보는 것. */
  sharedViews: SavedView[]
}

/** 섹션 분류 + 검색 필터(입력 순서 보존, 원본 미변형). */
export function sectionSavedViews(
  views: readonly SavedView[],
  opts: DefaultViewRef & { query?: string },
): SavedViewSections {
  const query = opts.query ?? ''
  const sections: SavedViewSections = { defaultView: null, privateViews: [], sharedViews: [] }
  for (const view of views) {
    if (!matchesSavedViewQuery(view, query)) continue
    if (view.id === opts.defaultViewId) sections.defaultView = view
    else if (isSharedSavedView(view)) sections.sharedViews.push(view)
    else sections.privateViews.push(view)
  }
  return sections
}

/**
 * 탭 줄에 실제로 서는 뷰 — **기본 뷰가 언제나 첫 자리**, 그 뒤로 꺼내 둔 순서.
 *
 * 목록에 없는 id 는 조용히 걸러낸다. 남이 지운 공유 뷰가 내 꺼내기 목록에 유령으로 남는데,
 * 그걸 탭으로 그리려 하면 이름도 설정도 없는 빈 탭이 선다 — 지운 쪽이 내 기기의 목록을
 * 고쳐 줄 방법은 없으므로 **보는 쪽에서 거른다**. 중복 id 도 한 번만 선다.
 */
export function resolveTabViews(
  views: readonly SavedView[],
  pinnedViewIds: readonly string[],
  opts: DefaultViewRef,
): SavedView[] {
  const byId = new Map(views.map((v) => [v.id, v]))
  const tabs: SavedView[] = []
  const seen = new Set<string>()
  const defaultView = byId.get(opts.defaultViewId)
  if (defaultView) {
    tabs.push(defaultView)
    seen.add(defaultView.id)
  }
  for (const id of pinnedViewIds) {
    if (seen.has(id)) continue
    const view = byId.get(id)
    if (!view) continue
    tabs.push(view)
    seen.add(id)
  }
  return tabs
}

// ── 탭 줄 배치 ──────────────────────────────────────────────────────────────
//
// 탭 줄 1단은 보통 꺼내 둔 뷰를 차례로 세운다. 덧붙이(예: 업무 그룹 — `@oobleck/collection-addons`)는
// 여러 뷰를 **묶음 탭** 하나로 접고, 활성 뷰가 든 묶음의 뷰를 2단에 세울 수 있다. 무엇을 어떻게 묶을지는
// 덧붙이가 정하고, 코어는 그 모양만 정한다.

/** 탭 줄 1단의 한 칸 — 뷰 탭 하나, 또는 여러 뷰를 대신하는 묶음 탭. */
export type TabRowItem =
  | { kind: 'view'; view: SavedView }
  | { kind: 'bundle'; key: string; label: string; views: SavedView[] }

export type TabArrangement = {
  /** 1단 — 꺼내 둔 순서(기본 뷰 첫 자리). */
  items: TabRowItem[]
  /** 활성 뷰가 든 묶음의 key — 없으면 null(2단이 서지 않는다). */
  activeBundle: string | null
  /** 2단 — 활성 묶음의 뷰. 활성 묶음이 없으면 빈 배열. */
  activeBundleViews: SavedView[]
}

/** 탭 줄 배치 규칙 — `resolveTabViews` 결과를 받아 1단 · 2단을 정한다. */
export type ArrangeTabs = (
  tabs: readonly SavedView[],
  opts: DefaultViewRef & { activeId: string },
) => TabArrangement

/** 기본 배치 — 묶지 않고 차례로 세운다. */
export const flatTabArrangement: ArrangeTabs = (tabs) => ({
  items: tabs.map((view) => ({ kind: 'view', view })),
  activeBundle: null,
  activeBundleViews: [],
})

/**
 * 목록 일부만 순서를 바꾼다 — `ordered` 에 든 id 들이 차지하던 자리에 새 순서로 다시 채운다.
 * 2단(한 묶음의 뷰)이나 1단(묶이지 않은 뷰)에서만 끌어도 나머지 탭의 자리는 그대로 남는다.
 * `full` 에 없는 id 는 무시한다.
 */
export function reorderWithin(full: readonly string[], ordered: readonly string[]): string[] {
  const members = new Set(ordered.filter((id) => full.includes(id)))
  const queue = ordered.filter((id) => members.has(id))
  return full.map((id) => (members.has(id) ? (queue.shift() ?? id) : id))
}

/** 지금 탭에 나와 있는가 — 기본 뷰는 목록과 무관하게 항상 나와 있다. */
export function isViewPinned(
  pinnedViewIds: readonly string[],
  viewId: string,
  opts: DefaultViewRef,
): boolean {
  if (viewId === opts.defaultViewId) return true
  return pinnedViewIds.includes(viewId)
}

/** 꺼내기 — 이미 있으면 그대로(순서 유지), 없으면 끝에 붙인다. 기본 뷰는 목록에 넣지 않는다. */
export function pinViewId(
  pinnedViewIds: readonly string[],
  viewId: string,
  opts: DefaultViewRef,
): string[] {
  if (viewId === opts.defaultViewId) return [...pinnedViewIds]
  if (pinnedViewIds.includes(viewId)) return [...pinnedViewIds]
  return [...pinnedViewIds, viewId]
}

/** 넣기(탭에서 제거) — 뷰 자체는 남는다. 기본 뷰는 뺄 수 없다(첫 자리 고정). */
export function unpinViewId(
  pinnedViewIds: readonly string[],
  viewId: string,
  opts: DefaultViewRef,
): string[] {
  if (viewId === opts.defaultViewId) return [...pinnedViewIds]
  return pinnedViewIds.filter((id) => id !== viewId)
}

/**
 * 꺼내기 목록 정리 — 유령(없는 뷰) 제거 · 중복 제거 · 기본 뷰 제외.
 * 저장된 것을 읽을 때 한 번 통과시키면 이후 규칙(resolveTabViews)이 방어를 두 번 하지 않아도 된다.
 */
export function sanitizePinnedViewIds(
  pinnedViewIds: readonly string[],
  views: readonly SavedView[],
  opts: DefaultViewRef,
): string[] {
  const known = new Set(views.map((v) => v.id))
  const seen = new Set<string>()
  return pinnedViewIds.filter((id) => {
    if (id === opts.defaultViewId || !known.has(id) || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

/** 소유·기본 여부를 함께 보는 가드들의 입력. */
export type SavedViewGuardContext = DefaultViewRef & {
  currentUserId?: string | null
  /** 관리자 — 남이 만든 **공유** 뷰도 고친다(이름·설정·공유 전환). 삭제는 여전히 만든 사람만. */
  canManageAny?: boolean
}

/**
 * 탭에서 뺄 수 있는가 — 기본 뷰만 못 뺀다.
 * **남의 공유 뷰도 뺄 수 있다**: 내 화면에서 치우는 것뿐이고 뷰는 서랍에 그대로 남는다.
 */
export function canRemoveViewFromTabs(viewId: string, opts: DefaultViewRef): boolean {
  return viewId !== opts.defaultViewId
}

/**
 * 이름 변경·공유 전환이 가능한가 — 내 뷰, 또는 관리자에게는 남의 공유 뷰. 기본 뷰·시스템 뷰는 아니다.
 * 관리자가 아니면 남의 공유 뷰는 고치지 않는다(복제해서 내 뷰로 만든 뒤 고친다). 기본 뷰는 화면이 만든
 * 것이라 어디에도 저장할 자리가 없고, 시스템 뷰의 이름은 코드가 정한다.
 */
export function canEditSavedView(view: SavedView, opts: SavedViewGuardContext): boolean {
  if (view.id === opts.defaultViewId || view.system) return false
  if (isOwnSavedView(view, opts.currentUserId)) return true
  return opts.canManageAny === true && isSharedSavedView(view)
}

/**
 * 삭제 가능한가 — **만든 사람만**(관리자도 남의 뷰는 못 지운다). 삭제는 뷰 자체를 없애는 것이고,
 * 공유 뷰라면 남의 화면에서도 사라진다("탭에서 제거"와 헷갈리면 사고가 난다).
 */
export function canDeleteSavedView(view: SavedView, opts: SavedViewGuardContext): boolean {
  if (view.id === opts.defaultViewId || view.system) return false
  return isOwnSavedView(view, opts.currentUserId)
}

/** 복제해서 내 뷰로 만들 수 있는가 — 못 고치는 뷰(남의 공유 뷰)에 주어지는 유일한 편집 경로. */
export function canDuplicateSavedView(view: SavedView, opts: SavedViewGuardContext): boolean {
  return view.id !== opts.defaultViewId && !isOwnSavedView(view, opts.currentUserId)
}

/**
 * 설정(컬럼·정렬·필터)을 고쳐 **저장**할 수 있는가 — 이름을 고칠 수 있는 뷰, 그리고 관리자에게는 시스템 뷰.
 * 시스템 뷰는 이름은 못 바꾸지만 설정은 관리자가 모두를 위해 고친다.
 */
export function canSaveSavedViewConfig(view: SavedView, opts: SavedViewGuardContext): boolean {
  if (view.system) return opts.canManageAny === true
  return canEditSavedView(view, opts)
}
