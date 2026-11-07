import { describe, expect, it } from 'vitest'

import {
  arrangeTabsByGroup,
  canMoveViewToGroup,
  normalizeGroupName,
  viewGroupNames,
  viewGroupOf,
  withViewGroup,
  type GroupedSavedView,
} from './view-group-rules'

const OPTS = { defaultViewId: 'default' }

function view(id: string, group?: string): GroupedSavedView {
  return { id, name: id, config: {}, ...(group === undefined ? {} : { group }) }
}

describe('그룹 이름', () => {
  it('앞뒤 공백을 떼고 빈 이름은 그룹 없음이다', () => {
    expect(normalizeGroupName('  방문·견적 ')).toBe('방문·견적')
    expect(normalizeGroupName('   ')).toBeNull()
    expect(normalizeGroupName(undefined)).toBeNull()
    expect(viewGroupOf(view('a', ''))).toBeNull()
  })

  it('목록의 그룹 이름은 처음 나온 순서로 한 번씩', () => {
    const views = [view('a', '세일즈콜'), view('b'), view('c', '접수'), view('d', '세일즈콜 ')]
    expect(viewGroupNames(views)).toEqual(['세일즈콜', '접수'])
  })

  it('그룹을 달고 뗀다 — 원본은 그대로', () => {
    const base = view('a', '접수')
    expect(withViewGroup(base, ' 세일즈콜 ').group).toBe('세일즈콜')
    expect('group' in withViewGroup(base, null)).toBe(false)
    expect('group' in withViewGroup(base, '  ')).toBe(false)
    expect(base.group).toBe('접수')
  })
})

describe('arrangeTabsByGroup', () => {
  const tabs = [
    view('default', '무시됨'),
    view('match', '접수·매칭'),
    view('mine'),
    view('video', '방문·견적'),
    view('confirm', '접수·매칭'),
    view('done', '방문·견적'),
  ]

  it('그룹 탭은 그 그룹 뷰가 처음 나온 자리에 서고, 기본 뷰는 그룹에 들지 않는다', () => {
    const { items } = arrangeTabsByGroup(tabs, { ...OPTS, activeId: 'default' })
    expect(
      items.map((i) =>
        i.kind === 'view' ? i.view.id : `${i.label}:${i.views.map((v) => v.id).join(',')}`,
      ),
    ).toEqual(['default', '접수·매칭:match,confirm', 'mine', '방문·견적:video,done'])
  })

  it('활성 뷰의 그룹이 2단이 된다', () => {
    const arranged = arrangeTabsByGroup(tabs, { ...OPTS, activeId: 'done' })
    expect(arranged.activeBundle).toBe('방문·견적')
    expect(arranged.activeBundleViews.map((v) => v.id)).toEqual(['video', 'done'])
  })

  it('그룹 없는 뷰가 활성이면 2단이 없다', () => {
    const arranged = arrangeTabsByGroup(tabs, { ...OPTS, activeId: 'mine' })
    expect(arranged.activeBundle).toBeNull()
    expect(arranged.activeBundleViews).toEqual([])
  })
})

describe('canMoveViewToGroup', () => {
  const mine = { ...view('mine'), ownerId: 'u1' }
  const othersShared: GroupedSavedView = { ...view('s'), ownerId: 'u2', visibility: 'shared' }
  const othersPrivate: GroupedSavedView = { ...view('p'), ownerId: 'u2', visibility: 'private' }
  const system: GroupedSavedView = {
    ...view('preset:x'),
    ownerId: 'system',
    visibility: 'shared',
    system: true,
  }
  const user = { ...OPTS, currentUserId: 'u1' }
  const admin = { ...user, canManageAny: true }

  it('일반 사용자는 내 뷰만', () => {
    expect(canMoveViewToGroup(mine, user)).toBe(true)
    expect(canMoveViewToGroup(othersShared, user)).toBe(false)
    expect(canMoveViewToGroup(system, user)).toBe(false)
  })

  it('관리자는 남의 공유 뷰 · 시스템 뷰도, 남의 비공개 뷰와 기본 뷰는 못 옮긴다', () => {
    expect(canMoveViewToGroup(othersShared, admin)).toBe(true)
    expect(canMoveViewToGroup(system, admin)).toBe(true)
    expect(canMoveViewToGroup(othersPrivate, admin)).toBe(false)
    expect(canMoveViewToGroup(view('default'), admin)).toBe(false)
  })
})
