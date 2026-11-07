// @vitest-environment jsdom
// ViewTabs 덧붙이 자리 증명 — arrangeTabs 가 접은 묶음 탭은 1단에, 활성 묶음의 뷰만 2단에. 묶음 탭은
// 마지막으로 본 뷰로. tabMenuExtras 항목은 메뉴 자리를 제 화면으로 바꾸고, 닫았다 열면 첫 메뉴다.
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('@oobleck/systheme', () => {
  const icon = () => <span />
  return {
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
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
    Input: ({
      onValueChange,
      onEnterKey,
      onEscapeKey: _escape,
      size: _size,
      ...rest
    }: Record<string, unknown>) => (
      <input
        onChange={(e) => (onValueChange as (v: string) => void)?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (onEnterKey as () => void)?.()
        }}
        {...(rest as object)}
      />
    ),
    Check: icon,
    ChevronLeft: icon,
    ChevronRight: icon,
    Copy: icon,
    EyeOff: icon,
    Lock: icon,
    MoreHorizontal: icon,
    Pencil: icon,
    Plus: icon,
    Search: icon,
    Tags: icon,
    Trash2: icon,
    Users: icon,
  }
})

const { ViewTabs } = await import('./ViewTabs')

import type { ArrangeTabs, TabRowItem } from '@oobleck/collection'

const VIEWS = [
  { id: 'default', name: '기본', config: {} },
  { id: 'match', name: '수동 매칭', config: {} },
  { id: 'mine', name: '내 담당', config: {} },
  { id: 'video', name: '영상공유 필요', config: {} },
  { id: 'done', name: '방문완료됨', config: {} },
]
const PINNED = ['match', 'mine', 'video', 'done']
const BUNDLE: Record<string, string> = { video: 'visit', done: 'visit' }

// 시험용 배치 — video·done 을 '방문' 묶음으로 접는다.
const arrange: ArrangeTabs = (tabs, { activeId }) => {
  const items: TabRowItem[] = []
  const members = tabs.filter((v) => BUNDLE[v.id])
  for (const v of tabs) {
    if (!BUNDLE[v.id]) items.push({ kind: 'view', view: v })
    else if (v === members[0])
      items.push({ kind: 'bundle', key: 'visit', label: '방문', views: members })
  }
  const activeBundle = BUNDLE[activeId] ?? null
  return { items, activeBundle, activeBundleViews: activeBundle ? members : [] }
}

function noop() {}

function tabs(activeId: string, extra: Partial<React.ComponentProps<typeof ViewTabs>> = {}) {
  return (
    <ViewTabs
      views={VIEWS}
      pinnedViewIds={PINNED}
      activeId={activeId}
      defaultViewId="default"
      onPin={noop}
      onUnpin={noop}
      onCreate={noop}
      onRename={noop}
      onDelete={noop}
      onShare={noop}
      onDuplicate={noop}
      onSwitch={noop}
      arrangeTabs={arrange}
      {...extra}
    />
  )
}

describe('ViewTabs 묶음 탭', () => {
  it('배치가 없으면 차례로 선다', () => {
    render(tabs('default', { arrangeTabs: undefined }))
    expect(screen.getByRole('button', { name: '영상공유 필요' })).toBeTruthy()
    expect(screen.queryByRole('group')).toBeNull()
  })

  it('묶인 뷰는 1단에 묶음 탭 하나(이름 + 수)로 서고, 활성 묶음이 없으면 2단도 없다', () => {
    render(tabs('default'))
    expect(screen.getByRole('button', { name: /방문\s*2/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: '내 담당' })).toBeTruthy()
    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.queryByText('영상공유 필요')).toBeNull()
  })

  it('활성 뷰의 묶음만 2단에 선다', () => {
    render(tabs('done'))
    const row = screen.getByRole('group', { name: /방문/ })
    expect(within(row).getByText('영상공유 필요')).toBeTruthy()
    expect(within(row).getByText('방문완료됨')).toBeTruthy()
    expect(within(row).queryByText('수동 매칭')).toBeNull()
  })

  it('묶음 탭은 처음이면 첫 뷰로, 다녀오면 마지막으로 본 뷰로 간다', () => {
    const onSwitch = vi.fn()
    const { rerender } = render(tabs('default', { onSwitch }))
    fireEvent.click(screen.getByRole('button', { name: /방문/ }))
    expect(onSwitch).toHaveBeenLastCalledWith('video')

    rerender(tabs('done', { onSwitch }))
    rerender(tabs('mine', { onSwitch }))
    fireEvent.click(screen.getByRole('button', { name: /방문/ }))
    expect(onSwitch).toHaveBeenLastCalledWith('done')
  })
})

describe('ViewTabs 메뉴 덧붙이', () => {
  it('항목을 누르면 메뉴 자리가 그 화면이 되고, 닫았다 열면 첫 메뉴다', () => {
    const picked = vi.fn()
    render(
      tabs('mine', {
        tabMenuExtras: (view) => [
          {
            key: 'tag',
            icon: <span />,
            label: '꼬리표',
            value: '없음',
            panel: ({ close }) => (
              <button
                type="button"
                onClick={() => {
                  picked(view.id)
                  close()
                }}
              >
                꼬리표 고르기
              </button>
            ),
          },
        ],
      }),
    )
    const openMenu = () => fireEvent.click(screen.getByRole('button', { name: /내 담당/ }))

    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: /꼬리표/ }))
    fireEvent.click(screen.getByRole('button', { name: '꼬리표 고르기' }))
    expect(picked).toHaveBeenCalledWith('mine')
    expect(screen.queryByTestId('popover-panel')).toBeNull()

    openMenu()
    expect(screen.getByRole('menuitem', { name: /꼬리표/ })).toBeTruthy()
  })
})
