// Workstyle 킷: KitProvider 로 걸면 그 아래 부품 자리만 ws- 부품이 되고, 킷에 없는 자리는 systheme 으로 남는다.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CollectionStatusBlock } from '@oobleck/collection-views/views/CollectionStatus'
import {
  Badge,
  Button,
  Hash,
  Input,
  KitProvider,
  Popover,
  Select,
  Switch,
  X,
  useKitNames,
  type Kit,
} from '@oobleck/collection-views/kit'
import { workstyleKit } from './index'

const isWs = (el: Element) => /\bws-/.test(el.className)

describe('Workstyle 킷', () => {
  it('KitProvider 가 없으면 systheme 이 그린다', () => {
    render(<Button variant="primary">저장</Button>)
    const b = screen.getByRole('button', { name: '저장' })
    expect(isWs(b)).toBe(false)
  })

  it('Workstyle 킷을 걸면 단추·입력·스위치가 ws- 부품이 된다', () => {
    const onValue = vi.fn()
    const onEnter = vi.fn()
    render(
      <KitProvider kit={workstyleKit}>
        <Button variant="destructive" size="sm">
          지우기
        </Button>
        <Input aria-label="이름" value="" onValueChange={onValue} onEnterKey={onEnter} />
        <Switch aria-label="켜기" checked={false} onCheckedChange={() => {}} />
      </KitProvider>,
    )
    expect(screen.getByRole('button', { name: '지우기' }).className).toContain(
      'ws-btn ws-danger ws-sm',
    )
    const input = screen.getByRole('textbox', { name: '이름' })
    expect(input.className).toContain('ws-input')
    fireEvent.change(input, { target: { value: '가' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onValue).toHaveBeenCalledWith('가')
    expect(onEnter).toHaveBeenCalled()
    expect(screen.getByRole('switch', { name: '켜기' }).className).toContain('ws-switch')
    // 감싼 곳에 .dark 를 건다(systheme 다크 값 = Workstyle 색)
    expect(document.querySelector('[data-kit="workstyle"]')?.className).toBe('dark ws-scope')
  })

  it('Select·Popover 가 systheme 과 같은 props 로 열리고 고른다', () => {
    const onChange = vi.fn()
    render(
      <KitProvider kit={workstyleKit}>
        <Select
          aria-label="정렬"
          options={[
            { value: 'a', label: '가' },
            { value: 'b', label: '나', hint: '두 번째' },
          ]}
          value="a"
          onChange={onChange}
        />
        <Popover trigger={({ onClick }) => <button onClick={onClick}>필터</button>}>
          <p>필터 판</p>
        </Popover>
      </KitProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '정렬' }))
    fireEvent.click(screen.getByRole('option', { name: /나/ }))
    expect(onChange).toHaveBeenCalledWith('b')
    fireEvent.click(screen.getByRole('button', { name: '필터' }))
    expect(screen.getByRole('dialog').textContent).toBe('필터 판')
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('아이콘: Workstyle 에 있는 모양은 바꾸고 없는 모양은 lucide(systheme) 로 둔다', () => {
    const { container } = render(
      <KitProvider kit={workstyleKit}>
        <X data-testid="x" />
      </KitProvider>,
    )
    expect(container.querySelector('[data-testid="x"] .ws-ic svg')).not.toBeNull()
    // Hash 는 Workstyle 모양이 없어 킷이 비워 두고, 자리는 systheme(lucide) 으로 넘어간다
    // (lucide 는 형제 저장소의 react 를 따로 읽어 이 시험 환경에서는 그리지 않는다)
    expect(workstyleKit.icons?.Hash).toBeUndefined()
    expect(Hash.displayName).toBe('Icon(Hash)')
  })

  it('겹친 킷: 안쪽에 없는 자리는 바깥 킷, 그다음 systheme', () => {
    const marker: Kit = { name: 'marker', components: { Badge: () => <span>표시</span> } }
    function Names() {
      return <i>{useKitNames().join('>')}</i>
    }
    render(
      <KitProvider kit={workstyleKit}>
        <KitProvider kit={marker}>
          <Badge>원래</Badge>
          <Button variant="secondary">바깥</Button>
          <Names />
        </KitProvider>
      </KitProvider>,
    )
    expect(screen.getByText('표시')).toBeTruthy()
    expect(screen.getByRole('button', { name: '바깥' }).className).toContain('ws-btn ws-secondary')
    expect(screen.getByText('workstyle>marker')).toBeTruthy()
  })

  it('실제 뷰 조각(CollectionStatusBlock)이 킷을 따라 그린다', () => {
    const retry = vi.fn()
    render(
      <KitProvider kit={workstyleKit}>
        <CollectionStatusBlock status={{ state: 'error', onRetry: retry }} />
      </KitProvider>,
    )
    const b = screen.getByRole('button')
    expect(b.className).toContain('ws-btn ws-secondary')
    fireEvent.click(b)
    expect(retry).toHaveBeenCalled()
    expect(document.querySelector('.ws-list-empty')).not.toBeNull()
  })
})
