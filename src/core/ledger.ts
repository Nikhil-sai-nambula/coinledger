import {
  ACCOUNT_BOARD,
  ACCOUNT_EXTERNAL,
  getPlayerAccountId,
  extractPlayerIdFromAccount,
  isPlayerAccount,
  type LedgerEntry,
  type Transaction,
  type TransactionCategory,
  type Player,
  type PlayerBalanceSummary,
  type AccountingOverviewData,
} from '../types/accounting'
import { assertPaiseInteger } from '../utils/money'

export class AccountingError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'AccountingError'
  }
}

/**
 * Validates a single transaction's accounting integrity:
 * 1. Has non-empty entries.
 * 2. All amounts are positive integer paise.
 * 3. Total debits exactly equal total credits (Fundamental Double-Entry Invariant).
 */
export function validateTransactionEntries(entries: LedgerEntry[]): {
  totalDebitPaise: number
  totalCreditPaise: number
  isBalanced: boolean
} {
  if (!entries || entries.length === 0) {
    throw new AccountingError('Transaction must contain at least one debit and one credit entry', 'EMPTY_ENTRIES')
  }

  let totalDebitPaise = 0
  let totalCreditPaise = 0

  for (const entry of entries) {
    assertPaiseInteger(entry.amountPaise, `Entry for account ${entry.accountId}`)
    if (entry.amountPaise <= 0) {
      throw new AccountingError(`Entry amount must be strictly positive (> 0), got: ${entry.amountPaise}`, 'NON_POSITIVE_AMOUNT')
    }

    if (entry.type === 'DEBIT') {
      totalDebitPaise += entry.amountPaise
    } else if (entry.type === 'CREDIT') {
      totalCreditPaise += entry.amountPaise
    } else {
      throw new AccountingError(`Invalid entry type: ${entry.type}`, 'INVALID_ENTRY_TYPE')
    }
  }

  if (totalDebitPaise !== totalCreditPaise) {
    throw new AccountingError(
      `Transaction is unbalanced: Total Debits (₹${(totalDebitPaise / 100).toFixed(2)}) != Total Credits (₹${(totalCreditPaise / 100).toFixed(2)}). Discrepancy: ₹${(Math.abs(totalDebitPaise - totalCreditPaise) / 100).toFixed(2)}`,
      'UNBALANCED_TRANSACTION'
    )
  }

  return {
    totalDebitPaise,
    totalCreditPaise,
    isBalanced: true,
  }
}

/**
 * Derives current Board balance directly from all ledger entries.
 * Board Balance = Total Credits to Board - Total Debits to Board.
 */
export function calculateBoardBalance(entries: LedgerEntry[]): number {
  let boardCredits = 0
  let boardDebits = 0

  for (const entry of entries) {
    if (entry.accountId === ACCOUNT_BOARD) {
      if (entry.type === 'CREDIT') {
        boardCredits += entry.amountPaise
      } else if (entry.type === 'DEBIT') {
        boardDebits += entry.amountPaise
      }
    }
  }

  return boardCredits - boardDebits
}

/**
 * Derives net position for all players strictly from ledger entries.
 * Net Position = Total Credits to Player - Total Debits to Player.
 * Positive = Player should receive money (in surplus/credit).
 * Negative = Player owes money (in deficit/debit).
 */
export function calculatePlayerBalances(
  entries: LedgerEntry[],
  players: Player[]
): Record<string, PlayerBalanceSummary> {
  const summaries: Record<string, PlayerBalanceSummary> = {}

  for (const p of players) {
    summaries[p.id] = {
      playerId: p.id,
      playerName: p.name,
      totalContributionsPaise: 0,
      totalPayoutsPaise: 0,
      directReceivedPaise: 0,
      directPaidPaise: 0,
      initialFundingPaise: 0,
      otherCreditsPaise: 0,
      otherDebitsPaise: 0,
      totalCreditsPaise: 0,
      totalDebitsPaise: 0,
      netPositionPaise: 0,
    }
  }

  for (const entry of entries) {
    const playerId = extractPlayerIdFromAccount(entry.accountId)
    if (!playerId || !summaries[playerId]) continue

    const summary = summaries[playerId]
    if (entry.type === 'CREDIT') {
      summary.totalCreditsPaise += entry.amountPaise
    } else {
      summary.totalDebitsPaise += entry.amountPaise
    }
  }

  // Calculate net position
  for (const p of players) {
    const s = summaries[p.id]
    s.netPositionPaise = s.totalCreditsPaise - s.totalDebitsPaise
  }

  return summaries
}

/**
 * Detailed breakdown of player movements by inspecting transactions.
 */
export function calculatePlayerDetailedMovements(
  transactions: Transaction[],
  players: Player[]
): Record<string, PlayerBalanceSummary> {
  const summaries: Record<string, PlayerBalanceSummary> = {}

  for (const p of players) {
    summaries[p.id] = {
      playerId: p.id,
      playerName: p.name,
      totalContributionsPaise: 0,
      totalPayoutsPaise: 0,
      directReceivedPaise: 0,
      directPaidPaise: 0,
      initialFundingPaise: 0,
      otherCreditsPaise: 0,
      otherDebitsPaise: 0,
      totalCreditsPaise: 0,
      totalDebitsPaise: 0,
      netPositionPaise: 0,
    }
  }

  for (const tx of transactions) {
    for (const entry of tx.entries) {
      const playerId = extractPlayerIdFromAccount(entry.accountId)
      if (!playerId || !summaries[playerId]) continue

      const s = summaries[playerId]
      if (entry.type === 'CREDIT') {
        s.totalCreditsPaise += entry.amountPaise
        switch (tx.category) {
          case 'BOARD_PAYOUT':
            s.totalPayoutsPaise += entry.amountPaise
            break
          case 'PLAYER_TRANSFER':
            s.directReceivedPaise += entry.amountPaise
            break
          case 'INITIAL_PLAYER_BALANCE':
            s.initialFundingPaise += entry.amountPaise
            break
          default:
            s.otherCreditsPaise += entry.amountPaise
        }
      } else if (entry.type === 'DEBIT') {
        s.totalDebitsPaise += entry.amountPaise
        switch (tx.category) {
          case 'PLAYER_CONTRIBUTION':
            s.totalContributionsPaise += entry.amountPaise
            break
          case 'PLAYER_TRANSFER':
            s.directPaidPaise += entry.amountPaise
            break
          default:
            s.otherDebitsPaise += entry.amountPaise
        }
      }
    }
  }

  for (const p of players) {
    const s = summaries[p.id]
    s.netPositionPaise = s.totalCreditsPaise - s.totalDebitsPaise
  }

  return summaries
}

/**
 * Calculates the comprehensive Accounting Overview metrics.
 * Verifies global ledger balance invariant: Total Debits === Total Credits across all accounts.
 */
export function calculateAccountingOverview(
  transactions: Transaction[],
  players: Player[]
): AccountingOverviewData {
  let totalDebitsPaise = 0
  let totalCreditsPaise = 0
  let totalContributionsPaise = 0
  let totalBoardPayoutsPaise = 0

  const allEntries: LedgerEntry[] = []

  for (const tx of transactions) {
    for (const entry of tx.entries) {
      allEntries.push(entry)
      if (entry.type === 'DEBIT') {
        totalDebitsPaise += entry.amountPaise
      } else {
        totalCreditsPaise += entry.amountPaise
      }

      // Track Board Payouts & Player Contributions
      if (tx.category === 'PLAYER_CONTRIBUTION' && entry.accountId === ACCOUNT_BOARD && entry.type === 'CREDIT') {
        totalContributionsPaise += entry.amountPaise
      }
      if (tx.category === 'BOARD_PAYOUT' && entry.accountId === ACCOUNT_BOARD && entry.type === 'DEBIT') {
        totalBoardPayoutsPaise += entry.amountPaise
      }
    }
  }

  const currentBoardBalancePaise = calculateBoardBalance(allEntries)
  const playerSummaries = calculatePlayerBalances(allEntries, players)

  let totalPlayerWinningsPaise = 0
  let totalPlayerLossesPaise = 0
  let unsettledBalancesPaise = 0

  for (const p of players) {
    const net = playerSummaries[p.id]?.netPositionPaise ?? 0
    if (net > 0) {
      totalPlayerWinningsPaise += net
      unsettledBalancesPaise += net
    } else if (net < 0) {
      totalPlayerLossesPaise += Math.abs(net)
    }
  }

  const discrepancyPaise = Math.abs(totalDebitsPaise - totalCreditsPaise)
  const isReconciled = discrepancyPaise === 0

  return {
    totalContributionsPaise,
    totalBoardPayoutsPaise,
    currentBoardBalancePaise,
    totalPlayerWinningsPaise,
    totalPlayerLossesPaise,
    unsettledBalancesPaise,
    totalDebitsPaise,
    totalCreditsPaise,
    isReconciled,
    discrepancyPaise,
  }
}

/**
 * Validates whether a transaction can be applied to the ledger.
 * Invariant: Never allow an accidental negative board balance.
 * Invariant: Prevent duplicate transaction IDs.
 */
export function assertCanApplyTransaction(
  existingTransactions: Transaction[],
  newTx: Transaction
): void {
  // Check duplicate ID
  if (existingTransactions.some(t => t.id === newTx.id)) {
    throw new AccountingError(`Transaction with ID "${newTx.id}" has already been processed`, 'DUPLICATE_TRANSACTION')
  }

  // Validate internal entry balance
  validateTransactionEntries(newTx.entries)

  // Calculate current board balance
  const currentEntries = existingTransactions.flatMap(t => t.entries)
  const currentBoardBalance = calculateBoardBalance(currentEntries)

  // Calculate delta to board account from newTx
  let boardDelta = 0
  for (const entry of newTx.entries) {
    if (entry.accountId === ACCOUNT_BOARD) {
      if (entry.type === 'CREDIT') boardDelta += entry.amountPaise
      if (entry.type === 'DEBIT') boardDelta -= entry.amountPaise
    }
  }

  const projectedBoardBalance = currentBoardBalance + boardDelta
  if (projectedBoardBalance < 0) {
    throw new AccountingError(
      `Transaction rejected: Action would cause Board account to become negative (Current: ₹${(currentBoardBalance / 100).toFixed(2)}, Change: ${boardDelta < 0 ? '-' : '+'}₹${(Math.abs(boardDelta) / 100).toFixed(2)}, Projected: ₹${(projectedBoardBalance / 100).toFixed(2)}). Board balance can never be negative.`,
      'NEGATIVE_BOARD_BALANCE_PREVENTED'
    )
  }
}

// ---------------------------------------------------------------------------
// FACTORY FUNCTIONS FOR FINANCIAL MOVEMENTS
// ---------------------------------------------------------------------------

let txCounter = 0
export function generateTransactionId(prefix = 'tx'): string {
  txCounter += 1
  return `${prefix}_${Date.now()}_${txCounter}_${Math.random().toString(36).substring(2, 7)}`
}

let entryCounter = 0
export function generateEntryId(): string {
  entryCounter += 1
  return `entry_${Date.now()}_${entryCounter}_${Math.random().toString(36).substring(2, 7)}`
}

/**
 * 1. Player contribution to board
 * When Player A contributes ₹100:
 * - Debit Player A's account by ₹100.
 * - Credit the Board account by ₹100.
 * - Record both entries under the same transaction ID.
 */
export function createPlayerContributionTransaction(params: {
  playerId: string
  playerName?: string
  amountPaise: number
  roundId?: string
  notes?: string
  timestamp?: number
}): Transaction {
  const { playerId, playerName, amountPaise, roundId, notes, timestamp = Date.now() } = params
  assertPaiseInteger(amountPaise, 'Player contribution')
  if (amountPaise <= 0) throw new AccountingError('Contribution amount must be greater than zero')

  const txId = generateTransactionId('tx_contrib')
  const playerAccount = getPlayerAccountId(playerId)

  const entries: LedgerEntry[] = [
    {
      id: generateEntryId(),
      transactionId: txId,
      accountId: playerAccount,
      type: 'DEBIT',
      amountPaise,
      createdAt: timestamp,
    },
    {
      id: generateEntryId(),
      transactionId: txId,
      accountId: ACCOUNT_BOARD,
      type: 'CREDIT',
      amountPaise,
      createdAt: timestamp,
    },
  ]

  validateTransactionEntries(entries)

  return {
    id: txId,
    timestamp,
    roundId,
    category: 'PLAYER_CONTRIBUTION',
    description: `${playerName || 'Player'} contributed ₹${(amountPaise / 100).toFixed(2)} to Board`,
    notes,
    entries,
  }
}

/**
 * 2. Board payout to player
 * When the board pays ₹300 to Player B:
 * - Debit Board by ₹300.
 * - Credit Player B by ₹300.
 * - Record both entries under the same transaction ID.
 */
export function createBoardPayoutTransaction(params: {
  playerId: string
  playerName?: string
  amountPaise: number
  roundId?: string
  notes?: string
  timestamp?: number
}): Transaction {
  const { playerId, playerName, amountPaise, roundId, notes, timestamp = Date.now() } = params
  assertPaiseInteger(amountPaise, 'Board payout')
  if (amountPaise <= 0) throw new AccountingError('Payout amount must be greater than zero')

  const txId = generateTransactionId('tx_payout')
  const playerAccount = getPlayerAccountId(playerId)

  const entries: LedgerEntry[] = [
    {
      id: generateEntryId(),
      transactionId: txId,
      accountId: ACCOUNT_BOARD,
      type: 'DEBIT',
      amountPaise,
      createdAt: timestamp,
    },
    {
      id: generateEntryId(),
      transactionId: txId,
      accountId: playerAccount,
      type: 'CREDIT',
      amountPaise,
      createdAt: timestamp,
    },
  ]

  validateTransactionEntries(entries)

  return {
    id: txId,
    timestamp,
    roundId,
    category: 'BOARD_PAYOUT',
    description: `Board paid ₹${(amountPaise / 100).toFixed(2)} to ${playerName || 'Player'}`,
    notes,
    entries,
  }
}

/**
 * 3. Player-to-player transfer
 * When Player A pays Player B ₹200:
 * - Debit Player A by ₹200.
 * - Credit Player B by ₹200.
 * - Record both entries under the same transaction ID.
 */
export function createPlayerTransferTransaction(params: {
  fromPlayerId: string
  toPlayerId: string
  fromPlayerName?: string
  toPlayerName?: string
  amountPaise: number
  roundId?: string
  notes?: string
  timestamp?: number
}): Transaction {
  const { fromPlayerId, toPlayerId, fromPlayerName, toPlayerName, amountPaise, roundId, notes, timestamp = Date.now() } = params
  assertPaiseInteger(amountPaise, 'Player transfer')
  if (amountPaise <= 0) throw new AccountingError('Transfer amount must be greater than zero')
  if (fromPlayerId === toPlayerId) throw new AccountingError('Cannot transfer money to the same player')

  const txId = generateTransactionId('tx_transfer')
  const fromAccount = getPlayerAccountId(fromPlayerId)
  const toAccount = getPlayerAccountId(toPlayerId)

  const entries: LedgerEntry[] = [
    {
      id: generateEntryId(),
      transactionId: txId,
      accountId: fromAccount,
      type: 'DEBIT',
      amountPaise,
      createdAt: timestamp,
    },
    {
      id: generateEntryId(),
      transactionId: txId,
      accountId: toAccount,
      type: 'CREDIT',
      amountPaise,
      createdAt: timestamp,
    },
  ]

  validateTransactionEntries(entries)

  return {
    id: txId,
    timestamp,
    roundId,
    category: 'PLAYER_TRANSFER',
    description: `${fromPlayerName || 'Player'} paid ₹${(amountPaise / 100).toFixed(2)} to ${toPlayerName || 'Player'}`,
    notes,
    entries,
  }
}

/**
 * Peer-to-peer settlement payment
 * When Player A (who owes money) pays Player B (who is owed money):
 * - Credit Player A by amountPaise (extinguishes their debt liability, bringing balance to 0).
 * - Debit Player B by amountPaise (extinguishes their receivable credit, bringing balance to 0).
 * Both accounts net to exactly ₹0 upon complete settlement.
 */
export function createSettlementPaymentTransaction(params: {
  fromPlayerId: string
  toPlayerId: string
  fromPlayerName?: string
  toPlayerName?: string
  amountPaise: number
  transferId?: string
  notes?: string
  timestamp?: number
}): Transaction {
  const { fromPlayerId, toPlayerId, fromPlayerName, toPlayerName, amountPaise, transferId, notes, timestamp = Date.now() } = params
  assertPaiseInteger(amountPaise, 'Settlement payment')
  if (amountPaise <= 0) throw new AccountingError('Payment amount must be greater than zero')
  if (fromPlayerId === toPlayerId) throw new AccountingError('Cannot transfer money to the same player')

  const txId = generateTransactionId('tx_settle')
  const fromAccount = getPlayerAccountId(fromPlayerId)
  const toAccount = getPlayerAccountId(toPlayerId)

  const entries: LedgerEntry[] = [
    {
      id: generateEntryId(),
      transactionId: txId,
      accountId: fromAccount,
      type: 'CREDIT',
      amountPaise,
      createdAt: timestamp,
    },
    {
      id: generateEntryId(),
      transactionId: txId,
      accountId: toAccount,
      type: 'DEBIT',
      amountPaise,
      createdAt: timestamp,
    },
  ]

  validateTransactionEntries(entries)

  return {
    id: txId,
    timestamp,
    category: 'BOARD_SETTLEMENT_ALLOCATION',
    description: `Settlement: ${fromPlayerName || 'Player'} paid ₹${(amountPaise / 100).toFixed(0)} to ${toPlayerName || 'Player'}`,
    notes: notes || 'Final peer-to-peer settlement payment',
    entries,
    metadata: { transferId, isSettlementPayment: true },
  }
}

/**
 * Initial Board Funding Transaction
 * Explicit financial movement from External Source to Board.
 * - Debit ACCOUNT_EXTERNAL
 * - Credit ACCOUNT_BOARD
 */
export function createInitialBoardFundingTransaction(params: {
  amountPaise: number
  notes?: string
  timestamp?: number
}): Transaction {
  const { amountPaise, notes = 'Initial board bankroll', timestamp = Date.now() } = params
  assertPaiseInteger(amountPaise, 'Initial board funding')
  if (amountPaise <= 0) throw new AccountingError('Initial funding must be greater than zero')

  const txId = generateTransactionId('tx_init_board')
  const entries: LedgerEntry[] = [
    {
      id: generateEntryId(),
      transactionId: txId,
      accountId: ACCOUNT_EXTERNAL,
      type: 'DEBIT',
      amountPaise,
      createdAt: timestamp,
    },
    {
      id: generateEntryId(),
      transactionId: txId,
      accountId: ACCOUNT_BOARD,
      type: 'CREDIT',
      amountPaise,
      createdAt: timestamp,
    },
  ]

  validateTransactionEntries(entries)

  return {
    id: txId,
    timestamp,
    category: 'INITIAL_BOARD_FUNDING',
    description: `Opening board bankroll funding: ₹${(amountPaise / 100).toFixed(2)}`,
    notes,
    entries,
  }
}

/**
 * Initial Player Balance Transaction (optional starting stack from external funder)
 * - Debit ACCOUNT_EXTERNAL
 * - Credit Player Account
 */
export function createInitialPlayerBalanceTransaction(params: {
  playerId: string
  playerName?: string
  amountPaise: number
  notes?: string
  timestamp?: number
}): Transaction {
  const { playerId, playerName, amountPaise, notes = 'Initial player credit', timestamp = Date.now() } = params
  assertPaiseInteger(amountPaise, 'Initial player balance')
  if (amountPaise <= 0) throw new AccountingError('Initial balance must be greater than zero')

  const txId = generateTransactionId('tx_init_player')
  const playerAccount = getPlayerAccountId(playerId)

  const entries: LedgerEntry[] = [
    {
      id: generateEntryId(),
      transactionId: txId,
      accountId: ACCOUNT_EXTERNAL,
      type: 'DEBIT',
      amountPaise,
      createdAt: timestamp,
    },
    {
      id: generateEntryId(),
      transactionId: txId,
      accountId: playerAccount,
      type: 'CREDIT',
      amountPaise,
      createdAt: timestamp,
    },
  ]

  validateTransactionEntries(entries)

  return {
    id: txId,
    timestamp,
    category: 'INITIAL_PLAYER_BALANCE',
    description: `Initial starting credit for ${playerName || 'Player'}: ₹${(amountPaise / 100).toFixed(2)}`,
    notes,
    entries,
  }
}

/**
 * External deposit to Board mid-game
 * - Debit ACCOUNT_EXTERNAL
 * - Credit ACCOUNT_BOARD
 */
export function createExternalDepositTransaction(params: {
  amountPaise: number
  notes?: string
  timestamp?: number
}): Transaction {
  const { amountPaise, notes, timestamp = Date.now() } = params
  assertPaiseInteger(amountPaise, 'External deposit')
  if (amountPaise <= 0) throw new AccountingError('Deposit amount must be greater than zero')

  const txId = generateTransactionId('tx_ext_dep')
  const entries: LedgerEntry[] = [
    {
      id: generateEntryId(),
      transactionId: txId,
      accountId: ACCOUNT_EXTERNAL,
      type: 'DEBIT',
      amountPaise,
      createdAt: timestamp,
    },
    {
      id: generateEntryId(),
      transactionId: txId,
      accountId: ACCOUNT_BOARD,
      type: 'CREDIT',
      amountPaise,
      createdAt: timestamp,
    },
  ]

  validateTransactionEntries(entries)

  return {
    id: txId,
    timestamp,
    category: 'EXTERNAL_DEPOSIT',
    description: `External deposit to Board: ₹${(amountPaise / 100).toFixed(2)}`,
    notes,
    entries,
  }
}

/**
 * External withdrawal from Board mid-game
 * - Debit ACCOUNT_BOARD
 * - Credit ACCOUNT_EXTERNAL
 */
export function createExternalWithdrawalTransaction(params: {
  amountPaise: number
  notes?: string
  timestamp?: number
}): Transaction {
  const { amountPaise, notes, timestamp = Date.now() } = params
  assertPaiseInteger(amountPaise, 'External withdrawal')
  if (amountPaise <= 0) throw new AccountingError('Withdrawal amount must be greater than zero')

  const txId = generateTransactionId('tx_ext_with')
  const entries: LedgerEntry[] = [
    {
      id: generateEntryId(),
      transactionId: txId,
      accountId: ACCOUNT_BOARD,
      type: 'DEBIT',
      amountPaise,
      createdAt: timestamp,
    },
    {
      id: generateEntryId(),
      transactionId: txId,
      accountId: ACCOUNT_EXTERNAL,
      type: 'CREDIT',
      amountPaise,
      createdAt: timestamp,
    },
  ]

  validateTransactionEntries(entries)

  return {
    id: txId,
    timestamp,
    category: 'EXTERNAL_WITHDRAWAL',
    description: `External withdrawal from Board: ₹${(amountPaise / 100).toFixed(2)}`,
    notes,
    entries,
  }
}

/**
 * Reversal Transaction:
 * Creates an exact inverse transaction (swapping debits and credits).
 * Invariant: Cannot silently delete. Retains complete audit history.
 */
export function createReversalTransaction(
  originalTx: Transaction,
  reason: string,
  timestamp = Date.now()
): Transaction {
  if (originalTx.isReversed) {
    throw new AccountingError(`Transaction ${originalTx.id} has already been reversed`, 'ALREADY_REVERSED')
  }

  const txId = generateTransactionId('tx_rev')
  const inverseEntries: LedgerEntry[] = originalTx.entries.map(entry => ({
    id: generateEntryId(),
    transactionId: txId,
    accountId: entry.accountId,
    // Exact swap: DEBIT becomes CREDIT, CREDIT becomes DEBIT
    type: entry.type === 'DEBIT' ? 'CREDIT' : 'DEBIT',
    amountPaise: entry.amountPaise,
    createdAt: timestamp,
  }))

  validateTransactionEntries(inverseEntries)

  return {
    id: txId,
    timestamp,
    roundId: originalTx.roundId,
    category: 'REVERSAL',
    description: `Reversal of [${originalTx.description}]`,
    notes: reason || 'Transaction reversed by host',
    entries: inverseEntries,
    reversedTransactionId: originalTx.id,
  }
}

