import {
  ACCOUNT_BOARD,
  ACCOUNT_EXTERNAL,
  getPlayerAccountId,
  type Player,
  type Transaction,
  type SettlementTransfer,
  type SettlementPlan,
  type LedgerEntry,
} from '../types/accounting'
import {
  calculateBoardBalance,
  calculatePlayerBalances,
  calculateAccountingOverview,
  generateTransactionId,
  generateEntryId,
  validateTransactionEntries,
  AccountingError,
} from './ledger'
import { assertPaiseInteger } from '../utils/money'

export interface DebtorCreditorTransfer {
  id: string
  fromPlayerId: string
  toPlayerId: string
  fromPlayerName: string
  toPlayerName: string
  amountPaise: number
  completed: boolean
}

/**
 * Greedy Debtor-Creditor Settlement Algorithm
 * Minimizes the total number of cash transfers required between players.
 * Both debtors and creditors are sorted in descending order of magnitude.
 */
export function calculateGreedySettlementTransfers(
  netBalances: { playerId: string; playerName: string; netPositionPaise: number }[]
): SettlementTransfer[] {
  // Debtors owe money (netPositionPaise < 0). Store as positive amount owed.
  const debtors = netBalances
    .filter(p => p.netPositionPaise < 0)
    .map(p => ({
      playerId: p.playerId,
      playerName: p.playerName,
      remainingOwedPaise: Math.abs(p.netPositionPaise),
    }))
    .sort((a, b) => b.remainingOwedPaise - a.remainingOwedPaise)

  // Creditors are owed money (netPositionPaise > 0).
  const creditors = netBalances
    .filter(p => p.netPositionPaise > 0)
    .map(p => ({
      playerId: p.playerId,
      playerName: p.playerName,
      remainingDuePaise: p.netPositionPaise,
    }))
    .sort((a, b) => b.remainingDuePaise - a.remainingDuePaise)

  const transfers: SettlementTransfer[] = []
  let dIndex = 0
  let cIndex = 0
  let transferCount = 0

  while (dIndex < debtors.length && cIndex < creditors.length) {
    const debtor = debtors[dIndex]
    const creditor = creditors[cIndex]

    if (debtor.remainingOwedPaise === 0) {
      dIndex += 1
      continue
    }
    if (creditor.remainingDuePaise === 0) {
      cIndex += 1
      continue
    }

    const transferAmount = Math.min(debtor.remainingOwedPaise, creditor.remainingDuePaise)
    if (transferAmount > 0) {
      transferCount += 1
      transfers.push({
        id: `settle_${debtor.playerId}_to_${creditor.playerId}_${transferCount}`,
        fromPlayerId: debtor.playerId,
        toPlayerId: creditor.playerId,
        amountPaise: transferAmount,
        completed: false,
      })

      debtor.remainingOwedPaise -= transferAmount
      creditor.remainingDuePaise -= transferAmount
    }

    if (debtor.remainingOwedPaise === 0) dIndex += 1
    if (creditor.remainingDuePaise === 0) cIndex += 1
  }

  return transfers
}

/**
 * Validates and computes the full game Settlement Plan.
 * Enforces strict accounting invariants:
 * - Ledger must reconcile across all accounts.
 * - Board balance must not be negative.
 * - If board balance > 0, host must confirm allocation before player-to-player settlement.
 */
export function evaluateSettlementPlan(params: {
  transactions: Transaction[]
  players: Player[]
  boardAllocationConfirmed?: boolean
}): SettlementPlan {
  const { transactions, players, boardAllocationConfirmed = false } = params

  const allEntries = transactions.flatMap(t => t.entries)
  const overview = calculateAccountingOverview(transactions, players)
  const boardBalancePaise = calculateBoardBalance(allEntries)

  // Invariant 1: Ledger must be reconciled
  if (!overview.isReconciled) {
    return {
      status: 'BLOCKED_UNRECONCILED',
      reconciled: false,
      boardBalancePaise,
      unallocatedBoardFundsPaise: Math.max(0, boardBalancePaise),
      transfers: [],
      explanation: `Ledger reconciliation failed: Total Debits (₹${(overview.totalDebitsPaise / 100).toFixed(2)}) do not match Total Credits (₹${(overview.totalCreditsPaise / 100).toFixed(2)}). Discrepancy: ₹${(overview.discrepancyPaise / 100).toFixed(2)}. Settlement is blocked until the ledger balances.`,
    }
  }

  // Invariant 2: Board balance cannot be negative
  if (boardBalancePaise < 0) {
    return {
      status: 'BLOCKED_NEGATIVE_BOARD',
      reconciled: true,
      boardBalancePaise,
      unallocatedBoardFundsPaise: 0,
      transfers: [],
      explanation: `Board balance is negative: ₹${(boardBalancePaise / 100).toFixed(2)}. The board has paid out more money than it received. Review and reverse erroneous payouts before settling.`,
    }
  }

  // Invariant 3: Unallocated board funds must be resolved by host
  if (boardBalancePaise > 0 && !boardAllocationConfirmed) {
    return {
      status: 'BLOCKED_UNALLOCATED_BOARD',
      reconciled: true,
      boardBalancePaise,
      unallocatedBoardFundsPaise: boardBalancePaise,
      transfers: [],
      explanation: `The Board has ₹${(boardBalancePaise / 100).toFixed(2)} in unallocated game funds remaining. Under strict accounting rules, board funds are not automatically distributed to players. Please choose how to allocate or refund remaining board money to finalize settlement.`,
    }
  }

  // All invariants met: Calculate player net positions from gameplay (excluding peer-to-peer settlement payments)
  const gameEntries = transactions
    .filter(t => !t.metadata?.isSettlementPayment)
    .flatMap(t => t.entries)
  const playerBalances = calculatePlayerBalances(gameEntries, players)
  const balanceList = players.map(p => ({
    playerId: p.id,
    playerName: p.name,
    netPositionPaise: playerBalances[p.id]?.netPositionPaise ?? 0,
  }))

  const transfers = calculateGreedySettlementTransfers(balanceList)

  return {
    status: 'READY',
    reconciled: true,
    boardBalancePaise,
    unallocatedBoardFundsPaise: boardBalancePaise,
    transfers,
    explanation: boardBalancePaise === 0
      ? 'Board balance is zero and all accounts are reconciled. Final player-to-player settlement plan calculated.'
      : `Host confirmed handling of board funds (₹${(boardBalancePaise / 100).toFixed(2)}). Player settlement calculated.`,
  }
}

/**
 * Creates transactions to distribute remaining board funds equally among selected or all players.
 */
export function createDistributeBoardFundsEquallyTransaction(params: {
  boardBalancePaise: number
  players: Player[]
  timestamp?: number
}): Transaction {
  const { boardBalancePaise, players, timestamp = Date.now() } = params
  assertPaiseInteger(boardBalancePaise, 'Board funds')
  if (boardBalancePaise <= 0) throw new AccountingError('Board funds must be positive to distribute')
  if (!players || players.length === 0) throw new AccountingError('At least one player required to distribute funds')

  const count = players.length
  const baseSharePaise = Math.floor(boardBalancePaise / count)
  let remainderPaise = boardBalancePaise % count

  const txId = generateTransactionId('tx_board_dist')
  const entries: LedgerEntry[] = [
    // Debit board for total
    {
      id: generateEntryId(),
      transactionId: txId,
      accountId: ACCOUNT_BOARD,
      type: 'DEBIT',
      amountPaise: boardBalancePaise,
      createdAt: timestamp,
    },
  ]

  // Credit each player their share
  for (const p of players) {
    let playerShare = baseSharePaise
    if (remainderPaise > 0) {
      playerShare += 1
      remainderPaise -= 1
    }

    if (playerShare > 0) {
      entries.push({
        id: generateEntryId(),
        transactionId: txId,
        accountId: getPlayerAccountId(p.id),
        type: 'CREDIT',
        amountPaise: playerShare,
        createdAt: timestamp,
      })
    }
  }

  validateTransactionEntries(entries)

  return {
    id: txId,
    timestamp,
    category: 'BOARD_SETTLEMENT_ALLOCATION',
    description: `Final Settlement: Distributed ₹${(boardBalancePaise / 100).toFixed(2)} remaining board funds equally to ${count} player${count === 1 ? '' : 's'}`,
    entries,
  }
}

/**
 * Creates a transaction to refund remaining board funds to the external funder / house rake.
 */
export function createRefundBoardFundsToExternalTransaction(params: {
  boardBalancePaise: number
  notes?: string
  timestamp?: number
}): Transaction {
  const { boardBalancePaise, notes = 'Refund remaining board funds to external organizer/rake', timestamp = Date.now() } = params
  assertPaiseInteger(boardBalancePaise, 'Board funds to refund')
  if (boardBalancePaise <= 0) throw new AccountingError('Board funds must be positive to refund')

  const txId = generateTransactionId('tx_board_refund')
  const entries: LedgerEntry[] = [
    {
      id: generateEntryId(),
      transactionId: txId,
      accountId: ACCOUNT_BOARD,
      type: 'DEBIT',
      amountPaise: boardBalancePaise,
      createdAt: timestamp,
    },
    {
      id: generateEntryId(),
      transactionId: txId,
      accountId: ACCOUNT_EXTERNAL,
      type: 'CREDIT',
      amountPaise: boardBalancePaise,
      createdAt: timestamp,
    },
  ]

  validateTransactionEntries(entries)

  return {
    id: txId,
    timestamp,
    category: 'BOARD_SETTLEMENT_ALLOCATION',
    description: `Final Settlement: Refunded ₹${(boardBalancePaise / 100).toFixed(2)} unallocated board funds to external organizer`,
    notes,
    entries,
  }
}

