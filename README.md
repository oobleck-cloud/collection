# collection

oobleck 공용 컬렉션. 뼈대만 있다. 구현은 아직 MVOS `packages/collections` 에 있다.

| 패키지 | 하는 일 |
| --- | --- |
| `@oobleck/collection` | 헤드리스. 쿼리·스키마·저장된 뷰. React와 디자인 시스템을 모른다. |
| `@oobleck/collection-views` | 뷰. 디자인 시스템 부품은 슬롯으로 받고, Systheme 또는 Workstyle 이 채운다. |

제품은 비공개 git 의존으로 참조한다.

```json
{
  "@oobleck/collection": "github:oobleck-cloud/collection#path:packages/collection",
  "@oobleck/collection-views": "github:oobleck-cloud/collection#path:packages/collection-views"
}
```
