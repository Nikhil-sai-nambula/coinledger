import { Transaction } from '../types/accounting'

/**
 * Explicit transaction kinds, stored in tx.metadata.kind for every new
 * transaction. Older saved games carry no kind, so the classifiers fall back
 * to the legacy notes-substring matching for those transactions only.
 */
export const TX_KIND = {
  BOARD_FEE: 'ROUND_BOARD_FEE',
  BET_WIN: 'BET_WIN',
  BET_LOSS: 'BET_LOSS',
} as const

function kind(t: Transaction): unknown {
  return t.metadata?.kind
}

/** True for automatic per-round board fee (ante) contributions. */
export function isBoardFeeTx(t: Transaction): boolean {
  if (t.category !== 'PLAYER_CONTRIBUTION') return false
  const k = kind(t)
  if (k != null) return k === TX_KIND.BOARD_FEE
  // Legacy fallback for saved games created before explicit kinds existed
  return (t.notes || '').includes('board fee')
}

/** True for a declared bet that the player LOST (paid into the board). */
export function isLostBetTx(t: Transaction): boolean {
  if (t.category !== 'PLAYER_CONTRIBUTION') return false
  const k = kind(t)
  if (k != null) return k === TX_KIND.BET_LOSS
  // Legacy fallback
  return (t.notes || '').toLowerCase().includes('lost bet')
}

/** True for any real declared bet activity (won payout or lost bet). */
export function isBetActivityTx(t: Transaction): boolean {
  return t.category === 'BOARD_PAYOUT' || isLostBetTx(t)
}
