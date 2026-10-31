/**
 * 디자인 시스템에 연결된 컬렉션 뷰.
 * Button·Field 같은 부품은 여기서 고르지 않고, 쓰는 쪽이 슬롯으로 채운다.
 * Systheme 연결은 MVOS, Workstyle 연결은 그 다음 이전에서 온다.
 * 구현은 아직 MVOS `@mvos/collections` 의 views 에 있다.
 */
export const packageId = '@oobleck/collection-views' as const
