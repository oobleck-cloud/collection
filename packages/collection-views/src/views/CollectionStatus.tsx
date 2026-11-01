'use client'

import type { ReactNode } from 'react'
import { Button, EmptyState, Spinner, TriangleAlert } from '../kit'
import { useCollectionLocale } from '../i18n'
import { collectionViewCopy } from './CollectionView.messages'

// @oobleck/collection — 뷰 본문의 불러오기 상태(로딩·오류).
//
// 뷰에 상태가 없던 동안 화면마다 「Alert + 빈 자리표시 행」을 그렸다 — 표는 0행이라 빈 목록처럼 읽히고,
// 머리말은 「0명」이라고 말했다(틀린 문구). 상태를 뷰가 받아 **본문 자리**에 그린다: 보기 탭 · 필터 칩 ·
// 컬럼 머리는 그대로 두고(무엇을 불러오려 했는지 보이게), 행 자리에 로딩 또는 오류 + 「다시 시도」.

/**
 * 뷰 본문 상태. 미지정 = 준비됨(행을 그린다).
 *  - loading: 아직 한 번도 못 받았을 때. 받은 적이 있으면 호스트는 이전 행을 그대로 두고 ready 로 둔다.
 *  - error: 못 받았을 때. 문구를 주지 않으면 일반 문구, onRetry 를 주면 「다시 시도」 버튼.
 */
export type CollectionViewStatus =
  | { state: 'ready' }
  | { state: 'loading'; label?: string }
  | { state: 'error'; title?: string; message?: string; onRetry?: () => void }

/** 상태가 본문을 대신하는가(ready·미지정이면 false). */
export function isBlockingStatus(
  status: CollectionViewStatus | undefined,
): status is Exclude<CollectionViewStatus, { state: 'ready' }> {
  return status != null && status.state !== 'ready'
}

/** 본문 자리 상태 블록 — 표는 colSpan 행 안에, 다른 뷰는 본문 대신 그린다. */
export function CollectionStatusBlock({
  status,
}: {
  status: Exclude<CollectionViewStatus, { state: 'ready' }>
}): ReactNode {
  const c = collectionViewCopy(useCollectionLocale())
  if (status.state === 'loading') {
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 py-12 text-sm text-fg-muted"
      >
        <Spinner size="sm" />
        {status.label ?? c.loading}
      </div>
    )
  }
  return (
    <div role="alert" className="flex justify-center">
      <EmptyState
        illustration={<TriangleAlert aria-hidden />}
        title={status.title ?? c.errorTitle}
        message={status.message ?? c.errorMessage}
        primaryAction={
          status.onRetry ? (
            <Button type="button" variant="secondary" size="sm" onClick={status.onRetry}>
              {c.retry}
            </Button>
          ) : undefined
        }
      />
    </div>
  )
}
