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
  getPlayerAccountId,
} from '../types/accounting'
import {
  createInitialBoardFundingTransaction,
  createInitialPlayerBalanceTransaction,
  createExternalDepositTransaction,
  createExternalWithdrawalTransaction,
  createPlayerContributionTransaction,
  createBoardPayoutTransaction,
  createPlayerTransferTransaction,
  createSettlementPaymentTransaction,
  createReversalTransaction,
  assertCanApplyTransaction,
  calculateBoardBalance,
  calculatePlayerDetailedMovements,
  calculateAccountingOverview,
} from '../core/ledger'
import {
  evaluateSettlementPlan,
  createDistributeBoardFundsEquallyTransaction,
  createRefundBoardFundsToExternalTransaction,
} from '../core/settlement'

export interface GameContextType {
  state: GameState
  startedWithSavedGame: boolean
  overview: AccountingOverviewData
  playerSummaries: Record<string, PlayerBalanceSummary>
  boardBalancePaise: number
  settlementPlan: SettlementPlan
  activeRound: Round | undefined
  completedRounds: Round[]
  completedRoundsCount: number
  lastCompletedRound: Round | undefined
  boardMoneyPaise: number
  setBoardMoneyPaise: (paise: number) => void
  currentTab: 'play' | 'overview' | 'rounds' | 'settlement'
  setCurrentTab: (tab: 'play' | 'overview' | 'rounds' | 'settlement') => void
  addPlayer: (name: string) => { player: Player; feePaise: number }
  updatePlayerName: (id: string, name: string) => void
  removePlayer: (id: string) => { permanentlyRemoved: boolean; message: string }
  togglePlayerActive: (id: string) => { isRefunded: boolean; isAdded: boolean; feePaise: number; message: string }
  recordBet: (params: {
    playerId: string
    amountPaise: number
    outcome: 'WON' | 'LOST'
    notes?: string
  }) => { autoCompleted: boolean; nextRoundNumber?: number; celebrationMsg: string }
  cancelCurrentRound: (reason?: string) => void
  cancelPreviousRound: (reason?: string) => void
  cancelCurrentRoundConsecutive: (reason?: string) => void
  collectRoundBoardFee: (participatingPlayerIds?: string[], customFeePaise?: number) => void
  finishRoundAndStartNext: (options?: { autoCollectNextAnte?: boolean }) => void
  undoLastBet: () => { undone: boolean; message: string }
  undoLastAction: () => void
  playRound: (params: {
    winnerPlayerIds: string[]
    participatingPlayerIds?: string[]
    boardMoneyPaise?: number
    customPotPaise?: number
    notes?: string
    roundName?: string
  }) => void
  undoRound: (roundId: string) => void
  undoLastRound: () => void
  createRound: (name?: string, notes?: string) => void
  completeRound: (roundId: string) => void
  updateGameName: (name: string) => void
  recordInitialFunding: (boardAmountPaise: number, playerInitialBalances: Record<string, number>) => void
  recordExternalDeposit: (amountPaise: number, notes?: string) => void
  recordExternalWithdrawal: (amountPaise: number, notes?: string) => void
  recordContribution: (playerId: string, amountPaise: number, roundId?: string, notes?: string) => void
  recordPayout: (playerId: string, amountPaise: number, roundId?: string, notes?: string) => void
  recordPlayerTransfer: (fromPlayerId: string, toPlayerId: string, amountPaise: number, roundId?: string, notes?: string) => void
  reverseTransaction: (txId: string, reason: string) => void
  resolveBoardAllocation: (action: 'DISTRIBUTE_EQUAL' | 'REFUND_EXTERNAL' | 'HOST_RAKE' | 'CONFIRM_AS_IS') => void
  toggleSettlementTransfer: (transferId: string) => void
  settleAllAndCloseGame: () => void
  completeGameAndSettle: () => void
  resetGame: (newGameName?: string, defaultBoardMoneyPaise?: number) => void
  loadDemoGame: () => void
}

const STORAGE_KEY = 'coinledger_gamestate_v6'

export const AVATAR_COLORS = [
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#6366f1', // indigo
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#f97316', // orange
  '#06b6d4', // cyan
  '#e11d48', // rose
]

function hasSavedGameState(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return !!(parsed && Array.isArray(parsed.players) && Array.isArray(parsed.transactions))
  } catch {
    return false
  }
}

function getInitialState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.players) && Array.isArray(parsed.transactions)) {
        return {
          ...parsed,
          boardMoneyPaise: typeof parsed.boardMoneyPaise === 'number' ? parsed.boardMoneyPaise : 1000,
          players: parsed.players.map((p: Player) => ({
            ...p,
            isActive: p.isActive !== false,
          })),
        }
      }
    }
  } catch (err) {
    console.warn('Failed to parse saved game state', err)
  }

  const p1: Player = { id: 'p_sunny', name: 'Sunny', avatarColor: AVATAR_COLORS[0], createdAt: Date.now(), isActive: true }
  const p2: Player = { id: 'p_bunny', name: 'Bunny', avatarColor: AVATAR_COLORS[1], createdAt: Date.now(), isActive: true }
  const p3: Player = { id: 'p_deepu', name: 'Deepu', avatarColor: AVATAR_COLORS[2], createdAt: Date.now(), isActive: true }
  const p4: Player = { id: 'p_spanny', name: 'Spanny', avatarColor: AVATAR_COLORS[3], createdAt: Date.now(), isActive: true }
  const initialPlayers = [p1, p2, p3, p4]

  const roundFee = 1000 // ₹10 default ante
  const round1: Round = {
    id: 'round_1',
    roundNumber: 1,
    name: 'Round 1',
    status: 'ACTIVE',
    createdAt: Date.now(),
    boardMoneyPaise: roundFee,
    participatingPlayerIds: initialPlayers.map(p => p.id),
  }

  // Initial board fee of ₹10 per player for Round 1 -> Board starts with ₹40
  const initialTxs: Transaction[] = initialPlayers.map((p, idx) =>
    createPlayerContributionTransaction({
      playerId: p.id,
      playerName: p.name,
      amountPaise: roundFee,
      roundId: 'round_1',
      notes: 'Round 1 board fee',
      timestamp: Date.now() + idx,
    })
  )

  return {
    gameName: 'Game Night Ledger',
    createdAt: Date.now(),
    boardMoneyPaise: roundFee,
    players: initialPlayers,
    rounds: [round1],
    transactions: initialTxs.reverse(),
    settlementTransfers: [],
    boardAllocationConfirmed: false,
  }
}

const GameContext = createContext<GameContextType | undefined>(undefined)

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GameState>(getInitialState)
  const [currentTab, setCurrentTab] = useState<'play' | 'overview' | 'rounds' | 'settlement'>('play')

  // Whether this visit found a previously saved game in localStorage. Captured
  // once at mount, before the persist effect below can write anything.
  const startedWithSavedGame = React.useRef(hasSavedGameState()).current
  const pristineDefaultRef = React.useRef(state)

  // Persist state to localStorage on every update
  useEffect(() => {
    try {
      // A brand-new visitor's untouched default game is not a saved game: don't
      // write it, so a later visit with no interaction still counts as first-run.
      if (!startedWithSavedGame && state === pristineDefaultRef.current) return
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (err) {
      console.warn('Failed to save to localStorage', err)
    }
  }, [state, startedWithSavedGame])

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
  const completedRounds = state.rounds.filter(r => r.status === 'COMPLETED')
  const completedRoundsCount = completedRounds.length
  const lastCompletedRound = completedRounds.length > 0 ? completedRounds[completedRounds.length - 1] : undefined
  const boardMoneyPaise = state.boardMoneyPaise ?? 1000

  // Helper to append a validated transaction
  const commitTransaction = (tx: Transaction) => {
    assertCanApplyTransaction(state.transactions, tx)
    setState(prev => ({
      ...prev,
      transactions: [tx, ...prev.transactions],
      boardAllocationConfirmed: false,
    }))
  }

  /**
   * Sets board fee and dynamically adjusts active round ante & table pot!
   * If an active round is ongoing, every active player's round fee is updated,
   * instantly recalculating the table pot while preserving all existing bets.
   */
  const setBoardMoneyPaise = (paise: number) => {
    const newFeePaise = Math.max(0, Math.round(paise))

    setState(prev => {
      const currentActive = prev.rounds.find(r => r.status === 'ACTIVE')
      if (!currentActive) {
        return {
          ...prev,
          boardMoneyPaise: newFeePaise,
        }
      }

      const activeRoundId = currentActive.id

      // Separate ante transactions of active round from other transactions (bets, previous rounds)
      const anteTxs = prev.transactions.filter(
        t => t.roundId === activeRoundId && t.category === 'PLAYER_CONTRIBUTION' && t.notes?.includes('board fee')
      )
      const otherTxs = prev.transactions.filter(
        t => !(t.roundId === activeRoundId && t.category === 'PLAYER_CONTRIBUTION' && t.notes?.includes('board fee'))
      )

      // Recreate ante contributions with newFeePaise for only active players
      const activePlayers = prev.players.filter(p => p.isActive !== false)
      const now = currentActive.createdAt || Date.now()
      const updatedAnteTxs: Transaction[] = activePlayers.map((p, idx) =>
        createPlayerContributionTransaction({
          playerId: p.id,
          playerName: p.name,
          amountPaise: newFeePaise,
          roundId: activeRoundId,
          notes: `Round ${currentActive.roundNumber} board fee`,
          timestamp: now + idx,
        })
      )

      const updatedTxs = [...updatedAnteTxs.reverse(), ...otherTxs]

      // Verify that this adjustment does not cause a negative board balance (e.g. if payouts were already made)
      const newBoardBal = calculateBoardBalance(updatedTxs.flatMap(t => t.entries))
      if (newBoardBal < 0) {
        console.warn(`Cannot reduce board fee to ₹${(newFeePaise / 100).toFixed(0)}: active round payouts exceed this fee.`)
        return prev
      }

      const updatedRounds = prev.rounds.map(r =>
        r.id === activeRoundId ? { ...r, boardMoneyPaise: newFeePaise } : r
      )

      return {
        ...prev,
        boardMoneyPaise: newFeePaise,
        rounds: updatedRounds,
        transactions: updatedTxs,
        boardAllocationConfirmed: false,
      }
    })
  }

  const updateGameName = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setState(prev => ({ ...prev, gameName: trimmed }))
  }

  const addPlayer = (name: string): { player: Player; feePaise: number } => {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Player name cannot be empty')
    const id = `player_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const color = AVATAR_COLORS[state.players.length % AVATAR_COLORS.length]
    const newPlayer: Player = {
      id,
      name: trimmed,
      avatarColor: color,
      createdAt: Date.now(),
      isActive: true,
    }

    let addedFeePaise = 0

    setState(prev => {
      const currentActive = prev.rounds.find(r => r.status === 'ACTIVE')
      let newTxs = prev.transactions
      let updatedRounds = prev.rounds

      if (currentActive) {
        const fee = currentActive.boardMoneyPaise ?? prev.boardMoneyPaise ?? 1000
        if (fee > 0) {
          addedFeePaise = fee
          const feeTx = createPlayerContributionTransaction({
            playerId: newPlayer.id,
            playerName: newPlayer.name,
            amountPaise: fee,
            roundId: currentActive.id,
            notes: `Round ${currentActive.roundNumber} board fee`,
            timestamp: Date.now(),
          })
          newTxs = [feeTx, ...prev.transactions]
        }
        updatedRounds = prev.rounds.map(r =>
          r.id === currentActive.id
            ? {
                ...r,
                participatingPlayerIds: [...(r.participatingPlayerIds || prev.players.map(p => p.id)), newPlayer.id],
              }
            : r
        )
      }

      return {
        ...prev,
        players: [...prev.players, newPlayer],
        rounds: updatedRounds,
        transactions: newTxs,
        boardAllocationConfirmed: false,
      }
    })

    return { player: newPlayer, feePaise: addedFeePaise }
  }

  const updatePlayerName = (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setState(prev => ({
      ...prev,
      players: prev.players.map(p => (p.id === id ? { ...p, name: trimmed } : p)),
    }))
  }

  const togglePlayerActive = (playerId: string): { isRefunded: boolean; isAdded: boolean; feePaise: number; message: string } => {
    const targetPlayer = state.players.find(p => p.id === playerId)
    if (!targetPlayer) return { isRefunded: false, isAdded: false, feePaise: 0, message: 'Player not found' }

    const isCurrentlyActive = targetPlayer.isActive !== false
    const willBeActive = !isCurrentlyActive
    let isRefunded = false
    let isAdded = false
    let feePaise = 0
    let message = ''

    setState(prev => {
      const currentActive = prev.rounds.find(r => r.status === 'ACTIVE')
      let newTxs = prev.transactions
      let updatedRounds = prev.rounds

      if (!willBeActive) {
        // Player is stopping / sitting out
        if (currentActive) {
          // Check if this player has placed any bets in this round
          const hasBetInActiveRound = prev.transactions.some(
            t => t.roundId === currentActive.id &&
                 (t.category === 'BOARD_PAYOUT' ||
                  (t.category === 'PLAYER_CONTRIBUTION' && !t.notes?.includes('board fee'))) &&
                 t.entries.some(e => e.accountId === getPlayerAccountId(playerId))
          )

          if (!hasBetInActiveRound) {
            // Player has NOT bet in active round yet!
            // Refund their board fee contribution for this active round and deduct from pot
            const feeTx = prev.transactions.find(
              t => t.roundId === currentActive.id &&
                   t.category === 'PLAYER_CONTRIBUTION' &&
                   t.notes?.includes('board fee') &&
                   t.entries.some(e => e.accountId === getPlayerAccountId(playerId))
            )
            if (feeTx) {
              const feeAmount = feeTx.entries.find(e => e.accountId === getPlayerAccountId(playerId))?.amountPaise || 0
              const potNowPaise = calculateBoardBalance(prev.transactions.flatMap(t => t.entries))
              if (potNowPaise >= feeAmount) {
                feePaise = feeAmount
                isRefunded = true
                newTxs = prev.transactions.filter(t => t.id !== feeTx.id)
              }
            }
            updatedRounds = prev.rounds.map(r =>
              r.id === currentActive.id
                ? {
                    ...r,
                    participatingPlayerIds: (r.participatingPlayerIds || []).filter(pid => pid !== playerId),
                  }
                : r
            )
            message = isRefunded
              ? `${targetPlayer.name} is sitting out. Refunded ₹${(feePaise / 100).toFixed(0)} from active board pot.`
              : `${targetPlayer.name} is sitting out. Board fee already distributed - no refund due.`
          } else {
            message = `${targetPlayer.name} will sit out starting from next round.`
          }
        } else {
          message = `${targetPlayer.name} marked as sitting out.`
        }
      } else {
        // Player is rejoining / becoming active
        if (currentActive) {
          const hasFeeTx = prev.transactions.some(
            t => t.roundId === currentActive.id &&
                 t.category === 'PLAYER_CONTRIBUTION' &&
                 t.notes?.includes('board fee') &&
                 t.entries.some(e => e.accountId === getPlayerAccountId(playerId))
          )
          if (!hasFeeTx) {
            const fee = currentActive.boardMoneyPaise ?? prev.boardMoneyPaise ?? 1000
            if (fee > 0) {
              feePaise = fee
              isAdded = true
              const feeTx = createPlayerContributionTransaction({
                playerId,
                playerName: targetPlayer.name,
                amountPaise: fee,
                roundId: currentActive.id,
                notes: `Round ${currentActive.roundNumber} board fee`,
                timestamp: Date.now(),
              })
              newTxs = [feeTx, ...prev.transactions]
            }
            updatedRounds = prev.rounds.map(r =>
              r.id === currentActive.id
                ? {
                    ...r,
                    participatingPlayerIds: [...(r.participatingPlayerIds || []), playerId],
                  }
                : r
            )
          }
          message = `${targetPlayer.name} rejoined! Added ₹${(feePaise / 100).toFixed(0)} to active board pot.`
        } else {
          message = `${targetPlayer.name} rejoined the table.`
        }
      }

      const updatedPlayers = prev.players.map(p =>
        p.id === playerId ? { ...p, isActive: willBeActive } : p
      )

      return {
        ...prev,
        players: updatedPlayers,
        rounds: updatedRounds,
        transactions: newTxs,
        boardAllocationConfirmed: false,
      }
    })

    return { isRefunded, isAdded, feePaise, message }
  }

  const removePlayer = (id: string): { permanentlyRemoved: boolean; message: string } => {
    const target = state.players.find(p => p.id === id)
    if (!target) return { permanentlyRemoved: false, message: 'Player not found' }

    // Check if player has any transactions
    const hasHistory = state.transactions.some(t =>
      t.entries.some(e => e.accountId === getPlayerAccountId(id))
    )

    if (!hasHistory) {
      setState(prev => ({
        ...prev,
        players: prev.players.filter(p => p.id !== id),
      }))
      return {
        permanentlyRemoved: true,
        message: `${target.name} removed from the table.`,
      }
    } else {
      togglePlayerActive(id)
      return {
        permanentlyRemoved: false,
        message: `${target.name} has recorded bets or contributions and cannot be deleted. Marked as Sitting Out so the ledger stays balanced.`,
      }
    }
  }

  /**
   * CORE FEATURE: Declare a Bet against the remaining Board Money!
   * A player declares how much of the remaining board money they want to bet.
   * If WON: Player takes that bet amount from the board (Board decreases, Player increases).
   * If LOST: Player pays that bet amount to the board (Board increases, Player decreases).
   *
   * AUTOMATIC ROUND ADVANCEMENT:
   * If a winning bet claims the remaining board pot (pot drops to ₹0),
   * this round is automatically completed and the next round starts immediately
   * with new ante collected from all active players!
   */
  const recordBet = ({
    playerId,
    amountPaise,
    outcome,
    notes,
  }: {
    playerId: string
    amountPaise: number
    outcome: 'WON' | 'LOST'
    notes?: string
  }): { autoCompleted: boolean; nextRoundNumber?: number; celebrationMsg: string } => {
    if (amountPaise <= 0) {
      throw new Error('Bet amount must be greater than ₹0')
    }

    if (amountPaise > boardBalancePaise) {
      throw new Error(
        `Cannot bid or lose more than remaining board money (${(boardBalancePaise / 100).toFixed(0)} available)`
      )
    }

    const player = state.players.find(p => p.id === playerId)
    if (!player) throw new Error('Player not found')

    const effectiveRound = activeRound || {
      id: `round_${completedRoundsCount + 1}_${Date.now()}`,
      roundNumber: completedRoundsCount + 1,
      status: 'ACTIVE' as const,
      createdAt: Date.now(),
      boardMoneyPaise,
    }

    const roundId = effectiveRound.id
    const now = Date.now()

    if (outcome === 'WON') {
      const isPotCleared = boardBalancePaise - amountPaise === 0

      if (isPotCleared) {
        // Winning bet took all remaining board money -> AUTOMATICALLY complete round & advance to next!
        const payoutTx = createBoardPayoutTransaction({
          playerId,
          playerName: player.name,
          amountPaise,
          roundId,
          notes: notes || `Won remaining board pot of ₹${(amountPaise / 100).toFixed(0)}`,
          timestamp: now,
        })

        const completedCurrent: Round = {
          ...effectiveRound,
          status: 'COMPLETED',
          completedAt: now,
        }

        const nextRoundNumber = effectiveRound.roundNumber + 1
        const nextRoundId = `round_${nextRoundNumber}_${now}`
        const activePlayers = state.players.filter(p => p.isActive !== false)
        const nextActive: Round = {
          id: nextRoundId,
          roundNumber: nextRoundNumber,
          name: `Round ${nextRoundNumber}`,
          status: 'ACTIVE',
          createdAt: now + 1,
          boardMoneyPaise,
          participatingPlayerIds: activePlayers.map(p => p.id),
        }

        // Collect starting ante for next round from active players
        const anteTxs: Transaction[] = []
        if (boardMoneyPaise > 0 && activePlayers.length > 0) {
          for (let i = 0; i < activePlayers.length; i++) {
            const p = activePlayers[i]
            anteTxs.push(
              createPlayerContributionTransaction({
                playerId: p.id,
                playerName: p.name,
                amountPaise: boardMoneyPaise,
                roundId: nextRoundId,
                notes: `Round ${nextRoundNumber} board fee`,
                timestamp: now + 2 + i,
              })
            )
          }
        }

        setState(prev => {
          let currentTxs = [payoutTx, ...prev.transactions]
          for (const tx of anteTxs) {
            assertCanApplyTransaction(currentTxs, tx)
            currentTxs = [tx, ...currentTxs]
          }

          const updatedRounds = [
            ...prev.rounds.filter(r => r.id !== effectiveRound.id),
            completedCurrent,
            nextActive,
          ]

          return {
            ...prev,
            rounds: updatedRounds,
            transactions: currentTxs,
            boardAllocationConfirmed: false,
          }
        })

        const nextPotRupees = ((activePlayers.length * boardMoneyPaise) / 100).toFixed(0)
        return {
          autoCompleted: true,
          nextRoundNumber,
          celebrationMsg: `🏆 ${player.name} WON ₹${(amountPaise / 100).toFixed(0)} and cleared the pot! Round #${effectiveRound.roundNumber} completed. Round #${nextRoundNumber} automatically started with fresh ₹${nextPotRupees} pot!`,
        }
      } else {
        // Normal partial win: deduct from board
        const tx = createBoardPayoutTransaction({
          playerId,
          playerName: player.name,
          amountPaise,
          roundId,
          notes: notes || `Won bet of ₹${(amountPaise / 100).toFixed(0)} from board`,
          timestamp: now,
        })
        commitTransaction(tx)
        const remRupees = ((boardBalancePaise - amountPaise) / 100).toFixed(0)
        return {
          autoCompleted: false,
          celebrationMsg: `🎉 ${player.name} WON bet of ₹${(amountPaise / 100).toFixed(0)}! ₹${remRupees} remaining in pot.`,
        }
      }
    } else {
      // Player lost the bet: pays amount into the board
      const tx = createPlayerContributionTransaction({
        playerId,
        playerName: player.name,
        amountPaise,
        roundId,
        notes: notes || `Lost bet of ₹${(amountPaise / 100).toFixed(0)} paid to board`,
        timestamp: now,
      })
      commitTransaction(tx)
      const newPotRupees = ((boardBalancePaise + amountPaise) / 100).toFixed(0)
      return {
        autoCompleted: false,
        celebrationMsg: `💥 ${player.name} LOST bet of ₹${(amountPaise / 100).toFixed(0)}! Added to pot (now ₹${newPotRupees}).`,
      }
    }
  }

  /**
   * Collects board fee from players for the current round
   */
  const collectRoundBoardFee = (participatingPlayerIds?: string[], customFeePaise?: number) => {
    const fee = customFeePaise !== undefined ? customFeePaise : boardMoneyPaise
    const participants = participatingPlayerIds && participatingPlayerIds.length > 0
      ? participatingPlayerIds
      : state.players.filter(p => p.isActive !== false).map(p => p.id)

    if (fee <= 0 || participants.length === 0) return

    const roundNum = activeRound?.roundNumber || (completedRoundsCount + 1)
    const roundId = activeRound?.id || `round_${roundNum}_${Date.now()}`
    const now = Date.now()

    const newTxs: Transaction[] = []
    for (const pid of participants) {
      const player = state.players.find(p => p.id === pid)
      newTxs.push(createPlayerContributionTransaction({
        playerId: pid,
        playerName: player?.name,
        amountPaise: fee,
        roundId,
        notes: `Round ${roundNum} board fee`,
        timestamp: now,
      }))
    }

    setState(prev => {
      let currentTxs = [...prev.transactions]
      for (const tx of newTxs) {
        assertCanApplyTransaction(currentTxs, tx)
        currentTxs = [tx, ...currentTxs]
      }
      const hasActive = prev.rounds.some(r => r.status === 'ACTIVE')
      const rounds = hasActive
        ? prev.rounds
        : [...prev.rounds, { id: roundId, roundNumber: roundNum, status: 'ACTIVE' as const, createdAt: now, boardMoneyPaise: fee }]

      return {
        ...prev,
        rounds,
        transactions: currentTxs,
        boardAllocationConfirmed: false,
      }
    })
  }

  /**
   * Finishes the current round, rolls over remaining board money,
   * starts next round, and collects new board fees automatically.
   */
  const finishRoundAndStartNext = (options?: { autoCollectNextAnte?: boolean }) => {
    const currentActive = activeRound || {
      id: `round_${completedRoundsCount + 1}_${Date.now()}`,
      roundNumber: completedRoundsCount + 1,
      status: 'ACTIVE' as const,
      createdAt: Date.now(),
    }

    const nextRoundNumber = currentActive.roundNumber + 1
    const nextRoundId = `round_${nextRoundNumber}_${Date.now()}`
    const now = Date.now()

    const completedCurrent: Round = {
      ...currentActive,
      status: 'COMPLETED',
      completedAt: now,
    }

    const activePlayers = state.players.filter(p => p.isActive !== false)
    const nextActive: Round = {
      id: nextRoundId,
      roundNumber: nextRoundNumber,
      name: `Round ${nextRoundNumber}`,
      status: 'ACTIVE',
      createdAt: now,
      boardMoneyPaise,
      participatingPlayerIds: activePlayers.map(p => p.id),
    }

    // Automatically collect next round's board fee if requested (default true) from active players
    const shouldCollect = options?.autoCollectNextAnte !== false && boardMoneyPaise > 0 && activePlayers.length > 0
    const anteTxs: Transaction[] = []

    if (shouldCollect) {
      for (const p of activePlayers) {
        anteTxs.push(createPlayerContributionTransaction({
          playerId: p.id,
          playerName: p.name,
          amountPaise: boardMoneyPaise,
          roundId: nextRoundId,
          notes: `Round ${nextRoundNumber} board fee`,
          timestamp: now + 1,
        }))
      }
    }

    setState(prev => {
      let currentTxs = [...prev.transactions]
      for (const tx of anteTxs) {
        assertCanApplyTransaction(currentTxs, tx)
        currentTxs = [tx, ...currentTxs]
      }

      const updatedRounds = [
        ...prev.rounds.filter(r => r.id !== currentActive.id),
        completedCurrent,
        nextActive,
      ]

      return {
        ...prev,
        rounds: updatedRounds,
        transactions: currentTxs,
        boardAllocationConfirmed: false,
      }
    })
  }

  const undoLastBet = (): { undone: boolean; message: string } => {
    const currentActive = activeRound || state.rounds[state.rounds.length - 1]
    if (!currentActive) return { undone: false, message: 'No active round found' }

    // Find the most recent bet transaction in the current active round
    const betTx = state.transactions.find(
      t => t.roundId === currentActive.id &&
           (t.category === 'BOARD_PAYOUT' ||
            (t.category === 'PLAYER_CONTRIBUTION' && (t.notes || '').toLowerCase().includes('lost bet')))
    )

    if (!betTx) {
      return { undone: false, message: 'No bets in the current round to undo' }
    }

    setState(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => t.id !== betTx.id),
      boardAllocationConfirmed: false,
    }))

    return { undone: true, message: `Reverted last bet: ${betTx.notes || betTx.description}` }
  }

  const undoLastAction = () => {
    if (state.transactions.length === 0) return
    const lastTx = state.transactions[0]
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => t.id !== lastTx.id),
      boardAllocationConfirmed: false,
    }))
  }

  /**
   * CANCEL CURRENT ROUND (Consecutive numbers drawn, misdeal, or host void):
   * Reverses/cancels all bets and transactions made in this active round.
   * Restores everyone's balances and the board balance to before this round.
   * Marks round as CANCELLED in history, and restarts Round with starting ante.
   */
  const cancelCurrentRound = (reason?: string) => {
    const currentActive = activeRound || state.rounds[state.rounds.length - 1]
    if (!currentActive) return

    const roundId = currentActive.id
    const roundNum = currentActive.roundNumber
    const reasonText = reason || 'Current round cancelled by host. All bets voided.'

    // 1. Remove all transactions of this round
    const updatedTransactions = state.transactions.filter(t => t.roundId !== roundId)

    // 2. Mark this round as CANCELLED in state.rounds
    const updatedRounds = state.rounds.map(r =>
      r.id === roundId
        ? {
            ...r,
            status: 'CANCELLED' as const,
            completedAt: Date.now(),
            notes: reasonText,
            cancellationReason: reasonText,
          }
        : r
    )

    // 3. Immediately setup a fresh active round for replay
    const freshRoundId = `round_${roundNum}_restarted_${Date.now()}`
    const activePlayers = state.players.filter(p => p.isActive !== false)
    const freshRound: Round = {
      id: freshRoundId,
      roundNumber: roundNum,
      name: `Round ${roundNum} (Replay)`,
      status: 'ACTIVE',
      createdAt: Date.now(),
      boardMoneyPaise,
      participatingPlayerIds: activePlayers.map(p => p.id),
    }

    // 4. Collect starting ante for restarted round from active players
    const anteTxs: Transaction[] = []
    if (boardMoneyPaise > 0 && activePlayers.length > 0) {
      for (let i = 0; i < activePlayers.length; i++) {
        const p = activePlayers[i]
        anteTxs.push(
          createPlayerContributionTransaction({
            playerId: p.id,
            playerName: p.name,
            amountPaise: boardMoneyPaise,
            roundId: freshRoundId,
            notes: `Round ${roundNum} board fee`,
            timestamp: Date.now() + i,
          })
        )
      }
    }

    setState(prev => {
      let finalTxs = [...updatedTransactions]
      for (const tx of anteTxs) {
        assertCanApplyTransaction(finalTxs, tx)
        finalTxs = [tx, ...finalTxs]
      }

      return {
        ...prev,
        rounds: [...updatedRounds, freshRound],
        transactions: finalTxs,
        boardAllocationConfirmed: false,
      }
    })
  }

  /**
   * CANCEL PREVIOUS ROUND:
   * Finds the last completed round, voids all its payouts and bets,
   * restores player and board balances, and marks it as CANCELLED in history.
   */
  const cancelPreviousRound = (reason?: string) => {
    const compRounds = state.rounds.filter(r => r.status === 'COMPLETED')
    if (compRounds.length === 0) {
      throw new Error('No completed previous round to cancel.')
    }

    const prevRound = compRounds[compRounds.length - 1]
    const prevRoundId = prevRound.id
    const prevRoundNum = prevRound.roundNumber
    const reasonText = reason || `Previous Round #${prevRoundNum} cancelled & voided.`

    // Validate that removing prevRound's transactions doesn't create a negative board balance
    const remainingTransactions = state.transactions.filter(t => t.roundId !== prevRoundId)
    const newBoardBal = calculateBoardBalance(remainingTransactions.flatMap(t => t.entries))
    if (newBoardBal < 0) {
      throw new Error(
        `Cannot cancel Round #${prevRoundNum}: un-won funds rolled over into the current round and were already won. Please cancel the current round first.`
      )
    }

    const updatedRounds = state.rounds.map(r =>
      r.id === prevRoundId
        ? {
            ...r,
            status: 'CANCELLED' as const,
            cancellationReason: reasonText,
            notes: reasonText,
          }
        : r
    )

    setState(prev => ({
      ...prev,
      rounds: updatedRounds,
      transactions: remainingTransactions,
      boardAllocationConfirmed: false,
    }))
  }

  const cancelCurrentRoundConsecutive = (reason?: string) => {
    cancelCurrentRound(reason || 'Consecutive cards/numbers shown (e.g. 61, 62). Entire round cancelled.')
  }

  const playRound = ({
    winnerPlayerIds,
    participatingPlayerIds,
    boardMoneyPaise: roundBoardMoney,
    customPotPaise,
    notes,
    roundName,
  }: {
    winnerPlayerIds: string[]
    participatingPlayerIds?: string[]
    boardMoneyPaise?: number
    customPotPaise?: number
    notes?: string
    roundName?: string
  }) => {
    if (winnerPlayerIds.length === 0) {
      throw new Error('Please select at least one round winner')
    }

    const effectiveBoardMoney = roundBoardMoney !== undefined ? roundBoardMoney : boardMoneyPaise
    const effectiveParticipants = participatingPlayerIds && participatingPlayerIds.length > 0
      ? participatingPlayerIds
      : state.players.map(p => p.id)

    if (effectiveParticipants.length === 0) {
      throw new Error('No players participating in this round')
    }

    const roundNum = state.rounds.filter(r => r.status === 'COMPLETED').length + 1
    const roundId = `round_${roundNum}_${Date.now()}`
    const now = Date.now()

    const totalCollectedPaise = effectiveParticipants.length * effectiveBoardMoney
    const potPaise = customPotPaise !== undefined ? customPotPaise : totalCollectedPaise

    const newTxs: Transaction[] = []

    if (effectiveBoardMoney > 0) {
      for (const pid of effectiveParticipants) {
        const player = state.players.find(p => p.id === pid)
        const tx = createPlayerContributionTransaction({
          playerId: pid,
          playerName: player?.name,
          amountPaise: effectiveBoardMoney,
          roundId,
          notes: notes || `Round ${roundNum} board money contribution`,
          timestamp: now,
        })
        newTxs.push(tx)
      }
    }

    if (potPaise > 0) {
      const baseWinnerShare = Math.floor(potPaise / winnerPlayerIds.length)
      const remainder = potPaise % winnerPlayerIds.length

      for (let i = 0; i < winnerPlayerIds.length; i++) {
        const wid = winnerPlayerIds[i]
        const winnerPlayer = state.players.find(p => p.id === wid)
        const winAmount = baseWinnerShare + (i === 0 ? remainder : 0)
        if (winAmount > 0) {
          const tx = createBoardPayoutTransaction({
            playerId: wid,
            playerName: winnerPlayer?.name,
            amountPaise: winAmount,
            roundId,
            notes: `Won Round ${roundNum} pot`,
            timestamp: now + 1 + i,
          })
          newTxs.push(tx)
        }
      }
    }

    const completedRound: Round = {
      id: roundId,
      roundNumber: roundNum,
      name: roundName || `Round ${roundNum}`,
      status: 'COMPLETED',
      createdAt: now,
      completedAt: now,
      notes,
      winnerPlayerIds,
      boardMoneyPaise: effectiveBoardMoney,
      totalPotPaise: potPaise,
      participatingPlayerIds: effectiveParticipants,
    }

    setState(prev => {
      let currentTxs = [...prev.transactions]
      for (const tx of newTxs) {
        assertCanApplyTransaction(currentTxs, tx)
        currentTxs = [tx, ...currentTxs]
      }
      return {
        ...prev,
        rounds: [...prev.rounds.filter(r => r.status === 'COMPLETED'), completedRound],
        transactions: currentTxs,
        boardAllocationConfirmed: false,
      }
    })
  }

  const undoRound = (roundId: string) => {
    const targetRound = state.rounds.find(r => r.id === roundId)
    if (!targetRound) return

    // Ensure removing this round's transactions does not result in negative board balance
    const remainingTransactions = state.transactions.filter(t => t.roundId !== roundId)
    const newBoardBal = calculateBoardBalance(remainingTransactions.flatMap(t => t.entries))
    if (newBoardBal < 0) {
      throw new Error(
        `Cannot undo Round #${targetRound.roundNumber}: funds from this round were rolled over and won in subsequent rounds.`
      )
    }

    setState(prev => {
      const updatedRounds = prev.rounds.filter(r => r.id !== roundId)
      let counter = 1
      const reindexedRounds = updatedRounds.map(r => ({
        ...r,
        roundNumber: counter++,
      }))
      return {
        ...prev,
        rounds: reindexedRounds,
        transactions: remainingTransactions,
        boardAllocationConfirmed: false,
      }
    })
  }

  const undoLastRound = () => {
    const compRounds = state.rounds.filter(r => r.status === 'COMPLETED')
    if (compRounds.length === 0) return
    const lastRound = compRounds[compRounds.length - 1]
    undoRound(lastRound.id)
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

  /**
   * Undo/delete a single transaction from the ledger.
   * Directly removes this exact transaction and recalculates all balances.
   */
  const reverseTransaction = (txId: string, _reason?: string) => {
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => t.id !== txId),
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

  /**
   * Toggles a settlement transfer between debtor and creditor.
   * When marked as PAID: Records a debt settlement payment transaction,
   * directly bringing both players' balances toward ₹0.
   * When untoggled: Removes the settlement transaction, restoring prior balances.
   */
  const toggleSettlementTransfer = (transferId: string) => {
    setState(prev => {
      const existingTx = prev.transactions.find(
        t => t.metadata?.transferId === transferId && t.category === 'BOARD_SETTLEMENT_ALLOCATION'
      )

      if (existingTx) {
        // Toggle OFF: Remove the settlement payment transaction & mark transfer as incomplete
        const remainingTxs = prev.transactions.filter(t => t.id !== existingTx.id)
        const updatedTransfers = prev.settlementTransfers.filter(t => t.id !== transferId)
        return {
          ...prev,
          transactions: remainingTxs,
          settlementTransfers: updatedTransfers,
        }
      } else {
        // Toggle ON: Create the settlement payment transaction to bring both balances toward ₹0!
        const planTransfer = settlementPlan.transfers.find(t => t.id === transferId)
        if (!planTransfer) return prev

        const fromP = prev.players.find(p => p.id === planTransfer.fromPlayerId)
        const toP = prev.players.find(p => p.id === planTransfer.toPlayerId)

        const settleTx = createSettlementPaymentTransaction({
          fromPlayerId: planTransfer.fromPlayerId,
          toPlayerId: planTransfer.toPlayerId,
          fromPlayerName: fromP?.name,
          toPlayerName: toP?.name,
          amountPaise: planTransfer.amountPaise,
          transferId: planTransfer.id,
          notes: `Settlement payment: ${fromP?.name} paid ${toP?.name}`,
          timestamp: Date.now(),
        })

        return {
          ...prev,
          transactions: [settleTx, ...prev.transactions],
          settlementTransfers: [
            ...prev.settlementTransfers.filter(t => t.id !== transferId),
            { ...planTransfer, completed: true, completedAt: Date.now() },
          ],
        }
      }
    })
  }

  /**
   * Settles all peer-to-peer transfers at once, zeroing out every player's balance!
   */
  const settleAllAndCloseGame = () => {
    setState(prev => {
      const pendingTransfers = settlementPlan.transfers.filter(
        planT => !prev.transactions.some(t => t.metadata?.transferId === planT.id)
      )

      const newTxs: Transaction[] = []
      const newTransfers: SettlementTransfer[] = []
      const now = Date.now()

      for (let i = 0; i < pendingTransfers.length; i++) {
        const t = pendingTransfers[i]
        const fromP = prev.players.find(p => p.id === t.fromPlayerId)
        const toP = prev.players.find(p => p.id === t.toPlayerId)

        newTxs.push(
          createSettlementPaymentTransaction({
            fromPlayerId: t.fromPlayerId,
            toPlayerId: t.toPlayerId,
            fromPlayerName: fromP?.name,
            toPlayerName: toP?.name,
            amountPaise: t.amountPaise,
            transferId: t.id,
            notes: `Settlement payment: ${fromP?.name} paid ${toP?.name}`,
            timestamp: now + i,
          })
        )
        newTransfers.push({ ...t, completed: true, completedAt: now + i })
      }

      return {
        ...prev,
        transactions: [...newTxs.reverse(), ...prev.transactions],
        settlementTransfers: [
          ...prev.settlementTransfers.filter(st => !pendingTransfers.some(pt => pt.id === st.id)),
          ...newTransfers,
        ],
        boardAllocationConfirmed: true,
      }
    })
  }

  /**
   * Completes the entire game session:
   * Removes the active round's pot/ante that was automatically collected from all players,
   * leaves completed rounds intact, confirms board allocation, and navigates straight to
   * Final Settlement to display who pays whom.
   */
  const completeGameAndSettle = () => {
    setState(prev => {
      const activeRound = prev.rounds.find(r => r.status === 'ACTIVE')
      let newTxs = prev.transactions
      let newRounds = prev.rounds

      if (activeRound) {
        // Check if activeRound had any actual bets placed (BOARD_PAYOUT or bet loss)
        const hasBetActivity = prev.transactions.some(
          t => t.roundId === activeRound.id &&
               (t.category === 'BOARD_PAYOUT' ||
                (t.category === 'PLAYER_CONTRIBUTION' && !t.notes?.includes('board fee')))
        )

        if (!hasBetActivity) {
          // No bets were placed: void unplayed round fees so players are not charged
          newTxs = prev.transactions.filter(t => t.roundId !== activeRound.id)
          newRounds = prev.rounds.filter(r => r.id !== activeRound.id)
        } else {
          // Bets were placed: keep round & transactions, and mark round as COMPLETED!
          newRounds = prev.rounds.map(r =>
            r.id === activeRound.id
              ? { ...r, status: 'COMPLETED' as const, completedAt: Date.now() }
              : r
          )
        }
      }

      return {
        ...prev,
        transactions: newTxs,
        rounds: newRounds,
        boardAllocationConfirmed: true,
      }
    })
    setCurrentTab('settlement')
  }

  const resetGame = (newGameName?: string, defaultBoardMoneyPaise?: number) => {
    const fee = defaultBoardMoneyPaise || 1000
    const players: Player[] = [
      { id: 'p_sunny', name: 'Sunny', avatarColor: AVATAR_COLORS[0], createdAt: Date.now(), isActive: true },
      { id: 'p_bunny', name: 'Bunny', avatarColor: AVATAR_COLORS[1], createdAt: Date.now(), isActive: true },
      { id: 'p_deepu', name: 'Deepu', avatarColor: AVATAR_COLORS[2], createdAt: Date.now(), isActive: true },
      { id: 'p_spanny', name: 'Spanny', avatarColor: AVATAR_COLORS[3], createdAt: Date.now(), isActive: true },
    ]

    const round1: Round = {
      id: 'round_1',
      roundNumber: 1,
      name: 'Round 1',
      status: 'ACTIVE',
      createdAt: Date.now(),
      boardMoneyPaise: fee,
      participatingPlayerIds: players.map(p => p.id),
    }

    const initialTxs: Transaction[] = players.map((p, idx) =>
      createPlayerContributionTransaction({
        playerId: p.id,
        playerName: p.name,
        amountPaise: fee,
        roundId: 'round_1',
        notes: 'Round 1 board fee',
        timestamp: Date.now() + idx,
      })
    )

    setState({
      gameName: newGameName || 'Game Night Ledger',
      createdAt: Date.now(),
      boardMoneyPaise: fee,
      players,
      rounds: [round1],
      transactions: initialTxs.reverse(),
      settlementTransfers: [],
      boardAllocationConfirmed: false,
    })
  }

  const loadDemoGame = () => {
    const p1: Player = { id: 'p1', name: 'Sunny', avatarColor: AVATAR_COLORS[0], createdAt: 1000, isActive: true }
    const p2: Player = { id: 'p2', name: 'Bunny', avatarColor: AVATAR_COLORS[1], createdAt: 1000, isActive: true }
    const p3: Player = { id: 'p3', name: 'Deepu', avatarColor: AVATAR_COLORS[2], createdAt: 1000, isActive: true }
    const p4: Player = { id: 'p4', name: 'Spanny', avatarColor: AVATAR_COLORS[3], createdAt: 1000, isActive: true }
    const players = [p1, p2, p3, p4]

    const fee = 10000 // ₹100 per round

    // Round 1 (Completed):
    // 4 players put ₹100 (Board ₹400).
    // Bunny bets ₹200 and WINS -> takes ₹200 (Board remaining: ₹200).
    const r1: Round = {
      id: 'demo_r1',
      roundNumber: 1,
      name: 'Round 1',
      status: 'COMPLETED',
      createdAt: 1000,
      completedAt: 1500,
      boardMoneyPaise: fee,
      participatingPlayerIds: players.map(p => p.id),
    }

    // Round 2 (Completed):
    // Board starts with ₹200. 4 players put ₹100 -> Board becomes ₹600.
    // Sunny bets ₹300 and WINS -> takes ₹300 (Board remaining: ₹300).
    // Spanny bets ₹150 and LOSES -> pays ₹150 (Board remaining: ₹450).
    const r2: Round = {
      id: 'demo_r2',
      roundNumber: 2,
      name: 'Round 2',
      status: 'COMPLETED',
      createdAt: 2000,
      completedAt: 2500,
      boardMoneyPaise: fee,
      participatingPlayerIds: players.map(p => p.id),
    }

    // Round 3 (Active!):
    // Board carried over ₹450 + 4 players put ₹100 -> Board has ₹850 right now!
    const r3: Round = {
      id: 'demo_r3',
      roundNumber: 3,
      name: 'Round 3',
      status: 'ACTIVE',
      createdAt: 3000,
      boardMoneyPaise: fee,
      participatingPlayerIds: players.map(p => p.id),
    }

    const txs: Transaction[] = []
    let t = 1000

    // Round 1 Ante
    for (const p of players) {
      txs.push(createPlayerContributionTransaction({ playerId: p.id, playerName: p.name, amountPaise: fee, roundId: 'demo_r1', timestamp: t++ }))
    }
    // Bunny bets ₹200 and WINS
    txs.push(createBoardPayoutTransaction({ playerId: 'p2', playerName: 'Bunny', amountPaise: 20000, roundId: 'demo_r1', notes: 'Won bet of ₹200 from board', timestamp: t++ }))

    // Round 2 Ante
    for (const p of players) {
      txs.push(createPlayerContributionTransaction({ playerId: p.id, playerName: p.name, amountPaise: fee, roundId: 'demo_r2', timestamp: t++ }))
    }
    // Sunny bets ₹300 and WINS
    txs.push(createBoardPayoutTransaction({ playerId: 'p1', playerName: 'Sunny', amountPaise: 30000, roundId: 'demo_r2', notes: 'Won bet of ₹300 from board', timestamp: t++ }))
    // Spanny bets ₹150 and LOSES
    txs.push(createPlayerContributionTransaction({ playerId: 'p4', playerName: 'Spanny', amountPaise: 15000, roundId: 'demo_r2', notes: 'Lost bet of ₹150 paid to board', timestamp: t++ }))

    // Round 3 Ante (Active round)
    for (const p of players) {
      txs.push(createPlayerContributionTransaction({ playerId: p.id, playerName: p.name, amountPaise: fee, roundId: 'demo_r3', timestamp: t++ }))
    }

    setState({
      gameName: 'Saturday Board Night (Demo)',
      createdAt: 1000,
      boardMoneyPaise: fee,
      players,
      rounds: [r1, r2, r3],
      transactions: txs.reverse(),
      settlementTransfers: [],
      boardAllocationConfirmed: false,
    })
  }

  return (
    <GameContext.Provider
      value={{
        state,
        startedWithSavedGame,
        overview,
        playerSummaries,
        boardBalancePaise,
        settlementPlan,
        activeRound,
        completedRounds,
        completedRoundsCount,
        lastCompletedRound,
        boardMoneyPaise,
        setBoardMoneyPaise,
        currentTab,
        setCurrentTab,
        addPlayer,
        updatePlayerName,
        removePlayer,
        togglePlayerActive,
        recordBet,
        cancelCurrentRound,
        cancelPreviousRound,
        cancelCurrentRoundConsecutive,
        collectRoundBoardFee,
        finishRoundAndStartNext,
        undoLastBet,
        undoLastAction,
        playRound,
        undoRound,
        undoLastRound,
        createRound,
        completeRound,
        updateGameName,
        recordInitialFunding,
        recordExternalDeposit,
        recordExternalWithdrawal,
        recordContribution,
        recordPayout,
        recordPlayerTransfer,
        reverseTransaction,
        resolveBoardAllocation,
        toggleSettlementTransfer,
        settleAllAndCloseGame,
        completeGameAndSettle,
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
