// Standard Account Identifiers
export const ACCOUNT_BOARD = 'ACCOUNT_BOARD'
export const ACCOUNT_EXTERNAL = 'ACCOUNT_EXTERNAL'

export function getPlayerAccountId(playerId: string): string {
  return `ACCOUNT_PLAYER_${playerId}`
}

export function isPlayerAccount(accountId: string): boolean {
  return accountId.startsWith('ACCOUNT_PLAYER_')
}

export function extractPlayerIdFromAccount(accountId: string): string | null {
  if (!isPlayerAccount(accountId)) return null
  return accountId.replace('ACCOUNT_PLAYER_', '')
}

export type EntryType = 'DEBIT' | 'CREDIT'

export interface LedgerEntry {
  id: string
  transactionId: string
  accountId: string
  type: EntryType
  amountPaise: number // Stored as integer paise (1 Rupee = 100 paise). Never float.
  createdAt: number
}

export type TransactionCategory =
  | 'INITIAL_BOARD_FUNDING'
  | 'INITIAL_PLAYER_BALANCE'
  | 'EXTERNAL_DEPOSIT'
  | 'EXTERNAL_WITHDRAWAL'
  | 'PLAYER_CONTRIBUTION'
  | 'BOARD_PAYOUT'
  | 'PLAYER_TRANSFER'
  | 'BOARD_SETTLEMENT_ALLOCATION'
  | 'REVERSAL'
  | 'ADJUSTMENT'

export interface Transaction {
  id: string
  timestamp: number
  roundId?: string
  category: TransactionCategory
  description: string
  notes?: string
  entries: LedgerEntry[]
  reversedTransactionId?: string
  isReversed?: boolean
  metadata?: Record<string, unknown>
}

export interface Player {
  id: string
  name: string
  avatarColor: string
  createdAt: number
  isActive?: boolean
}

export interface Round {
  id: string
  roundNumber: number
  name?: string
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  createdAt: number
  completedAt?: number
  notes?: string
  winnerPlayerIds?: string[]
  boardMoneyPaise?: number
  totalPotPaise?: number
  participatingPlayerIds?: string[]
  cancellationReason?: string
}

export interface SettlementTransfer {
  id: string
  fromPlayerId: string
  toPlayerId: string
  amountPaise: number
  completed: boolean
  completedAt?: number
  transactionId?: string
}

export interface SettlementPlan {
  status: 'READY' | 'BLOCKED_NEGATIVE_BOARD' | 'BLOCKED_UNRECONCILED' | 'BLOCKED_UNALLOCATED_BOARD'
  reconciled: boolean
  boardBalancePaise: number
  unallocatedBoardFundsPaise: number
  transfers: SettlementTransfer[]
  explanation?: string
}

export interface AccountingOverviewData {
  totalContributionsPaise: number
  totalBoardPayoutsPaise: number
  currentBoardBalancePaise: number
  totalPlayerWinningsPaise: number
  totalPlayerLossesPaise: number
  unsettledBalancesPaise: number
  totalDebitsPaise: number
  totalCreditsPaise: number
  isReconciled: boolean
  discrepancyPaise: number
}

export interface PlayerBalanceSummary {
  playerId: string
  playerName: string
  totalContributionsPaise: number
  totalPayoutsPaise: number
  directReceivedPaise: number
  directPaidPaise: number
  initialFundingPaise: number
  otherCreditsPaise: number
  otherDebitsPaise: number
  totalCreditsPaise: number
  totalDebitsPaise: number
  netPositionPaise: number // Positive: should receive money. Negative: owes money.
}

export interface GameState {
  gameName: string
  createdAt: number
  boardMoneyPaise?: number
  players: Player[]
  rounds: Round[]
  transactions: Transaction[]
  settlementTransfers: SettlementTransfer[]
  boardAllocationConfirmed: boolean
  boardAllocationOption?: 'DISTRIBUTE_EQUAL' | 'REFUND_EXTERNAL' | 'HOST_RAKE' | 'CUSTOM' | 'LEAVE_UNALLOCATED'
}

