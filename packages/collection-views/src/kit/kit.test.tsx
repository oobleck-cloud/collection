// 부품 자리: 기본은 systheme, KitProvider 로 킷을 걸면 그 아래만 바뀌고, 킷에 없는 자리는 바깥 킷 → systheme 으로 넘어간다.
// Workstyle 킷 자체 시험은 @oobleck/collection-views-workstyle.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge, Button, Hash, KitProvider, X, useKitNames, type Kit } from './index'

const outer: Kit = {
  name: 'outer',
  components: {
    Button: ({ children }: { children?: React.ReactNode }) => (
      <button data-kit="outer">{children}</button>
    ),
  },
  icons: { X: () => <i data-testid="outer-x" /> },
}
const inner: Kit = { name: 'inner', components: { Badge: () => <span>표시</span> } }

function Names() {
  return <i>{useKitNames().join('>')}</i>
}

describe('부품 자리', () => {
  it('KitProvider 가 없으면 systheme 이 그린다', () => {
    render(<Button variant="primary">저장</Button>)
    expect(screen.getByRole('button', { name: '저장' }).getAttribute('data-kit')).toBeNull()
  })

  it('겹친 킷: 안쪽 자리 → 바깥 자리 → systheme', () => {
    render(
      <KitProvider kit={outer}>
        <KitProvider kit={inner}>
          <Badge>원래</Badge>
          <Button variant="secondary">바깥</Button>
          <X />
          <Names />
        </KitProvider>
      </KitProvider>,
    )
    expect(screen.getByText('표시')).toBeTruthy()
    expect(screen.getByRole('button', { name: '바깥' }).getAttribute('data-kit')).toBe('outer')
    expect(screen.getByTestId('outer-x')).toBeTruthy()
    expect(screen.getByText('outer>inner')).toBeTruthy()
  })

  it('아이콘 자리는 이름을 가진 감싼 부품이다(킷이 없으면 lucide)', () => {
    expect(Hash.displayName).toBe('Icon(Hash)')
  })
})
