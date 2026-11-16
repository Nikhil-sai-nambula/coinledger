import React, { createContext, useContext, useState, useEffect } from 'react'
import {
  type Player,
  type Round,
  type Transaction,
  type SettlementTransfer,
  type SettlementPlan,
  type AccountingOverviewData,
  type PlayerBalanceSummary,
  type GameState,
} from '../types/accounting'
import {
  createInitialBoardFundingTransaction,
  createInitialPlayerBalanceTransaction,
  createExternalDepositTransaction,
  createExternalWithdrawalTransaction,
  createPlayerContributionTransaction,
  createBoardPayoutTransaction,
  createPlayerTransferTransaction,
  createReversalTransaction,
  assertCanApplyTransaction,
  calculateBoardBalance,
  calculatePlayerDetailedMovements,
  calculateAccountingOverview,
  generateTransactionId,
} from '../core/ledger'
import {
  evaluateSettlementPlan,
  createDistributeBoardFundsEquallyTransaction,
  createRefundBoardFundsToExternalTransaction,
} from '../core/settlement'

interface GameContextType {
  state: GameState
  overview: AccountingOverviewData
  playerSummaries: Record<string, PlayerBalanceSummary>
  boardBalancePaise: number
  settlementPlan: SettlementPlan
  activeRound: Round | undefined
  currentTab: 'overview' | 'rounds' | 'ledger' | 'settlement' | 'funding'
  setCurrentTab: (tab: 'overview' | 'rounds' | 'ledger' | 'settlement' | 'funding') => void
  addPlayer: (name: string) => void
  removePlayer: (id: string) => void
  createRound: (name?: string, notes?: string) => void
  completeRound: (roundId: string) => void
  recordInitialFunding: (boardAmountPaise: number, playerInitialBalances: Record<string, number>) => void
  recordExternalDeposit: (amountPaise: number, notes?: string) => void
  recordExternalWithdrawal: (amountPaise: number, notes?: string) => void
  recordContribution: (playerId: string, amountPaise: number, roundId?: string, notes?: string) => void
  recordPayout: (playerId: string, amountPaise: number, roundId?: string, notes?: string) => void
  recordPlayerTransfer: (fromPlayerId: string, toPlayerId: string, amountPaise: number, roundId?: string, notes?: string) => void
  reverseTransaction: (txId: string, reason: string) => void
  resolveBoardAllocation: (action: 'DISTRIBUTE_EQUAL' | 'REFUND_EXTERNAL' | 'HOST_RAKE' | 'CONFIRM_AS_IS') => void
  toggleSettlementTransfer: (transferId: string) => void
  resetGame: (newGameName?: string) => void
  loadDemoGame: () => void
}

const STORAGE_KEY = 'coinledger_gamestate_v2'

const AVATAR_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
]

function getInitialState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.players) && Array.isArray(parsed.transactions)) {
        return parsed
      }
    }
  } catch (err) {
    console.warn('Failed to parse saved game state', err)
  }

  // Default clean state with initial players
  return {
    gameName: 'Saturday Poker & Board Night',
    createdAt: Date.now(),
    players: [
      { id: 'p_alex', name: 'Alex M.', avatarColor: AVATAR_COLORS[0], createdAt: Date.now() },
      { id: 'p_priya', name: 'Priya K.', avatarColor: AVATAR_COLORS[1], createdAt: Date.now() },
      { id: 'p_rahul', name: 'Rahul S.', avatarColor: AVATAR_COLORS[2], createdAt: Date.now() },
      { id: 'p_sam', name: 'Sam T.', avatarColor: AVATAR_COLORS[3], createdAt: Date.now() },
    ],
    rounds: [
      { id: 'round_1', roundNumber: 1, name: 'Round 1: Buy-In & Opening Play', status: 'ACTIVE', createdAt: Date.now() }
    ],
    transactions: [],
    settlementTransfers: [],
    boardAllocationConfirmed: false,
  }
}

const GameContext = createContext<GameContextType | undefined>(undefined)

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GameState>(getInitialState)
  const [currentTab, setCurrentTab] = useState<'overview' | 'rounds' | 'ledger' | 'settlement' | 'funding'>('overview')

  // Persist state to localStorage on every update
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (err) {
      console.warn('Failed to save to localStorage', err)
    }
  }, [state])

  // Computed Accounting Metrics derived strictly from Ledger Entries
  const overview = calculateAccountingOverview(state.transactions, state.players)
  const playerSummaries = calculatePlayerDetailedMovements(state.transactions, state.players)
  const boardBalancePaise = calculateBoardBalance(state.transactions.flatMap(t => t.entries))
  const settlementPlan = evaluateSettlementPlan({
    transactions: state.transactions,
    players: state.players,
    boardAllocationConfirmed: state.boardAllocationConfirmed,
  })

  const activeRound = state.rounds.find(r => r.status === 'ACTIVE')

  // Helper to append a validated transaction
  const commitTransaction = (tx: Transaction) => {
    assertCanApplyTransaction(state.transactions, tx)
    setState(prev => ({
      ...prev,
      transactions: [tx, ...prev.transactions],
      boardAllocationConfirmed: false, // Reset allocation confirmation if transactions change
    }))
  }

  const addPlayer = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const id = `player_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const color = AVATAR_COLORS[state.players.length % AVATAR_COLORS.length]
    setState(prev => ({
      ...prev,
      players: [...prev.players, { id, name: trimmed, avatarColor: color, createdAt: Date.now() }],
    }))
  }

  const removePlayer = (id: string) => {
    // Check if player has ledger transactions
    const hasTransactions = state.transactions.some(tx =>
      tx.entries.some(e => e.accountId === `ACCOUNT_PLAYER_${id}`)
    )
    if (hasTransactions) {
      throw new Error('Cannot remove player with active transaction history. Zero-out player first or reset game.')
    }
    setState(prev => ({
      ...prev,
      players: prev.players.filter(p => p.id !== id),
    }))
  }

  const createRound = (name?: string, notes?: string) => {
    const nextNumber = state.rounds.length + 1
    const newRound: Round = {
      id: `round_${nextNumber}_${Date.now()}`,
      roundNumber: nextNumber,
      name: name || `Round ${nextNumber}`,
      notes,
      status: 'ACTIVE',
      createdAt: Date.now(),
    }
    setState(prev => ({
      ...prev,
      // Mark prior rounds as completed
      rounds: [...prev.rounds.map(r => ({ ...r, status: 'COMPLETED' as const })), newRound],
    }))
  }

  const completeRound = (roundId: string) => {
    setState(prev => ({
      ...prev,
      rounds: prev.rounds.map(r => (r.id === roundId ? { ...r, status: 'COMPLETED', completedAt: Date.now() } : r)),
    }))
  }

  const recordInitialFunding = (boardAmountPaise: number, playerInitialBalances: Record<string, number>) => {
    const newTxs: Transaction[] = []
    if (boardAmountPaise > 0) {
      newTxs.push(createInitialBoardFundingTransaction({ amountPaise: boardAmountPaise }))
    }
    for (const [playerId, amountPaise] of Object.entries(playerInitialBalances)) {
      if (amountPaise > 0) {
        const player = state.players.find(p => p.id === playerId)
        newTxs.push(createInitialPlayerBalanceTransaction({
          playerId,
          playerName: player?.name,
          amountPaise,
        }))
      }
    }

    if (newTxs.length === 0) return

    setState(prev => {
      let currentTxs = [...prev.transactions]
      for (const tx of newTxs) {
        assertCanApplyTransaction(currentTxs, tx)
        currentTxs = [tx, ...currentTxs]
      }
      return {
        ...prev,
        transactions: currentTxs,
      }
    })
  }

  const recordExternalDeposit = (amountPaise: number, notes?: string) => {
    const tx = createExternalDepositTransaction({ amountPaise, notes })
    commitTransaction(tx)
  }

  const recordExternalWithdrawal = (amountPaise: number, notes?: string) => {
    const tx = createExternalWithdrawalTransaction({ amountPaise, notes })
    commitTransaction(tx)
  }

  const recordContribution = (playerId: string, amountPaise: number, roundId?: string, notes?: string) => {
    const player = state.players.find(p => p.id === playerId)
    const effectiveRoundId = roundId || activeRound?.id
    const tx = createPlayerContributionTransaction({
      playerId,
      playerName: player?.name,
      amountPaise,
      roundId: effectiveRoundId,
      notes,
    })
    commitTransaction(tx)
  }

  const recordPayout = (playerId: string, amountPaise: number, roundId?: string, notes?: string) => {
    const player = state.players.find(p => p.id === playerId)
    const effectiveRoundId = roundId || activeRound?.id
    const tx = createBoardPayoutTransaction({
      playerId,
      playerName: player?.name,
      amountPaise,
      roundId: effectiveRoundId,
      notes,
    })
    commitTransaction(tx)
  }

  const recordPlayerTransfer = (
    fromPlayerId: string,
    toPlayerId: string,
    amountPaise: number,
    roundId?: string,
    notes?: string
  ) => {
    const fromP = state.players.find(p => p.id === fromPlayerId)
    const toP = state.players.find(p => p.id === toPlayerId)
    const effectiveRoundId = roundId || activeRound?.id
    const tx = createPlayerTransferTransaction({
      fromPlayerId,
      toPlayerId,
      fromPlayerName: fromP?.name,
      toPlayerName: toP?.name,
      amountPaise,
      roundId: effectiveRoundId,
      notes,
    })
    commitTransaction(tx)
  }

  const reverseTransaction = (txId: string, reason: string) => {
    const targetTx = state.transactions.find(t => t.id === txId)
    if (!targetTx) throw new Error('Transaction not found')

    const revTx = createReversalTransaction(targetTx, reason)
    assertCanApplyTransaction(state.transactions, revTx)

    setState(prev => ({
      ...prev,
      transactions: [
        revTx,
        ...prev.transactions.map(t => (t.id === txId ? { ...t, isReversed: true } : t)),
      ],
      boardAllocationConfirmed: false,
    }))
  }

  const resolveBoardAllocation = (action: 'DISTRIBUTE_EQUAL' | 'REFUND_EXTERNAL' | 'HOST_RAKE' | 'CONFIRM_AS_IS') => {
    if (boardBalancePaise <= 0) return

    if (action === 'DISTRIBUTE_EQUAL') {
      const tx = createDistributeBoardFundsEquallyTransaction({
        boardBalancePaise,
        players: state.players,
      })
      commitTransaction(tx)
      setState(prev => ({ ...prev, boardAllocationConfirmed: true }))
    } else if (action === 'REFUND_EXTERNAL' || action === 'HOST_RAKE') {
      const tx = createRefundBoardFundsToExternalTransaction({
        boardBalancePaise,
        notes: action === 'HOST_RAKE' ? 'Host rake / table commission' : 'Refund remaining board funds to organizer',
      })
      commitTransaction(tx)
      setState(prev => ({ ...prev, boardAllocationConfirmed: true }))
    } else if (action === 'CONFIRM_AS_IS') {
      setState(prev => ({ ...prev, boardAllocationConfirmed: true }))
    }
  }

  const toggleSettlementTransfer = (transferId: string) => {
    setState(prev => {
      const existing = prev.settlementTransfers.find(t => t.id === transferId)
      let updatedTransfers: SettlementTransfer[]
      if (existing) {
        updatedTransfers = prev.settlementTransfers.map(t =>
          t.id === transferId ? { ...t, completed: !t.completed, completedAt: !t.completed ? Date.now() : undefined } : t
        )
      } else {
        // Find in current plan
        const planTransfer = settlementPlan.transfers.find(t => t.id === transferId)
        if (planTransfer) {
          updatedTransfers = [...prev.settlementTransfers, { ...planTransfer, completed: true, completedAt: Date.now() }]
        } else {
          updatedTransfers = prev.settlementTransfers
        }
      }
      return { ...prev, settlementTransfers: updatedTransfers }
    })
  }

  const resetGame = (newGameName?: string) => {
    setState({
      gameName: newGameName || 'CoinLedger Game',
      createdAt: Date.now(),
      players: [
        { id: 'p_1', name: 'Alice', avatarColor: AVATAR_COLORS[0], createdAt: Date.now() },
        { id: 'p_2', name: 'Bob', avatarColor: AVATAR_COLORS[1], createdAt: Date.now() },
        { id: 'p_3', name: 'Charlie', avatarColor: AVATAR_COLORS[2], createdAt: Date.now() },
      ],
      rounds: [
        { id: 'round_1', roundNumber: 1, name: 'Round 1', status: 'ACTIVE', createdAt: Date.now() }
      ],
      transactions: [],
      settlementTransfers: [],
      boardAllocationConfirmed: false,
    })
  }

  const loadDemoGame = () => {
    const p1: Player = { id: 'p1', name: 'Alice (Host)', avatarColor: AVATAR_COLORS[0], createdAt: 1000 }
    const p2: Player = { id: 'p2', name: 'Bob', avatarColor: AVATAR_COLORS[1], createdAt: 1000 }
    const p3: Player = { id: 'p3', name: 'Charlie', avatarColor: AVATAR_COLORS[2], createdAt: 1000 }
    const p4: Player = { id: 'p4', name: 'Dev', avatarColor: AVATAR_COLORS[3], createdAt: 1000 }

    const r1: Round = { id: 'demo_r1', roundNumber: 1, name: 'Round 1: Buy-In Ante', status: 'COMPLETED', createdAt: 1000, completedAt: 2000 }
    const r2: Round = { id: 'demo_r2', roundNumber: 2, name: 'Round 2: Mid Game', status: 'ACTIVE', createdAt: 2000 }

    const txs: Transaction[] = []
    // 1. Initial Board bankroll funding ₹1,000
    txs.push(createInitialBoardFundingTransaction({ amountPaise: 100000, timestamp: 1100 }))
    // 2. Initial player funding ₹200 for Dev
    txs.push(createInitialPlayerBalanceTransaction({ playerId: 'p4', playerName: 'Dev', amountPaise: 20000, timestamp: 1200 }))
    // 3. Round 1 contributions ₹100 from Alice, Bob, Charlie
    txs.push(createPlayerContributionTransaction({ playerId: 'p1', playerName: 'Alice', amountPaise: 10000, roundId: 'demo_r1', timestamp: 1300 }))
    txs.push(createPlayerContributionTransaction({ playerId: 'p2', playerName: 'Bob', amountPaise: 10000, roundId: 'demo_r1', timestamp: 1310 }))
    txs.push(createPlayerContributionTransaction({ playerId: 'p3', playerName: 'Charlie', amountPaise: 10000, roundId: 'demo_r1', timestamp: 1320 }))
    // 4. Round 1 Payout: Bob wins pot ₹300
    txs.push(createBoardPayoutTransaction({ playerId: 'p2', playerName: 'Bob', amountPaise: 30000, roundId: 'demo_r1', timestamp: 1400 }))
    // 5. Round 1 Player transfer: Alice pays Bob side bet ₹50
    txs.push(createPlayerTransferTransaction({ fromPlayerId: 'p1', toPlayerId: 'p2', fromPlayerName: 'Alice', toPlayerName: 'Bob', amountPaise: 5000, roundId: 'demo_r1', timestamp: 1500 }))

    // 6. Round 2: Re-buys and contributions
    txs.push(createPlayerContributionTransaction({ playerId: 'p1', playerName: 'Alice', amountPaise: 20000, roundId: 'demo_r2', timestamp: 2100 }))
    txs.push(createPlayerContributionTransaction({ playerId: 'p4', playerName: 'Dev', amountPaise: 15000, roundId: 'demo_r2', timestamp: 2110 }))
    // 7. Round 2 Payout: Charlie wins ₹250
    txs.push(createBoardPayoutTransaction({ playerId: 'p3', playerName: 'Charlie', amountPaise: 25000, roundId: 'demo_r2', timestamp: 2200 }))

    setState({
      gameName: 'Championship Poker Night (Demo)',
      createdAt: 1000,
      players: [p1, p2, p3, p4],
      rounds: [r1, r2],
      transactions: txs.reverse(),
      settlementTransfers: [],
      boardAllocationConfirmed: false,
    })
  }

  return (
    <GameContext.Provider
      value={{
        state,
        overview,
        playerSummaries,
        boardBalancePaise,
        settlementPlan,
        activeRound,
        currentTab,
        setCurrentTab,
        addPlayer,
        removePlayer,
        createRound,
        completeRound,
        recordInitialFunding,
        recordExternalDeposit,
        recordExternalWithdrawal,
        recordContribution,
        recordPayout,
        recordPlayerTransfer,
        reverseTransaction,
        resolveBoardAllocation,
        toggleSettlementTransfer,
        resetGame,
        loadDemoGame,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}

export function useGame(): GameContextType {
  const context = useContext(GameContext)
  if (!context) throw new Error('useGame must be used within a GameProvider')
  return context
}
