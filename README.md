# collection

oobleck 공용 컬렉션.

| 패키지                                | 하는 일                                                                                                                                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@oobleck/collection`                 | 헤드리스. 쿼리·스키마·저장된 뷰. React와 디자인 시스템을 모른다.                                                                                                                         |
| `@oobleck/collection-views`           | 뷰. 화면 부품은 부품 자리(`./kit`)로 받는다. 기본은 `@oobleck/systheme` 그대로.                                                                                                          |
| `@oobleck/collection-addons`          | 덧붙이. 폼 문항 → 기록 칸 → 속성 정의 변환, 칸 답 한 줄 요약, 구역별 답 줄(`./react` 의 `AnswerSections` 로 그린다), 뷰 탭 업무 그룹(`./view-groups`). 앱 타입을 모르고 구조로만 받는다. |
| `@oobleck/collection-views-workstyle` | Workstyle 킷. 부품 자리를 `@oobleck/workstyle/react` 로 채운다. `@oobleck/workstyle` 이 있어야 해서 따로 둔다.                                                                           |

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

## 덧붙이(addons)

폼(랜딩 · 설문)과 사람이 받아 적는 기록 칸(콜 템플릿 등)을 잇는다. 옮김은 단방향이다: 폼을 고쳐도 칸은 그대로고, 칸 답이 폼 답으로 돌아가지 않는다.

```ts
import { attributeDefsOf, answerSummary, fieldsOfQuestions } from '@oobleck/collection-addons'

const fields = fieldsOfQuestions(questions, {
  labelMax: 60,
  // 앱 고유 문항 종류 — 칸 하나를 주면 그것, null 이면 뺀다.
  custom: (q, base) => (q.kind === 'premium' ? { ...base, type: 'NUMBER' } : undefined),
})
attributeDefsOf(fields) // 속성 칸 편집기에 넣을 정의
answerSummary({ liability: ['yes'] }, fields) // 「배상 책임 가입」
```

`AnswerSections`(`@oobleck/collection-addons/react`)는 systheme 토큰 클래스를 쓰므로 호스트가 이 패키지 `src` 를 Tailwind `@source` 로 훑어야 한다.

### 뷰 탭 업무 그룹(`./view-groups`)

뷰에 그룹 이름(`group`)을 달면 탭 줄 1단에는 그룹 탭(이름 + 꺼내 둔 수)이, 활성 뷰의 그룹이면 2단에 그 그룹의 뷰가 선다.
그룹은 따로 저장되는 실체가 아니라 뷰가 가진 이름이다 — 어디에 남길지는 호스트가 정하고, 뷰를 읽을 때 `group` 에 채운다.

`ViewTabs` 는 그룹을 모른다. 덧붙이는 탭 줄의 두 자리 `arrangeTabs`(묶음 탭으로 접기) · `tabMenuExtras`(활성 탭 메뉴 항목)로만 건다.

```tsx
import { useViewGroupTabs } from '@oobleck/collection-addons/view-groups'

const groups = useViewGroupTabs({ views, defaultViewId, currentUserId, canManageAny, onMoveToGroup })
<ViewTabs {...props} {...groups} />
```

「그룹으로 이동」은 이름을 고칠 수 있는 뷰(`canEditSavedView`)에만 선다.
