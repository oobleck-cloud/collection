// @vitest-environment jsdom
// ViewTabs + ViewDrawer 증명 — "뷰는 서랍에, 탭에는 꺼내 둔 것만" 이라는 구조와,
// 소유 여부로 메뉴가 갈리는 규칙을 고정한다. 특히 **탭에서 제거 ≠ 뷰 삭제**(다른 콜백)가
// 회귀하면 남의 화면에서 뷰가 사라지는 사고가 나므로 둘을 따로 단언한다.
// @oobleck/systheme 은 경량 mock — Popover 는 controlled(open) 로 동작해 열기/닫기를 실제로 검증한다.
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('@oobleck/systheme', () => {
  const icon = () => <span />
  return {
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    // 실제 Popover 와 같은 controlled 계약: 트리거 클릭 → onOpenChange(!open), open 일 때만 children.
    Popover: ({
      trigger,
      children,
      open,
      onOpenChange,
    }: {
      trigger: (p: { onClick: () => void; 'aria-expanded': boolean }) => React.ReactNode
      children: React.ReactNode
      open?: boolean
      onOpenChange?: (next: boolean) => void
    }) => (
      <div>
        {trigger({ onClick: () => onOpenChange?.(!open), 'aria-expanded': Boolean(open) })}
        {open ? <div data-testid="popover-panel">{children}</div> : null}
      </div>
    ),
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Button: ({ children, ...rest }: Record<string, unknown>) => (
      <button {...(rest as object)}>{children as React.ReactNode}</button>
    ),
    // onEnterKey/onEscapeKey/size 는 DS 전용 prop 이라 DOM 으로 흘리지 않는다(React 경고).
    Input: ({
      onValueChange,
      onEnterKey: _enter,
      onEscapeKey: _escape,
      size: _size,
      ...rest
    }: Record<string, unknown>) => (
      <input
        onChange={(e) => (onValueChange as (v: string) => void)?.(e.target.value)}
        {...(rest as object)}
      />
    ),
    Check: icon,
    Copy: icon,
    EyeOff: icon,
    Lock: icon,
    MoreHorizontal: icon,
    Pencil: icon,
    Plus: icon,
    Search: icon,
    Trash2: icon,
    Users: icon,
  }
})

const { ViewTabs } = await import('./ViewTabs')

const BASE = { id: 'default', name: '기본', config: {} }
const MINE = { id: 'mine', name: '이번 주', config: {} }
const DRAWER_ONLY = { id: 'later', name: '지난 달', config: {} }
const OTHERS = {
  id: 'others',
  name: '영업 파이프',
  config: {},
  visibility: 'shared' as const,
  ownerId: 'u2',
  ownerName: '최성현',
}

const VIEWS = [BASE, MINE, DRAWER_ONLY, OTHERS]

function noop() {}

function setup(overrides: Partial<React.ComponentProps<typeof ViewTabs>> = {}) {
  const handlers = {
    onSwitch: vi.fn(),
    onPin: vi.fn(),
    onUnpin: vi.fn(),
    onCreate: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onShare: vi.fn(),
    onDuplicate: vi.fn(),
  }
  render(
    <ViewTabs
      views={VIEWS}
      pinnedViewIds={['mine']}
      activeId="default"
      defaultViewId="default"
      currentUserId="u1"
      inline
      {...handlers}
      {...overrides}
    />,
  )
  return handlers
}

/** 서랍을 연다 — 이후 단언은 패널 안으로 좁혀야 한다(탭 줄에도 같은 이름이 있다). */
function openDrawer() {
  fireEvent.click(screen.getByLabelText('뷰 서랍'))
  return within(screen.getByTestId('popover-panel'))
}

/** 활성 탭의 메뉴를 연다(활성 탭 클릭 = 메뉴). */
function openTabMenu(name: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }))
  return within(screen.getByTestId('popover-panel'))
}

describe('ViewTabs — 탭 줄', () => {
  it('기본 뷰와 꺼내 둔 뷰만 탭으로 선다 — 서랍에만 있는 뷰는 탭에 없다', () => {
    setup()
    expect(screen.getByText('기본')).toBeTruthy()
    expect(screen.getByText('이번 주')).toBeTruthy()
    expect(screen.queryByText('지난 달')).toBeNull()
    expect(screen.queryByText('영업 파이프')).toBeNull()
  })

  it('꺼낸 게 없으면 기본 뷰만 선다 — 업데이트 직후 탭이 비지 않는지의 반대편 증명', () => {
    setup({ pinnedViewIds: [] })
    expect(screen.getByText('기본')).toBeTruthy()
    expect(screen.queryByText('이번 주')).toBeNull()
  })

  it('없는 뷰가 꺼내기 목록에 남아 있어도(남이 지운 공유 뷰) 빈 탭이 서지 않는다', () => {
    setup({ pinnedViewIds: ['ghost', 'mine'] })
    expect(screen.getAllByRole('button').some((b) => b.textContent === '')).toBe(false)
  })

  it('비활성 탭을 누르면 전환이 나간다', () => {
    const h = setup()
    fireEvent.click(screen.getByText('이번 주'))
    expect(h.onSwitch).toHaveBeenCalledWith('mine')
  })
})

describe('ViewDrawer — 검색과 섹션', () => {
  it('서랍을 열면 섹션별로 전체 뷰가 보인다', () => {
    setup()
    const drawer = openDrawer()
    // '기본'은 섹션 머리와 그 아래 뷰 이름 두 번 나온다.
    expect(drawer.getAllByText('기본')).toHaveLength(2)
    expect(drawer.getByText('내 뷰')).toBeTruthy()
    expect(drawer.getByText('공유 뷰')).toBeTruthy()
    expect(drawer.getByText('지난 달')).toBeTruthy()
    // 공유 뷰에는 만든 사람 이름이 함께 보인다.
    expect(drawer.getByText('최성현')).toBeTruthy()
  })

  it('검색하면 걸러진다', () => {
    setup()
    let drawer = openDrawer()
    fireEvent.change(drawer.getByLabelText('뷰 검색'), { target: { value: '지난' } })
    drawer = within(screen.getByTestId('popover-panel'))
    expect(drawer.getByText('지난 달')).toBeTruthy()
    expect(drawer.queryByText('영업 파이프')).toBeNull()
    expect(drawer.queryByText('내 뷰')).toBeTruthy()
    expect(drawer.queryByText('공유 뷰')).toBeNull()
  })

  it('찾는 게 없으면 빈 안내를 보여준다', () => {
    setup()
    let drawer = openDrawer()
    fireEvent.change(drawer.getByLabelText('뷰 검색'), { target: { value: 'zzz' } })
    drawer = within(screen.getByTestId('popover-panel'))
    expect(drawer.getByText('찾는 뷰가 없습니다')).toBeTruthy()
  })

  it('기본 뷰는 꺼내기 토글 대신 "항상 표시" 배지다 — 넣을 수 없다', () => {
    setup()
    const drawer = openDrawer()
    expect(drawer.getByText('항상 표시')).toBeTruthy()
  })
})

describe('ViewDrawer — 꺼내기 / 넣기', () => {
  it('안 꺼낸 뷰의 "추가"를 누르면 꺼내기가 나간다(서랍은 열린 채)', () => {
    const h = setup()
    const drawer = openDrawer()
    fireEvent.click(drawer.getAllByText('추가')[0])
    expect(h.onPin).toHaveBeenCalledWith('later')
    expect(h.onUnpin).not.toHaveBeenCalled()
    expect(screen.getByTestId('popover-panel')).toBeTruthy()
  })

  it('이미 꺼낸 뷰의 "꺼냄"을 누르면 넣기가 나간다', () => {
    const h = setup()
    const drawer = openDrawer()
    fireEvent.click(drawer.getByText('꺼냄'))
    expect(h.onUnpin).toHaveBeenCalledWith('mine')
  })

  it('행을 누르면 꺼내면서 그 뷰로 전환하고 서랍이 닫힌다', () => {
    const h = setup()
    const drawer = openDrawer()
    fireEvent.click(drawer.getByText('지난 달'))
    expect(h.onPin).toHaveBeenCalledWith('later')
    expect(h.onSwitch).toHaveBeenCalledWith('later')
    expect(screen.queryByTestId('popover-panel')).toBeNull()
  })

  it('현재 조건으로 새 뷰를 저장한다', () => {
    const h = setup()
    const drawer = openDrawer()
    fireEvent.click(drawer.getByText('현재 조건으로 새 뷰 저장'))
    const panel = within(screen.getByTestId('popover-panel'))
    fireEvent.change(panel.getByPlaceholderText('예: 이번 주 방문'), {
      target: { value: '이번 주 방문' },
    })
    fireEvent.click(panel.getByText('저장'))
    expect(h.onCreate).toHaveBeenCalledWith('이번 주 방문')
  })
})

describe('ViewTabs — 탭 메뉴', () => {
  it('내 뷰: 이름 변경 · 공유 전환 · 탭에서 제거 · 뷰 삭제', () => {
    setup({ activeId: 'mine' })
    const menu = openTabMenu('이번 주')
    expect(menu.getByText('이름 변경')).toBeTruthy()
    expect(menu.getByText('전체 공유로 전환')).toBeTruthy()
    expect(menu.getByText('탭에서 제거')).toBeTruthy()
    expect(menu.getByText('뷰 삭제')).toBeTruthy()
    expect(menu.queryByText('복제해서 내 뷰로')).toBeNull()
  })

  it('"탭에서 제거"와 "뷰 삭제"는 서로 다른 콜백이고, 각자 결과를 한 줄로 적어 둔다', () => {
    const h = setup({ activeId: 'mine' })
    const menu = openTabMenu('이번 주')
    expect(menu.getByText(/서랍에 남아 다시 꺼낼 수 있어요/)).toBeTruthy()
    expect(menu.getByText(/되돌릴 수 없어요/)).toBeTruthy()

    fireEvent.click(menu.getByText('탭에서 제거'))
    expect(h.onUnpin).toHaveBeenCalledWith('mine')
    expect(h.onDelete).not.toHaveBeenCalled()
  })

  it('뷰 삭제는 삭제 콜백만 부른다', () => {
    const h = setup({ activeId: 'mine' })
    const menu = openTabMenu('이번 주')
    fireEvent.click(menu.getByText('뷰 삭제'))
    expect(h.onDelete).toHaveBeenCalledWith('mine')
    expect(h.onUnpin).not.toHaveBeenCalled()
  })

  it('남의 공유 뷰: 복제만 되고 이름 변경·삭제는 없다', () => {
    setup({ activeId: 'others', pinnedViewIds: ['others'] })
    const menu = openTabMenu('영업 파이프')
    expect(menu.getByText('복제해서 내 뷰로')).toBeTruthy()
    expect(menu.queryByText('이름 변경')).toBeNull()
    expect(menu.queryByText(/뷰 삭제/)).toBeNull()
    // 내 화면에서 치우는 것은 남의 뷰에도 열려 있다.
    expect(menu.getByText('탭에서 제거')).toBeTruthy()
  })

  it('내 공유 뷰의 삭제는 "모두에게서"라고 적는다 — 남의 화면에서도 사라지기 때문', () => {
    const shared = { ...MINE, visibility: 'shared' as const, ownerId: 'u1', ownerName: '나' }
    setup({ views: [BASE, shared], activeId: 'mine' })
    const menu = openTabMenu('이번 주')
    expect(menu.getByText('뷰 삭제 · 모두에게서')).toBeTruthy()
    expect(menu.getByText(/모두의 화면에서 사라집니다/)).toBeTruthy()
    // 이미 공유된 뷰에 "공유로 전환"은 없다.
    expect(menu.queryByText('전체 공유로 전환')).toBeNull()
  })

  it('기본 뷰 탭에는 메뉴가 없다 — 이름 변경·제거·삭제가 모두 막힌 뷰다', () => {
    setup({ activeId: 'default' })
    fireEvent.click(screen.getByText('기본'))
    expect(screen.queryByText('탭에서 제거')).toBeNull()
    expect(screen.queryByText('뷰 삭제')).toBeNull()
  })

  it('이름 변경은 인라인 입력으로 바뀌고 Enter 로 확정된다', () => {
    const h = setup({ activeId: 'mine' })
    const menu = openTabMenu('이번 주')
    fireEvent.click(menu.getByText('이름 변경'))
    const input = screen.getByDisplayValue('이번 주')
    fireEvent.change(input, { target: { value: '이번 주 방문' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(h.onRename).toHaveBeenCalledWith('mine', '이번 주 방문')
  })

  it('전체 공유로 전환이 나간다', () => {
    const h = setup({ activeId: 'mine' })
    fireEvent.click(openTabMenu('이번 주').getByText('전체 공유로 전환'))
    expect(h.onShare).toHaveBeenCalledWith('mine')
  })

  it('복제해서 내 뷰로가 나간다', () => {
    const h = setup({ activeId: 'others', pinnedViewIds: ['others'] })
    fireEvent.click(openTabMenu('영업 파이프').getByText('복제해서 내 뷰로'))
    expect(h.onDuplicate).toHaveBeenCalledWith('others')
  })
})

describe('ViewTabs — 서랍 트리거', () => {
  it('`+ 뷰` 버튼이 있다', () => {
    setup({ onSwitch: noop })
    expect(screen.getByLabelText('뷰 서랍')).toBeTruthy()
  })
})
