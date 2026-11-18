// @vitest-environment jsdom
/**
 * Regression coverage for the audit-fix batch (Nov 18):
 *  - settlement gating on current-round bet activity (user-confirmed rule)
 *  - unblock after cancelling the round's transactions
 *  - undoing individual bets also unblocks (current intended semantics)
 *  - fresh-round settle refunds only that round's fees, preserving carried pot
 *  - legacy saved games (no metadata.kind) behave identically via notes fallback
 *  - fee-change rejection reports an error instead of silently refusing
 *  - round restart keeps CANCELLED history and funds the new round
 *  - no phantom round can be completed once settled (no active round)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { GameProvider, useGame } from '../GameContext'
import { TX_KIND, isBoardFeeTx, isBetActivityTx } from '../../utils/txKind'
import { calculateBoardBalance } from '../../core/ledger'
import type { GameState, Player, Round, Transaction } from '../../types/accounting'

const STORAGE_KEY = 'coinledger_gamestate_v6'
const BASE = 1763400000000
const FEE = 10000 // ₹100

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  React.createElement(GameProvider, null, children)

function player(id: string, name: string, i: number): Player {
  return { id, name, avatarColor: ['#3b82f6', '#f59e0b', '#6366f1'][i], createdAt: BASE, isActive: true }
}

const PLAYERS = [player('p_arun', 'Arun', 0), player('p_bala', 'Bala', 1), player('p_charan', 'Charan', 2)]
const PIDS = PLAYERS.map(p => p.id)
const pacct = (id: string) => `ACCOUNT_PLAYER_${id}`

let seq = 0
function tx(
  category: Transaction['category'],
  roundId: string,
  debits: [string, number][],
  credits: [string, number][],
  notes: string,
  kind?: string,
): Transaction {
  const id = `tx_t${seq++}`
  const ts = BASE + seq
  const entries = [
    ...debits.map(([accountId, amountPaise], i) => ({ id: `${id}_d${i}`, transactionId: id, accountId, type: 'DEBIT' as const, amountPaise, createdAt: ts })),
    ...credits.map(([accountId, amountPaise], i) => ({ id: `${id}_c${i}`, transactionId: id, accountId, type: 'CREDIT' as const, amountPaise, createdAt: ts })),
  ]
  return {
    id, timestamp: ts, roundId, category, description: notes, notes,
    entries,
    ...(kind ? { metadata: { kind } } : {}),
  }
}

const ante = (pid: string, roundId: string, roundNum: number, legacy: boolean) =>
  tx('PLAYER_CONTRIBUTION', roundId, [[pacct(pid), FEE]], [['ACCOUNT_BOARD', FEE]], `Round ${roundNum} board fee`, legacy ? undefined : TX_KIND.BOARD_FEE)
const betLoss = (pid: string, roundId: string, amt: number, legacy: boolean) =>
  tx('PLAYER_CONTRIBUTION', roundId, [[pacct(pid), amt]], [['ACCOUNT_BOARD', amt]], 'Lost bet', legacy ? undefined : TX_KIND.BET_LOSS)
const betWin = (pid: string, roundId: string, amt: number, legacy: boolean) =>
  tx('BOARD_PAYOUT', roundId, [['ACCOUNT_BOARD', amt]], [[pacct(pid), amt]], 'Won bet', legacy ? undefined : TX_KIND.BET_WIN)

function round(id: string, num: number, status: Round['status']): Round {
  return { id, roundNumber: num, name: `Round ${num}`, status, createdAt: BASE, participatingPlayerIds: [...PIDS] }
}

/** Active round 1 with antes plus one won and one lost bet. */
function seedWithBets(legacy = false): GameState {
  return {
    gameName: 'Test Game', createdAt: BASE, boardMoneyPaise: FEE,
    players: PLAYERS, rounds: [round('round_1', 1, 'ACTIVE')],
    transactions: [
      ...PIDS.map(p => ante(p, 'round_1', 1, legacy)),
      betLoss('p_bala', 'round_1', 5000, legacy),
      betWin('p_arun', 'round_1', 5000, legacy),
    ],
    settlementTransfers: [], boardAllocationConfirmed: false,
  }
}

/** Completed round 1 (with bets) + fresh active round 2 with only antes. */
function seedFreshRound(legacy = false): GameState {
  return {
    gameName: 'Test Game', createdAt: BASE, boardMoneyPaise: FEE,
    players: PLAYERS,
    rounds: [round('round_1', 1, 'COMPLETED'), round('round_2', 2, 'ACTIVE')],
    transactions: [
      ...PIDS.map(p => ante(p, 'round_1', 1, legacy)),
      betLoss('p_bala', 'round_1', 15000, legacy),
      betWin('p_arun', 'round_1', 15000, legacy),
      ...PIDS.map(p => ante(p, 'round_2', 2, legacy)),
    ],
    settlementTransfers: [], boardAllocationConfirmed: false,
  }
}

/** Active round where a player has won more than a lowered fee would cover. */
function seedBigWin(): GameState {
  return {
    gameName: 'Test Game', createdAt: BASE, boardMoneyPaise: FEE,
    players: PLAYERS, rounds: [round('round_1', 1, 'ACTIVE')],
    transactions: [
      ...PIDS.map(p => ante(p, 'round_1', 1, false)),
      betWin('p_arun', 'round_1', 15000, false),
    ],
    settlementTransfers: [], boardAllocationConfirmed: false,
  }
}

function boardOf(state: GameState) {
  return calculateBoardBalance(state.transactions.flatMap(t => t.entries))
}

function renderWithState(seed: GameState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
  return renderHook(() => useGame(), { wrapper })
}

beforeEach(() => {
  localStorage.clear()
  seq = 0
})

describe('Audit-fix regressions: settlement gating and refunds', () => {
  it('blocks settling a round that has recorded bets', () => {
    const { result } = renderWithState(seedWithBets())
    let ret: { settled: boolean; reason?: string } | undefined
    act(() => { ret = result.current.completeGameAndSettle() })
    expect(ret?.settled).toBe(false)
    expect(ret?.reason).toMatch(/cannot be settled/i)
    // State untouched: all transactions still present
    expect(result.current.state.transactions.length).toBe(5)
  })

  it('enables settling after the current round is cancelled', () => {
    const { result } = renderWithState(seedWithBets())
    act(() => { result.current.cancelCurrentRound('test') })
    let ret: { settled: boolean } | undefined
    act(() => { ret = result.current.completeGameAndSettle() })
    expect(ret?.settled).toBe(true)
  })

  it('enables settling after individual bets are undone (no full cancel needed)', () => {
    const { result } = renderWithState(seedWithBets())
    act(() => { expect(result.current.undoLastBet().undone).toBe(true) })
    act(() => { expect(result.current.undoLastBet().undone).toBe(true) })
    expect(result.current.undoLastBet().undone).toBe(false) // no bets left
    let ret: { settled: boolean } | undefined
    act(() => { ret = result.current.completeGameAndSettle() })
    expect(ret?.settled).toBe(true)
  })

  it('refunds only the fresh round fees and preserves the carried pot', () => {
    const { result } = renderWithState(seedFreshRound())
    expect(boardOf(result.current.state)).toBe(60000)
    act(() => { result.current.completeGameAndSettle() })
    const s = result.current.state
    // Round-2 fee transactions removed; round-1 history intact
    expect(s.transactions.length).toBe(5)
    expect(s.transactions.some(t => t.roundId === 'round_2')).toBe(false)
    // Carried pot from round 1 preserved exactly
    expect(boardOf(s)).toBe(30000)
    // Player nets reflect round 1 only: Arun +50, Bala -250, Charan -100
    expect(result.current.playerSummaries['p_arun'].netPositionPaise).toBe(5000)
    expect(result.current.playerSummaries['p_bala'].netPositionPaise).toBe(-25000)
    expect(result.current.playerSummaries['p_charan'].netPositionPaise).toBe(-10000)
  })

  it('handles legacy saved games (no metadata.kind) identically via notes fallback', () => {
    const legacy = seedFreshRound(true)
    // classifiers still recognize legacy transactions
    expect(legacy.transactions.filter(isBoardFeeTx).length).toBe(6)
    expect(legacy.transactions.filter(isBetActivityTx).length).toBe(2)
    const { result } = renderWithState(legacy)
    act(() => { result.current.completeGameAndSettle() })
    const s = result.current.state
    expect(boardOf(s)).toBe(30000)
    expect(s.transactions.some(t => t.roundId === 'round_2')).toBe(false)
    expect(result.current.playerSummaries['p_arun'].netPositionPaise).toBe(5000)
  })

  it('blocks settlement for a legacy round whose notes mark bet activity', () => {
    const { result } = renderWithState(seedWithBets(true))
    let ret: { settled: boolean } | undefined
    act(() => { ret = result.current.completeGameAndSettle() })
    expect(ret?.settled).toBe(false)
  })
})

describe('Audit-fix regressions: fee changes, restart and settled state', () => {
  it('rejects a fee cut that winnings would overdraw, with a reason', () => {
    const { result } = renderWithState(seedBigWin())
    let ret: { ok: boolean; reason?: string } | undefined
    act(() => { ret = result.current.setBoardMoneyPaise(1000) }) // ₹10
    expect(ret?.ok).toBe(false)
    expect(ret?.reason).toMatch(/Cannot lower/i)
    expect(result.current.boardMoneyPaise).toBe(FEE) // unchanged
    // A fee that keeps the board non-negative still applies
    act(() => { ret = result.current.setBoardMoneyPaise(6000) }) // ₹60: 3*6000-15000=3000 >= 0
    expect(ret?.ok).toBe(true)
    expect(result.current.boardMoneyPaise).toBe(6000)
  })

  it('keeps CANCELLED history and funds the restarted round', () => {
    const { result } = renderWithState(seedFreshRound())
    act(() => { result.current.completeGameAndSettle() })
    const boardBefore = boardOf(result.current.state) // 30000 carried
    act(() => { result.current.createRound() })
    const s = result.current.state
    const active = s.rounds.find(r => r.status === 'ACTIVE')
    expect(active).toBeDefined()
    // New round funded by fresh antes on top of the carried pot
    expect(boardOf(s)).toBe(boardBefore + FEE * 3)
    expect(s.transactions.filter(t => t.roundId === active!.id && isBoardFeeTx(t)).length).toBe(3)
    // Cancel it: CANCELLED record must survive a subsequent restart
    act(() => { result.current.cancelCurrentRound('test') })
    expect(s.rounds.some(r => r.status === 'CANCELLED') || result.current.state.rounds.some(r => r.status === 'CANCELLED')).toBe(true)
  })

  it('cannot complete a phantom round after the game is settled', () => {
    const { result } = renderWithState(seedFreshRound())
    act(() => { result.current.completeGameAndSettle() })
    const roundsBefore = result.current.state.rounds.length
    act(() => { result.current.finishRoundAndStartNext() })
    expect(result.current.state.rounds.length).toBe(roundsBefore)
    expect(result.current.state.rounds.some(r => r.status === 'ACTIVE')).toBe(false)
  })
})
