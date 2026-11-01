# collection

oobleck 공용 컬렉션.

| 패키지                                | 하는 일                                                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@oobleck/collection`                 | 헤드리스. 쿼리·스키마·저장된 뷰. React와 디자인 시스템을 모른다.                                               |
| `@oobleck/collection-views`           | 뷰. 화면 부품은 부품 자리(`./kit`)로 받는다. 기본은 `@oobleck/systheme` 그대로.                                |
| `@oobleck/collection-views-workstyle` | Workstyle 킷. 부품 자리를 `@oobleck/workstyle/react` 로 채운다. `@oobleck/workstyle` 이 있어야 해서 따로 둔다. |

```json
{
  "@oobleck/collection": "github:oobleck-cloud/collection#path:packages/collection",
  "@oobleck/collection-views": "github:oobleck-cloud/collection#path:packages/collection-views"
}
```

## 부품 자리(kit)

뷰는 Button·Input·Select·Popover·Switch·Checkbox·Tooltip·Badge·Avatar·Spinner·EmptyState 와 아이콘 41개를
`@oobleck/systheme` 이 아니라 `src/kit` 에서 가져온다. `KitProvider` 로 감싸면 그 아래 자리만 다른 킷으로 바뀌고,
킷에 없는 자리는 바깥 킷, 그다음 systheme 으로 넘어간다. 킷 부품은 systheme 과 같은 props 를 받는다.

```tsx
import '@oobleck/workstyle/react.css'
import { KitProvider } from '@oobleck/collection-views/kit'
import { workstyleKit } from '@oobleck/collection-views-workstyle'

<KitProvider kit={workstyleKit}>
  <CollectionView … />
</KitProvider>
```

Workstyle 킷은 감싼 곳과 systheme 패널을 붙일 상자(`PortalRootProvider`)에 `.dark` 를 건다. systheme 의 다크 값이
Workstyle 색과 같게 맞춰져 있어, 킷이 채우지 않는 자리(AnchorContextSurface·MultiSelect·TagSelect·표·지도 등)도 같은 색이 된다.
MVOS 는 systheme 만 쓰므로 이 패키지를 작업공간에서 뺀다(`pnpm-workspace.yaml`).
