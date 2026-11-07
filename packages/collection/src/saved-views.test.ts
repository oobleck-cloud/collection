import { describe, expect, it } from 'vitest'

import {
  canDeleteSavedView,
  canDuplicateSavedView,
  canEditSavedView,
  canSaveSavedViewConfig,
  canRemoveViewFromTabs,
  isOwnSavedView,
  isSharedSavedView,
  isViewPinned,
  matchesSavedViewQuery,
  pinViewId,
  resolveTabViews,
  sanitizePinnedViewIds,
  savedViewVisibility,
  sectionSavedViews,
  unpinViewId,
} from './saved-views'

import type { SavedView } from './types'

const DEFAULTS = { defaultViewId: 'default' }

function view(id: string, extra: Partial<SavedView> = {}): SavedView {
  return { id, name: id, config: {}, ...extra }
}

const BASE = view('default', { name: '기본' })
const MINE = view('mine', { name: '이번 주', visibility: 'private' })
const MY_SHARED = view('my-shared', {
  name: '팀 공유',
  visibility: 'shared',
  ownerId: 'u1',
  ownerName: '나',
})
const OTHERS = view('others', {
  name: '영업 파이프',
  visibility: 'shared',
  ownerId: 'u2',
  ownerName: '최성현',
})

describe('공개 범위·소유 판정', () => {
  it('visibility 미지정은 private — 옛 payload 가 갑자기 남에게 보이지 않는다', () => {
    expect(savedViewVisibility(view('legacy'))).toBe('private')
    expect(isSharedSavedView(view('legacy'))).toBe(false)
  })

  it('shared 만 공유다', () => {
    expect(savedViewVisibility(MY_SHARED)).toBe('shared')
    expect(isSharedSavedView(OTHERS)).toBe(true)
  })

  it('ownerId 가 없으면 내 것 — 소유자 개념 이전 뷰를 자기가 못 고치면 안 된다', () => {
    expect(isOwnSavedView(view('legacy'), 'u1')).toBe(true)
    expect(isOwnSavedView(view('legacy'), null)).toBe(true)
  })

  it('ownerId 가 있으면 현재 사용자와 같을 때만 내 것', () => {
    expect(isOwnSavedView(MY_SHARED, 'u1')).toBe(true)
    expect(isOwnSavedView(OTHERS, 'u1')).toBe(false)
    expect(isOwnSavedView(OTHERS, null)).toBe(false)
  })
})

describe('검색 필터', () => {
  it('빈 질의·공백만이면 전부 통과', () => {
    expect(matchesSavedViewQuery(MINE, '')).toBe(true)
    expect(matchesSavedViewQuery(MINE, '   ')).toBe(true)
  })

  it('이름 부분일치(대소문자·앞뒤 공백 무시)', () => {
    expect(matchesSavedViewQuery(MINE, ' 이번 ')).toBe(true)
    expect(matchesSavedViewQuery(view('x', { name: 'Pipeline' }), 'pipe')).toBe(true)
    expect(matchesSavedViewQuery(MINE, '지난주')).toBe(false)
  })

  it('만든 사람 이름으로도 찾는다 — 목록에 보이는 글자는 다 검색된다', () => {
    expect(matchesSavedViewQuery(OTHERS, '최성현')).toBe(true)
  })
})

describe('섹션 분류', () => {
  const views = [BASE, MINE, MY_SHARED, OTHERS]

  it('기본 / 비공개 / 공유로 가른다 — 내가 만든 공유 뷰도 공유 섹션에 선다', () => {
    const s = sectionSavedViews(views, DEFAULTS)
    expect(s.defaultView?.id).toBe('default')
    expect(s.privateViews.map((v) => v.id)).toEqual(['mine'])
    expect(s.sharedViews.map((v) => v.id)).toEqual(['my-shared', 'others'])
  })

  it('visibility 미지정 뷰는 비공개 섹션', () => {
    const s = sectionSavedViews([view('legacy')], DEFAULTS)
    expect(s.privateViews.map((v) => v.id)).toEqual(['legacy'])
  })

  it('검색은 모든 섹션에 걸린다(기본 뷰 포함)', () => {
    const s = sectionSavedViews(views, { ...DEFAULTS, query: '파이프' })
    expect(s.defaultView).toBeNull()
    expect(s.privateViews).toEqual([])
    expect(s.sharedViews.map((v) => v.id)).toEqual(['others'])
  })

  it('입력 순서를 보존한다', () => {
    const s = sectionSavedViews([OTHERS, MY_SHARED], DEFAULTS)
    expect(s.sharedViews.map((v) => v.id)).toEqual(['others', 'my-shared'])
  })
})

describe('탭 줄 구성', () => {
  const views = [BASE, MINE, OTHERS]

  it('기본 뷰가 언제나 첫 자리, 그 뒤로 꺼낸 순서', () => {
    expect(resolveTabViews(views, ['others', 'mine'], DEFAULTS).map((v) => v.id)).toEqual([
      'default',
      'others',
      'mine',
    ])
  })

  it('꺼낸 게 없으면 기본 뷰만 선다', () => {
    expect(resolveTabViews(views, [], DEFAULTS).map((v) => v.id)).toEqual(['default'])
  })

  it('없는 뷰(남이 지운 공유 뷰)는 걸러진다 — 이름 없는 빈 탭이 서지 않게', () => {
    expect(resolveTabViews(views, ['ghost', 'mine'], DEFAULTS).map((v) => v.id)).toEqual([
      'default',
      'mine',
    ])
  })

  it('중복 id 와 기본 뷰 중복은 한 번만 선다', () => {
    expect(resolveTabViews(views, ['mine', 'mine', 'default'], DEFAULTS).map((v) => v.id)).toEqual([
      'default',
      'mine',
    ])
  })

  it('기본 뷰가 목록에 없으면(서버 목록만 있는 경우) 꺼낸 것만 선다', () => {
    expect(resolveTabViews([MINE], ['mine'], DEFAULTS).map((v) => v.id)).toEqual(['mine'])
  })
})

describe('꺼내기 / 넣기', () => {
  it('기본 뷰는 목록과 무관하게 항상 꺼내진 상태', () => {
    expect(isViewPinned([], 'default', DEFAULTS)).toBe(true)
    expect(isViewPinned(['mine'], 'mine', DEFAULTS)).toBe(true)
    expect(isViewPinned(['mine'], 'others', DEFAULTS)).toBe(false)
  })

  it('꺼내면 끝에 붙고, 두 번 꺼내도 하나다', () => {
    expect(pinViewId([], 'mine', DEFAULTS)).toEqual(['mine'])
    expect(pinViewId(['mine'], 'others', DEFAULTS)).toEqual(['mine', 'others'])
    expect(pinViewId(['mine'], 'mine', DEFAULTS)).toEqual(['mine'])
  })

  it('기본 뷰는 꺼내기 목록에 들어가지 않는다(첫 자리는 따로 관리)', () => {
    expect(pinViewId([], 'default', DEFAULTS)).toEqual([])
  })

  it('넣으면 목록에서 빠진다 — 뷰 자체는 남는다', () => {
    expect(unpinViewId(['mine', 'others'], 'mine', DEFAULTS)).toEqual(['others'])
  })

  it('기본 뷰는 넣을 수 없다', () => {
    expect(unpinViewId(['mine'], 'default', DEFAULTS)).toEqual(['mine'])
  })

  it('정리 — 유령·중복·기본 뷰를 떨어낸다', () => {
    expect(
      sanitizePinnedViewIds(['default', 'mine', 'ghost', 'mine'], [BASE, MINE], DEFAULTS),
    ).toEqual(['mine'])
  })

  it('원본을 바꾸지 않는다', () => {
    const pinned = ['mine']
    pinViewId(pinned, 'others', DEFAULTS)
    unpinViewId(pinned, 'mine', DEFAULTS)
    expect(pinned).toEqual(['mine'])
  })
})

describe('가드 — 기본 뷰와 남의 공유 뷰', () => {
  const asU1 = { ...DEFAULTS, currentUserId: 'u1' }

  it('기본 뷰는 탭에서 뺄 수 없다', () => {
    expect(canRemoveViewFromTabs('default', DEFAULTS)).toBe(false)
    expect(canRemoveViewFromTabs('mine', DEFAULTS)).toBe(true)
  })

  it('기본 뷰는 이름 변경·삭제 불가 — 화면이 만드는 것이라 저장할 자리가 없다', () => {
    expect(canEditSavedView(BASE, asU1)).toBe(false)
    expect(canDeleteSavedView(BASE, asU1)).toBe(false)
    expect(canDuplicateSavedView(BASE, asU1)).toBe(false)
  })

  it('내 뷰는 이름 변경·삭제 가능, 복제 항목은 없다', () => {
    expect(canEditSavedView(MY_SHARED, asU1)).toBe(true)
    expect(canDeleteSavedView(MY_SHARED, asU1)).toBe(true)
    expect(canDuplicateSavedView(MY_SHARED, asU1)).toBe(false)
  })

  it('남의 공유 뷰는 고치거나 지울 수 없고 복제만 된다', () => {
    expect(canEditSavedView(OTHERS, asU1)).toBe(false)
    expect(canDeleteSavedView(OTHERS, asU1)).toBe(false)
    expect(canDuplicateSavedView(OTHERS, asU1)).toBe(true)
    // 탭에서 치우는 것은 내 화면 일이라 남의 뷰에도 열려 있다.
    expect(canRemoveViewFromTabs(OTHERS.id, DEFAULTS)).toBe(true)
  })

  it('소유자 없는 옛 뷰는 내 것으로 취급한다', () => {
    expect(canEditSavedView(view('legacy'), asU1)).toBe(true)
  })
})

describe('가드 — 관리자(canManageAny)', () => {
  const admin = { ...DEFAULTS, currentUserId: 'u1', canManageAny: true }
  const othersPrivate: SavedView = { ...OTHERS, id: 'others-private', visibility: 'private' }
  const system: SavedView = { ...OTHERS, id: 'preset:mm', system: true }

  it('남의 공유 뷰를 고치고 지운다', () => {
    expect(canEditSavedView(OTHERS, admin)).toBe(true)
    expect(canSaveSavedViewConfig(OTHERS, admin)).toBe(true)
    expect(canDeleteSavedView(OTHERS, admin)).toBe(true)
  })

  it('남의 비공개 뷰는 관리자도 못 고친다', () => {
    expect(canEditSavedView(othersPrivate, admin)).toBe(false)
    expect(canSaveSavedViewConfig(othersPrivate, admin)).toBe(false)
    expect(canDeleteSavedView(othersPrivate, admin)).toBe(false)
  })

  it('시스템 뷰의 이름 · 설정은 관리자만 고치고, 삭제는 누구도 못 한다', () => {
    const member = { ...DEFAULTS, currentUserId: 'u1' }
    expect(canEditSavedView(system, admin)).toBe(true)
    expect(canSaveSavedViewConfig(system, admin)).toBe(true)
    expect(canDeleteSavedView(system, admin)).toBe(false)
    expect(canEditSavedView(system, member)).toBe(false)
    expect(canSaveSavedViewConfig(system, member)).toBe(false)
  })

  it('기본 뷰는 관리자도 못 고친다', () => {
    expect(canSaveSavedViewConfig(BASE, admin)).toBe(false)
  })
})
