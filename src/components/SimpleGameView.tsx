import React, { useState } from 'react'
import { useGame } from '../context/GameContext'
import { formatPaise, parseRupeesToPaise } from '../utils/money'
import {
  Users,
  Coins,
  Trophy,
  Play,
  RotateCcw,
  CheckCircle2,
  Plus,
  Trash2,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Info,
  Share2,
  Check,
  Percent,
  Flame,
  AlertCircle,
  HelpCircle,
  Ban,
  ArrowUpRight,
  Zap,
  Terminal,
  ShieldCheck,
  Pause,
  Undo2,
  ChevronDown,
  ChevronUp,
  Settings2,
  X,
} from 'lucide-react'

// Coins Ledger Presets starting from ₹2, ₹5, ₹10, ₹20, ₹50, ₹100
const BOARD_FEE_PRESETS = [2, 5, 10, 20, 50, 100]

export const SimpleGameView: React.FC = () => {
  const {
    state,
    startedWithSavedGame,
    completedRounds,
    completedRoundsCount,
    lastCompletedRound,
    boardMoneyPaise,
    boardBalancePaise,
    setBoardMoneyPaise,
    addPlayer,
    removePlayer,
    togglePlayerActive,
    recordBet,
    finishRoundAndStartNext,
    undoLastBet,
    undoLastAction,
    cancelCurrentRound,
    cancelPreviousRound,
    cancelCurrentRoundConsecutive,
    playerSummaries,
    settlementPlan,
    setCurrentTab,
    toggleSettlementTransfer,
    activeRound,
    completeGameAndSettle,
    createRound,
    loadDemoGame,
  } = useGame()

  // Step 1: Add player state
  const [newPlayerName, setNewPlayerName] = useState('')
  const [playerInputError, setPlayerInputError] = useState<string | null>(null)

  // Step 2: Board stake input
  const [customStakeRupees, setCustomStakeRupees] = useState<string>(
    (boardMoneyPaise / 100).toString()
  )

  // Step 3: Betting state
  const [bettingPlayerId, setBettingPlayerId] = useState<string>(state.players[0]?.id || '')
  const [betAmountRupees, setBetAmountRupees] = useState<string>(
    boardBalancePaise > 0
      ? Math.min(50, Math.max(1, Math.floor(boardBalancePaise / 200))).toString()
      : '0'
  )
  const [betActionError, setBetActionError] = useState<string | null>(null)
  const [celebrationMsg, setCelebrationMsg] = useState<string | null>(null)

  // Complete Game Modal state
  const [showCompleteGameModal, setShowCompleteGameModal] = useState(false)

  // Cancel Current Round Modal state
  const [showCancelCurrentModal, setShowCancelCurrentModal] = useState(false)
  const [cancelCurrentReasonType, setCancelCurrentReasonType] = useState<'CONSECUTIVE' | 'GENERAL'>('CONSECUTIVE')
  const [consecutiveNumbersText, setConsecutiveNumbersText] = useState('61, 62')
  const [cancelCurrentCustomText, setCancelCurrentCustomText] = useState('')

  // Cancel Previous Round Modal state
  const [showCancelPrevModal, setShowCancelPrevModal] = useState(false)
  const [cancelPrevReasonText, setCancelPrevReasonText] = useState('')

  // WhatsApp share copy state
  const [copiedShareText, setCopiedShareText] = useState(false)

  const players = state.players
  const activePlayers = players.filter(p => p.isActive !== false)
  const inactivePlayers = players.filter(p => p.isActive === false)
  const activeCount = activePlayers.length
  const currentRoundNum = activeRound?.roundNumber || (completedRoundsCount + 1)
  const currentBoardRupees = Math.max(0, Math.floor(boardBalancePaise / 100))
  const isGameSettled = !activeRound && completedRoundsCount > 0
  const isBettingDisabled = boardBalancePaise <= 0 || !activeRound || currentBoardRupees <= 0 || activeCount === 0

  // Keep betting player aligned with active players
  React.useEffect(() => {
    if (activePlayers.length > 0 && !activePlayers.some(p => p.id === bettingPlayerId)) {
      setBettingPlayerId(activePlayers[0].id)
    }
  }, [activePlayers, bettingPlayerId])

  // Dynamic betting preset amounts & active state detection
  const currentBetNum = parseInt(betAmountRupees) || 0
  const preset25 = Math.max(1, Math.floor((currentBoardRupees * 25) / 100))
  const preset50 = Math.max(1, Math.floor((currentBoardRupees * 50) / 100))
  const preset75 = Math.max(1, Math.floor((currentBoardRupees * 75) / 100))
  const preset100 = currentBoardRupees

  const is25Selected = !isBettingDisabled && currentBoardRupees > 0 && currentBetNum === preset25 && preset25 !== preset50
  const is50Selected = !isBettingDisabled && currentBoardRupees > 0 && currentBetNum === preset50 && (preset50 !== preset100 || currentBoardRupees > 1)
  const is75Selected = !isBettingDisabled && currentBoardRupees > 0 && currentBetNum === preset75 && preset75 !== preset50 && preset75 !== preset100
  const is100Selected = !isBettingDisabled && currentBoardRupees > 0 && currentBetNum === preset100

  // Automatically reset bet amount when game is settled or pot is zero
  React.useEffect(() => {
    if (boardBalancePaise <= 0 || !activeRound) {
      setBetAmountRupees('0')
    } else {
      const cur = parseInt(betAmountRupees) || 0
      const maxRupees = Math.floor(boardBalancePaise / 100)
      if (cur <= 0 || cur > maxRupees) {
        setBetAmountRupees(
          Math.min(50, Math.max(1, Math.floor(boardBalancePaise / 200))).toString()
        )
      }
    }
  }, [boardBalancePaise, activeRound])

  // Handlers for Step 1: Add Player
  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault()
    setPlayerInputError(null)
    const trimmed = newPlayerName.trim()
    if (!trimmed) {
      setPlayerInputError('Please enter a player name')
      return
    }
    if (players.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setPlayerInputError(`Player "${trimmed}" already exists`)
      return
    }
    const result = addPlayer(trimmed)
    setNewPlayerName('')
    if (result.feePaise > 0) {
      setCelebrationMsg(`🎉 ${trimmed} joined the game! Added ₹${(result.feePaise / 100).toFixed(0)} to the active board pot.`)
    } else {
      setCelebrationMsg(`🎉 ${trimmed} joined the table!`)
    }
    setTimeout(() => setCelebrationMsg(null), 3500)
  }

  const handleToggleActive = (playerId: string) => {
    setBetActionError(null)
    const result = togglePlayerActive(playerId)
    setCelebrationMsg(result.message)
    setTimeout(() => setCelebrationMsg(null), 4000)
  }

  const handleRemovePlayer = (playerId: string) => {
    setBetActionError(null)
    const result = removePlayer(playerId)
    setCelebrationMsg(result.message)
    setTimeout(() => setCelebrationMsg(null), 4000)
  }

  const handleUndoLastBet = () => {
    setBetActionError(null)
    const result = undoLastBet()
    if (result.undone) {
      setCelebrationMsg(`⏪ ${result.message}`)
      setTimeout(() => setCelebrationMsg(null), 3500)
    } else {
      setBetActionError(result.message)
    }
  }

  // Handlers for Step 2: Board Stake Change
  // When fee is changed in between, pot value is immediately updated!
  const handleSelectStakePreset = (rupees: number) => {
    setBetActionError(null)
    try {
      const paise = rupees * 100
      setBoardMoneyPaise(paise)
      setCustomStakeRupees(rupees.toString())
      setCelebrationMsg(`💰 Round fee set to ₹${rupees}/player. Active pot updated in real-time!`)
      setTimeout(() => setCelebrationMsg(null), 3500)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setBetActionError(err.message)
      }
    }
  }

  const handleCustomStakeChange = (val: string) => {
    setCustomStakeRupees(val)
    setBetActionError(null)
    const parsed = parseRupeesToPaise(val)
    if (parsed >= 0) {
      try {
        setBoardMoneyPaise(parsed)
      } catch (err: unknown) {
        if (err instanceof Error) {
          setBetActionError(err.message)
        }
      }
    }
  }

  // Handlers for Step 3: Betting Presets
  const handleSetBetPercentage = (pct: number) => {
    if (currentBoardRupees <= 0 || isBettingDisabled) return
    setBetActionError(null)
    const calculated = pct === 100
      ? currentBoardRupees
      : Math.max(1, Math.floor((currentBoardRupees * pct) / 100))
    setBetAmountRupees(calculated.toString())
  }

  // Execute Bet (WIN or LOSE) with Automatic Round Completion!
  const handleExecuteBet = (outcome: 'WON' | 'LOST') => {
    setBetActionError(null)
    const player = players.find(p => p.id === bettingPlayerId)
    if (!player) {
      setBetActionError('Please select a betting player')
      return
    }

    const amountPaise = parseRupeesToPaise(betAmountRupees)
    if (amountPaise <= 0) {
      setBetActionError('Bet amount must be greater than ₹0')
      return
    }

    if (amountPaise > boardBalancePaise) {
      setBetActionError(
        `Cannot bid or lose more than the remaining board pot (${formatPaise(boardBalancePaise)} remaining)`
      )
      return
    }

    try {
      const result = recordBet({
        playerId: bettingPlayerId,
        amountPaise,
        outcome,
      })

      setCelebrationMsg(result.celebrationMsg)
      setTimeout(() => setCelebrationMsg(null), 5000)

      if (result.autoCompleted) {
        // Round automatically completed because pot was cleared!
        // Reset default bet for the new round's starting pot
        const newPotPaise = activeCount * boardMoneyPaise
        const defaultBet = Math.max(1, Math.min(50, Math.floor(newPotPaise / 200)))
        setBetAmountRupees(defaultBet.toString())
      } else {
        // Adjust default bet for next turn
        const newRemainingPaise = outcome === 'WON' ? boardBalancePaise - amountPaise : boardBalancePaise + amountPaise
        const newRemainingRupees = Math.max(0, Math.floor(newRemainingPaise / 100))
        if (newRemainingRupees > 0 && parseInt(betAmountRupees) > newRemainingRupees) {
          setBetAmountRupees(newRemainingRupees.toString())
        }
      }

      // Advance turn to next active player clockwise
      const currentIdx = activePlayers.findIndex(p => p.id === bettingPlayerId)
      if (currentIdx !== -1 && activePlayers.length > 1) {
        const nextPlayer = activePlayers[(currentIdx + 1) % activePlayers.length]
        setBettingPlayerId(nextPlayer.id)
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setBetActionError(err.message)
      } else {
        setBetActionError('Failed to record bet')
      }
    }
  }

  // Handle Cancel Current Round
  const handleConfirmCancelCurrent = () => {
    try {
      const reason = cancelCurrentReasonType === 'CONSECUTIVE'
        ? `Consecutive cards/numbers shown (${consecutiveNumbersText || '61, 62'}). Entire round cancelled.`
        : (cancelCurrentCustomText.trim() || 'Current round cancelled by host. All bets voided.')
      cancelCurrentRound(reason)
      setShowCancelCurrentModal(false)
      setCelebrationMsg(`🚫 Round #${currentRoundNum} cancelled! All bets refunded & starting pot restored.`)
      setTimeout(() => setCelebrationMsg(null), 5000)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setBetActionError(err.message)
      }
    }
  }

  // Handle Cancel Previous Round
  const handleConfirmCancelPrevious = () => {
    if (!lastCompletedRound) return
    try {
      const reason = cancelPrevReasonText.trim() || `Previous Round #${lastCompletedRound.roundNumber} cancelled & voided.`
      cancelPreviousRound(reason)
      setShowCancelPrevModal(false)
      setCelebrationMsg(`⏪ Previous Round #${lastCompletedRound.roundNumber} cancelled! All its transactions were voided.`)
      setTimeout(() => setCelebrationMsg(null), 5000)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setBetActionError(err.message)
      }
    }
  }

  // Finish Round Early & Advance to Next Round (Optional early advance)
  const handleFinishRound = () => {
    try {
      finishRoundAndStartNext({ autoCollectNextAnte: true })
      setCelebrationMsg(`🏁 Round #${currentRoundNum} completed! Advanced to Round #${currentRoundNum + 1} with board fees collected.`)
      setTimeout(() => setCelebrationMsg(null), 4000)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setBetActionError(err.message)
      }
    }
  }

  // Copy WhatsApp summary
  const handleCopyWhatsApp = () => {
    const lines = [
      `🪙 ${state.gameName.toUpperCase()}`,
      `📅 Date: ${new Date().toLocaleDateString()}`,
      `🎯 Rounds Completed: ${completedRoundsCount}`,
      `💰 Current Board Money Remaining: ${formatPaise(boardBalancePaise)}`,
      `📦 Board Fee / Round: ${formatPaise(boardMoneyPaise)}`,
      '',
      '🏆 PLAYER SCOREBOARD:',
    ]

    const sorted = [...players].sort((a, b) => {
      const posA = playerSummaries[a.id]?.netPositionPaise || 0
      const posB = playerSummaries[b.id]?.netPositionPaise || 0
      return posB - posA
    })

    sorted.forEach((p, idx) => {
      const s = playerSummaries[p.id]
      const net = s?.netPositionPaise || 0
      const sign = net > 0 ? '+' : ''
      const medal = idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : '• '
      lines.push(`${medal}${p.name}: ${sign}${formatPaise(net)} (Won: ${formatPaise(s?.totalPayoutsPaise || 0)}, Paid/Lost: ${formatPaise(s?.totalContributionsPaise || 0)})`)
    })

    if (settlementPlan.transfers.length > 0) {
      lines.push('', '💸 FINAL SETTLEMENT (WHO PAYS WHOM):')
      settlementPlan.transfers.forEach((t, i) => {
        const fromP = players.find(p => p.id === t.fromPlayerId)?.name || 'Player'
        const toP = players.find(p => p.id === t.toPlayerId)?.name || 'Player'
        lines.push(`${i + 1}. ${fromP} pays ${toP}: ${formatPaise(t.amountPaise)}`)
      })
    } else {
      lines.push('', '✅ All accounts are fully settled!')
    }

    lines.push('', 'Tracked effortlessly with Coins Ledger.')
    navigator.clipboard.writeText(lines.join('\n'))
    setCopiedShareText(true)
    setTimeout(() => setCopiedShareText(false), 2500)
  }

  // Recent transactions for this round
  const recentBets = state.transactions
    .filter(t => t.roundId === activeRound?.id && (t.category === 'BOARD_PAYOUT' || t.category === 'PLAYER_CONTRIBUTION'))
    .slice(0, 4)

  // Undo is only offered for real declared bets (won payouts / lost-bet payments),
  // never for board-fee contributions.
  const hasUndoableBet = state.transactions.some(
    t => t.roundId === activeRound?.id &&
         (t.category === 'BOARD_PAYOUT' ||
          (t.category === 'PLAYER_CONTRIBUTION' && (t.notes || '').toLowerCase().includes('lost bet')))
  )

  // Mobile: game setup accordion (board fee + player management) - expanded pre-game,
  // auto-collapses to a one-line summary once play begins; desktop always shows everything.
  // "Activity" means a real declared bet (won/lost), not the automatic board-fee
  // contributions every round starts with.
  const gameHasActivity = state.transactions.some(
    t => t.roundId === activeRound?.id &&
         (t.category === 'BOARD_PAYOUT' ||
          (t.category === 'PLAYER_CONTRIBUTION' && (t.notes || '').toLowerCase().includes('lost bet')))
  ) || completedRoundsCount > 0
  const [setupOpen, setSetupOpen] = useState(!gameHasActivity)
  const setupAutoCollapsed = React.useRef(false)
  React.useEffect(() => {
    if (!setupAutoCollapsed.current && gameHasActivity) {
      setupAutoCollapsed.current = true
      setSetupOpen(false)
    }
  }, [gameHasActivity])

  // First-run welcome: only for a visitor who had no saved game and no real
  // activity yet. Dismissible; also disappears by itself once play begins.
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)
  const showWelcome = !startedWithSavedGame && !welcomeDismissed && !gameHasActivity && !isGameSettled

  // Setup-first ordering: for a first-run visitor, Players & Board fee stay ahead
  // of Declare Bet until real play begins - dismissing the welcome never hides setup.
  const setupFirst = !startedWithSavedGame && !gameHasActivity && !isGameSettled
  const setupSectionRef = React.useRef<HTMLDivElement>(null)
  const scrollToSetup = () => {
    setSetupOpen(true)
    // The welcome strip unmounts on the same click and shifts layout up, so
    // wait two frames for settled layout before scrolling; scroll-mt on the
    // section keeps Players clear of the sticky header.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        setupSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      )
    )
  }

  // Medal ranks only make sense once a real bet has been recorded anywhere.
  const anyBetRecorded = state.transactions.some(
    t => t.category === 'BOARD_PAYOUT' ||
         (t.category === 'PLAYER_CONTRIBUTION' && (t.notes || '').toLowerCase().includes('lost bet'))
  )

  return (
    <div className="space-y-4 sm:space-y-5 lg:space-y-6 max-w-6xl mx-auto pb-8">

      {/* First-run Welcome Strip */}
      {showWelcome && (
        <div className="p-4 sm:p-5 rounded-[16px] bg-white border-2 border-black space-y-3 shadow-sm lg:max-w-3xl lg:mx-auto">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[8px] bg-[#B6EA84] border border-black flex items-center justify-center shrink-0">
                <Sparkles size={16} className="text-black" />
              </div>
              <div>
                <h2 className="text-sm font-black text-black">New here? Start in 3 steps</h2>
                <p className="text-xs text-[#616161]">
                  Coins Ledger tracks your card game's board pot and works out who pays whom at the end.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWelcomeDismissed(true)}
              aria-label="Dismiss welcome"
              className="p-1.5 rounded-full text-[#616161] hover:text-black hover:bg-[#F0F0F0] cursor-pointer transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>

          <ol className="text-xs text-[#404040] space-y-1.5 leading-relaxed">
            <li>
              <strong className="text-black">1.</strong> Replace the sample players with your group and set the board fee, in Game setup
              <span className="lg:hidden"> below</span>
              <span className="hidden lg:inline"> on the right</span> (it's open for you).
            </li>
            <li>
              <strong className="text-black">2.</strong> As each turn happens, pick the player and amount under Declare Bet, then tap WON or LOST.
            </li>
            <li>
              <strong className="text-black">3.</strong> When the game ends, tap Complete Game & Settle to see who pays whom.
            </li>
          </ol>

          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={loadDemoGame}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#F8F8F8] hover:bg-black hover:text-white text-black border border-[#D8D8D8] hover:border-black transition-all cursor-pointer shadow-sm"
            >
              See a sample game
            </button>
            <button
              type="button"
              onClick={() => {
                setWelcomeDismissed(true)
                scrollToSetup()
              }}
              className="px-3.5 py-1.5 rounded-full text-xs font-black bg-[#B6EA84] hover:bg-[#a5db71] text-black border border-black cursor-pointer shadow-sm transition-colors"
            >
              Got it, I'll set up
            </button>
          </div>
        </div>
      )}

      {/* Celebration Notification */}
      {celebrationMsg && (
        <div className="p-4 rounded-[16px] bg-[#D0E6D6] border-2 border-black text-[#194220] text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-md">
          <Sparkles size={18} className="text-[#194220] shrink-0" />
          <span>{celebrationMsg}</span>
        </div>
      )}

      {/* HERO SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-5">

        {/* BentoML Signature Lime Hero Pot Tile */}
        <div className="md:col-span-5 cl-card-pot bento-card-green p-4 sm:p-7 lg:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono lg:font-sans tracking-widest uppercase font-black text-[#B6EA84] bg-black px-3 py-1 rounded-full">
                BOARD POT
              </span>
              <button
                type="button"
                onClick={() => setCurrentTab('settlement')}
                className="cta-arrow-btn bg-black text-[#B6EA84] border border-black cursor-pointer"
                title="Go to settlement"
                aria-label="Go to settlement"
              >
                <ArrowUpRight size={16} />
              </button>
            </div>

            <div className="mt-4">
              <span className="text-xs font-mono lg:font-sans font-bold text-black/70 uppercase tracking-wider block">
                Board Money Remaining
              </span>
              <span className="text-3xl sm:text-5xl lg:text-4xl font-black font-mono tracking-tight text-black block mt-1">
                {formatPaise(boardBalancePaise)}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 sm:mt-6 sm:pt-4 lg:mt-4 lg:pt-3 border-t border-black/15 flex items-center justify-between text-xs font-mono font-bold text-black">
            <span>{activeRound ? `Round #${currentRoundNum} Active` : 'Game Settled'}</span>
            <span>
              {activeCount} {activeCount === 1 ? 'Player' : 'Players'} Active
              {inactivePlayers.length > 0 && ` (${inactivePlayers.length} Sitting Out)`}
            </span>
          </div>
        </div>

        {/* BentoML Signature Deep Forest Hero Headline & Actions Tile */}
        <div className="md:col-span-7 cl-card-dark bento-card-dark p-4 sm:p-7 lg:p-5 flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-2 relative z-10">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono lg:font-sans tracking-widest uppercase font-bold text-[#B6EA84] bg-[#B6EA84]/15 border border-[#B6EA84]/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#B6EA84] animate-pulse" />
                CURRENT ROUND
              </span>
              <span className="text-xs text-[#D0E6D6]/80 font-mono">
                {completedRoundsCount} {completedRoundsCount === 1 ? 'Round' : 'Rounds'} Completed
              </span>
              <span className="hidden sm:inline-block text-[10px] font-mono lg:font-sans text-[#194220] bg-[#B6EA84] px-2 py-0.5 rounded-full font-bold">
                ⚡ Auto-advances when pot clears
              </span>
            </div>

            <h1 className="hidden sm:block lg:hidden text-xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Board Pot <span className="text-[#B6EA84]">Without Complexity</span>
            </h1>
            <p className="hidden sm:block lg:hidden text-xs sm:text-sm text-[#D0E6D6]/80 max-w-md leading-relaxed">
              When a round finishes, the new round starts automatically. Change board fee anytime to dynamically adjust the pot. Cancel current or previous rounds with 1 click.
            </p>
          </div>

          {/* DEDICATED CANCELLATION & ROUND CONTROLS */}
          <div className="mt-4 pt-3 sm:mt-6 sm:pt-4 lg:mt-5 lg:pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5 relative z-10">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Cancel Current Round Button */}
              <button
                type="button"
                onClick={() => setShowCancelCurrentModal(true)}
                className="py-2.5 px-3.5 rounded-[12px] bg-[#EB5757]/15 hover:bg-[#EB5757]/25 active:scale-[0.98] border border-[#EB5757]/30 text-[#EB5757] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer lg:py-2 lg:bg-[#EB5757]/10 lg:hover:bg-[#EB5757]/20"
                title="Cancel current round & void all bets"
              >
                <Ban size={14} className="text-[#EB5757]" />
                <span>Cancel Round #{currentRoundNum}</span>
              </button>

              {/* Cancel Previous Round Button (only when a previous round exists) */}
              {lastCompletedRound && (
                <button
                  type="button"
                  onClick={() => setShowCancelPrevModal(true)}
                  className="py-2.5 px-3.5 rounded-[12px] bg-white/10 hover:bg-white/20 active:scale-[0.98] border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer lg:py-2 lg:bg-white/5"
                  title={`Cancel and void previous Round #${lastCompletedRound.roundNumber}`}
                >
                  <RotateCcw size={14} className="text-[#D0E6D6]" />
                  <span>Cancel Prev #{lastCompletedRound.roundNumber}</span>
                </button>
              )}
            </div>

            {/* Complete Round & Next Round / Complete Game & Settle */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleFinishRound}
                className="py-2.5 px-3 rounded-[12px] bg-white/10 hover:bg-white/20 active:scale-[0.98] text-white border border-white/20 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer lg:font-black lg:border-white/40"
                title="Roll over remaining pot early and start next round"
              >
                <span>Next Round #{currentRoundNum + 1}</span>
                <ArrowRight size={13} />
              </button>

              <button
                type="button"
                onClick={() => setShowCompleteGameModal(true)}
                className="py-2.5 px-3.5 rounded-[12px] bg-[#B6EA84] hover:bg-[#a5db71] active:scale-[0.98] text-black border border-black font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title="Finish game, remove unplayed round pot, and view settlement"
              >
                <Coins size={14} />
                <span>Complete Game & Settle</span>
              </button>
            </div>
          </div>

          <p className="mt-3 text-[10px] sm:text-[11px] text-[#D0E6D6]/70 leading-relaxed relative z-10 lg:max-w-xl">
            <span className="font-bold text-[#D0E6D6]">Round actions:</span> Next Round ends this round early and carries the remaining pot over. Cancel Round voids this round's bets and restarts it - use it for the consecutive-numbers rule or a misdeal. Complete Game & Settle ends the session and shows who pays whom.
          </p>
        </div>

      </div>

      {/* Core Gameplay Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">

        {/* The Betting Deck */}
        <div className={`lg:col-span-8 cl-card-charcoal bento-card-white p-4 sm:p-7 lg:p-6 space-y-4 sm:space-y-5 ${setupFirst ? 'order-2 lg:order-1' : ''}`}>
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-[8px] bg-[#B6EA84] text-black border border-black flex items-center justify-center font-black text-xs">
                3
              </div>
              <h2 className="text-base font-extrabold text-black tracking-tight">
                Declare Bet Against Board
              </h2>
            </div>
            <span className="text-xs font-mono font-black text-[#194220]">
              Pot: {formatPaise(boardBalancePaise)}
            </span>
          </div>

          {/* Game Settled Notification Banner */}
          {isGameSettled && (
            <div className="p-4 rounded-[16px] bg-[#D0E6D6] border-2 border-black flex flex-col sm:flex-row items-center justify-between gap-3 text-black">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#B6EA84] border border-black flex items-center justify-center shrink-0">
                  <Check size={16} className="text-black stroke-[3]" />
                </div>
                <div>
                  <strong className="text-xs font-black block">Game Completed & Settled (Pot ₹0)</strong>
                  <span className="text-[11px] text-[#194220]">Unplayed pot refunded. Check Final Settlement for who owes whom.</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setCurrentTab('settlement')}
                  className="px-3.5 py-1.5 rounded-full bg-black text-[#B6EA84] font-black text-xs flex items-center gap-1.5 cursor-pointer hover:bg-[#222222] transition-colors"
                >
                  <span>Settlement</span>
                  <ArrowRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => createRound()}
                  className="px-3.5 py-1.5 rounded-full bg-white text-black font-bold text-xs border border-black cursor-pointer hover:bg-[#F0F0F0] transition-colors"
                >
                  <span>Next Round</span>
                </button>
              </div>
            </div>
          )}

          {/* Substep A: Select Betting Player */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#616161] block">
              A. Who is taking their turn to bet?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {activePlayers.length === 0 ? (
                <div className="col-span-full p-3 rounded-[14px] bg-[#F8F8F8] border border-[#D8D8D8] text-xs text-[#616161] font-mono text-center">
                  All players are currently sitting out. Rejoin players in Step 1 to bet.
                </div>
              ) : (
                activePlayers.map((p) => {
                  const isSelected = bettingPlayerId === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setBettingPlayerId(p.id)
                        setBetActionError(null)
                      }}
                      disabled={isBettingDisabled}
                      className={`p-3 rounded-[14px] border text-left transition-all cursor-pointer flex items-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'bg-[#152822] border-2 border-black text-white font-bold shadow-sm lg:shadow-md lg:ring-2 lg:ring-[#B6EA84]/70'
                          : 'bg-[#F8F8F8] border-[#D8D8D8] text-[#404040] hover:text-black hover:border-black'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                          isSelected ? 'bg-[#B6EA84] text-black border border-black' : 'bg-white text-black border border-[#D8D8D8]'
                        }`}
                      >
                        {p.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs font-bold truncate">{p.name}</span>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Substep B: Declare Bet Amount */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-[#616161]">
                B. How much of remaining board money to bet?
              </label>
              <span className="font-mono text-[#616161] text-[11px]">
                Max: {formatPaise(boardBalancePaise)}
              </span>
            </div>

            {/* Quick Percentage Presets */}
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleSetBetPercentage(25)}
                disabled={isBettingDisabled}
                className={`py-2 px-1 rounded-[12px] text-xs font-mono transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-center ${
                  is25Selected
                    ? 'bg-[#B6EA84] text-black font-black border-2 border-black shadow-sm'
                    : 'bg-[#F8F8F8] border border-[#D8D8D8] hover:border-black text-[#404040] hover:text-black font-bold'
                }`}
              >
                25% ({formatPaise(preset25 * 100)})
              </button>
              <button
                type="button"
                onClick={() => handleSetBetPercentage(50)}
                disabled={isBettingDisabled}
                className={`py-2 px-1 rounded-[12px] text-xs font-mono transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-center ${
                  is50Selected
                    ? 'bg-[#B6EA84] text-black font-black border-2 border-black shadow-sm'
                    : 'bg-[#F8F8F8] border border-[#D8D8D8] hover:border-black text-[#404040] hover:text-black font-bold'
                }`}
              >
                Half Pot ({formatPaise(preset50 * 100)})
              </button>
              <button
                type="button"
                onClick={() => handleSetBetPercentage(75)}
                disabled={isBettingDisabled}
                className={`py-2 px-1 rounded-[12px] text-xs font-mono transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-center ${
                  is75Selected
                    ? 'bg-[#B6EA84] text-black font-black border-2 border-black shadow-sm'
                    : 'bg-[#F8F8F8] border border-[#D8D8D8] hover:border-black text-[#404040] hover:text-black font-bold'
                }`}
              >
                75% ({formatPaise(preset75 * 100)})
              </button>
              <button
                type="button"
                onClick={() => handleSetBetPercentage(100)}
                disabled={isBettingDisabled}
                className={`py-2 px-1 rounded-[12px] text-xs font-mono transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-center ${
                  is100Selected
                    ? 'bg-[#B6EA84] text-black font-black border-2 border-black shadow-sm'
                    : 'bg-[#F8F8F8] border border-[#D8D8D8] hover:border-black text-[#404040] hover:text-black font-bold'
                }`}
              >
                Full Pot ({formatPaise(preset100 * 100)})
              </button>
            </div>

            {/* Custom Bet Input */}
            <div className="relative pt-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#888888] text-lg font-bold">
                ₹
              </span>
              <input
                type="number"
                min="1"
                max={currentBoardRupees}
                value={isBettingDisabled ? '0' : betAmountRupees}
                disabled={isBettingDisabled}
                onChange={e => {
                  setBetActionError(null)
                  const raw = e.target.value
                  const val = parseInt(raw) || 0
                  if (val > currentBoardRupees) {
                    setBetAmountRupees(currentBoardRupees.toString())
                    setBetActionError(`Cannot bid or lose more than the remaining board pot (₹${currentBoardRupees} available)`)
                  } else {
                    setBetAmountRupees(raw)
                  }
                }}
                placeholder="Enter bet amount..."
                className="w-full bg-[#F8F8F8] border border-[#D8D8D8] rounded-[16px] pl-9 pr-4 py-3 text-lg font-mono font-bold text-black focus:outline-none focus:border-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Bet Error Msg */}
          {betActionError && (
            <div className="p-3 rounded-[12px] bg-[#EB5757]/15 border border-[#EB5757]/30 text-xs text-[#EB5757] font-semibold flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-[#EB5757]" />
              <span>{betActionError}</span>
            </div>
          )}

          {/* Substep C: Record the outcome */}
          <div className="pt-1">
            <label className="text-xs font-semibold text-[#616161] block">
              C. Did they win or lose?
            </label>
            <p className="text-[11px] text-[#888888] mt-0.5">
              Tap to record the result instantly. Made a mistake? Undo Last Bet appears below once a bet is recorded.
            </p>
          </div>

          {/* Substep C: Mobile-First Big Outcome Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleExecuteBet('WON')}
              disabled={isBettingDisabled || !betAmountRupees || parseInt(betAmountRupees) <= 0 || parseInt(betAmountRupees) > currentBoardRupees}
              className="py-4 px-3 rounded-[16px] bg-[#B6EA84] hover:bg-[#a5db71] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed text-black border-2 border-black font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
            >
              <Trophy size={18} />
              <span>{isBettingDisabled ? 'WON' : `WON (+₹${betAmountRupees || '0'})`}</span>
            </button>

            <button
              type="button"
              onClick={() => handleExecuteBet('LOST')}
              disabled={isBettingDisabled || !betAmountRupees || parseInt(betAmountRupees) <= 0 || parseInt(betAmountRupees) > currentBoardRupees}
              className="py-4 px-3 rounded-[16px] bg-[#EB5757] hover:bg-[#e04545] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed text-white border-2 border-black font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
            >
              <Flame size={18} />
              <span>{isBettingDisabled ? 'LOST' : `LOST (-₹${betAmountRupees || '0'})`}</span>
            </button>
          </div>

          {/* Recent Bets in Round Feed */}
          {recentBets.length > 0 && (
            <div className="pt-3 border-t border-[#E5E5E5] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#616161] block font-bold">
                  Bets in Current Round #{currentRoundNum}:
                </span>
                {hasUndoableBet && (
                  <button
                    type="button"
                    onClick={handleUndoLastBet}
                    className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-[#F8F8F8] hover:bg-black hover:text-white border border-[#D8D8D8] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    title="Undo the last recorded bet action"
                  >
                    <Undo2 size={12} />
                    <span>Undo Last Bet</span>
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {recentBets.map(tx => {
                  const isWon = tx.category === 'BOARD_PAYOUT'
                  const isFee = !isWon && !(tx.notes || '').toLowerCase().includes('lost bet')
                  const pEntry = tx.entries.find(e => e.accountId.startsWith('ACCOUNT_PLAYER_'))
                  const playerId = pEntry?.accountId.replace('ACCOUNT_PLAYER_', '')
                  const player = players.find(p => p.id === playerId)
                  const amt = pEntry?.amountPaise || 0

                  return (
                    <div
                      key={tx.id}
                      className="p-2 rounded-[12px] bg-[#F8F8F8] border border-[#E5E5E5] flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isWon ? 'bg-[#194220]' : isFee ? 'bg-[#9E9E9E]' : 'bg-[#EB5757]'}`} />
                        <span className="font-sans font-bold text-black">{player?.name || 'Player'}</span>
                        <span className="text-[#616161] text-[11px] font-sans">
                          {isWon ? 'won bet' : isFee ? 'paid board fee' : 'lost bet'}
                        </span>
                      </div>
                      <span className={`font-black ${isWon ? 'text-[#194220]' : isFee ? 'text-[#616161]' : 'text-[#EB5757]'}`}>
                        {isWon ? `+${formatPaise(amt)}` : `-${formatPaise(amt)}`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Board Fee & Table Setup */}
        <div ref={setupSectionRef} className={`lg:col-span-4 space-y-4 scroll-mt-28 ${setupFirst ? 'order-1 lg:order-2' : ''}`}>

          {/* Mobile: Game setup accordion toggle (desktop always shows everything below) */}
          <button
            type="button"
            onClick={() => setSetupOpen(o => !o)}
            className="lg:hidden w-full flex items-center justify-between gap-2 p-3.5 rounded-[16px] bg-white border border-[#D8D8D8] cursor-pointer shadow-sm"
          >
            <span className="flex items-center gap-2 text-xs font-extrabold text-black">
              <Settings2 size={14} className="text-[#194220]" />
              <span>{setupFirst ? 'Start here: players & board fee' : 'Game setup'}</span>
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-[#616161] font-bold">
              <span>{formatPaise(boardMoneyPaise)} / player &bull; {activeCount} players</span>
              {setupOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </button>

          <div className={`${setupOpen ? 'space-y-4' : 'hidden'} lg:block lg:space-y-4`}>

          {/* Players Box */}
          <div className="cl-card-charcoal bento-card-white p-6 space-y-4 bg-white border border-[#D8D8D8] rounded-[20px]">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[8px] bg-[#D0E6D6] text-[#194220] border border-[#194220] flex items-center justify-center font-black text-xs">
                  1
                </div>
                <h3 className="text-sm font-extrabold text-black">
                  Players ({activeCount} Active{inactivePlayers.length > 0 ? ` • ${inactivePlayers.length} Out` : ''})
                </h3>
              </div>
            </div>

            {/* Player Input Form */}
            <form onSubmit={handleAddPlayer} className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add player name..."
                  value={newPlayerName}
                  onChange={e => setNewPlayerName(e.target.value)}
                  className="flex-1 bg-[#F8F8F8] border border-[#D8D8D8] rounded-[12px] px-3 py-2 text-xs text-black placeholder-[#888888] focus:outline-none focus:border-black"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-[12px] bg-black hover:bg-[#333333] text-white font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0 border border-black shadow-sm"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              </div>
              {playerInputError && (
                <p className="text-[11px] text-[#EB5757] font-semibold">{playerInputError}</p>
              )}
            </form>

            {/* Compact Player List */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {players.map(p => {
                const s = playerSummaries[p.id]
                const net = s?.netPositionPaise || 0
                const isPlayerActive = p.isActive !== false

                return (
                  <div
                    key={p.id}
                    className={`p-2 rounded-[14px] border flex items-center justify-between gap-2 transition-all ${
                      isPlayerActive
                        ? 'bg-[#F8F8F8] border-[#E5E5E5]'
                        : 'bg-[#F0F0F0]/70 border-[#D8D8D8] opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border shrink-0 ${
                          isPlayerActive
                            ? 'text-black bg-[#B6EA84] border-black'
                            : 'text-[#616161] bg-[#E0E0E0] border-[#999999]'
                        }`}
                      >
                        {p.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex items-center gap-1.5">
                        <span className={`text-xs font-bold truncate ${isPlayerActive ? 'text-black' : 'text-[#616161]'}`}>
                          {p.name}
                        </span>
                        {!isPlayerActive && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-[#E5E5E5] text-[#616161] font-bold">
                            Sitting Out
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          net > 0 ? 'text-black bg-[#B6EA84] border border-black' : net < 0 ? 'text-[#EB5757] bg-[#EB5757]/15 border border-[#EB5757]/30' : 'text-[#616161] bg-[#E5E5E5]'
                        }`}
                      >
                        {net > 0 ? `+${formatPaise(net)}` : formatPaise(net)}
                      </span>

                      {/* Active / Sitting Out Toggle Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(p.id)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                          isPlayerActive
                            ? 'bg-white hover:bg-[#EB5757]/10 text-[#404040] hover:text-[#EB5757] border-[#D8D8D8] hover:border-[#EB5757]/40'
                            : 'bg-[#B6EA84] hover:bg-[#a5db71] text-black border-black font-black'
                        }`}
                        title={isPlayerActive ? 'Click to sit out / stop playing future rounds' : 'Click to rejoin table and play'}
                      >
                        {isPlayerActive ? (
                          <>
                            <Pause size={10} />
                            <span>Sit Out</span>
                          </>
                        ) : (
                          <>
                            <Play size={10} className="fill-current" />
                            <span>Rejoin</span>
                          </>
                        )}
                      </button>

                      {/* Delete button (Permanent delete if 0 transactions, otherwise sit out) */}
                      <button
                        type="button"
                        onClick={() => handleRemovePlayer(p.id)}
                        className="p-1 text-[#888888] hover:text-[#EB5757] cursor-pointer transition-colors"
                        title="Remove player"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Board Fee Config Box */}
          <div className="cl-card-charcoal bento-card-white p-6 space-y-4 bg-white border border-[#D8D8D8] rounded-[20px]">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[8px] bg-[#bdadeb] text-black border border-black flex items-center justify-center font-black text-xs">
                  2
                </div>
                <h3 className="text-sm font-extrabold text-black">Board Fee / Round</h3>
              </div>
              <span className="text-xs font-mono font-black text-[#194220]">
                {formatPaise(boardMoneyPaise)} / player
              </span>
            </div>

            <p className="text-xs text-[#616161]">
              Change fee anytime—active round Board Fee and board pot adjust dynamically:
            </p>

            {/* Presets starting from ₹2, ₹5, ₹10, ₹20, ₹50, ₹100 */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {BOARD_FEE_PRESETS.map((amount) => {
                const isSelected = boardMoneyPaise === amount * 100
                return (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => handleSelectStakePreset(amount)}
                    className={`py-2 px-1 rounded-[12px] text-xs font-bold font-mono transition-all cursor-pointer text-center ${
                      isSelected
                        ? 'bg-[#B6EA84] text-black border border-black font-black shadow-sm scale-105'
                        : 'bg-[#F8F8F8] border border-[#D8D8D8] text-[#404040] hover:border-black'
                    }`}
                  >
                    ₹{amount}
                  </button>
                )
              })}
            </div>

            {/* Custom Input */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-[#616161] shrink-0">Custom:</span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888888] text-xs font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={customStakeRupees}
                  onChange={e => handleCustomStakeChange(e.target.value)}
                  className="w-full bg-[#F8F8F8] border border-[#D8D8D8] rounded-[12px] pl-6 pr-3 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                />
              </div>
            </div>
          </div>

          </div>{/* end mobile setup accordion wrapper */}

        </div>

      </div>

      {/* Live Player Scoreboard Table */}
      <div className="bento-card-white bg-white border border-[#D8D8D8] rounded-[20px] p-6 sm:p-7 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-[#194220]" />
              <h3 className="text-base font-black text-black tracking-tight">
                Live Player Scoreboard
              </h3>
            </div>
            <p className="text-xs text-[#616161] mt-0.5">
              Net balance calculates automatically: Total Bets Won minus Total Board Fees & Lost Bets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyWhatsApp}
              className="px-3.5 py-1.5 rounded-full bg-[#F8F8F8] hover:bg-[#EAEAEA] border border-[#D8D8D8] text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Share2 size={13} className="text-[#194220]" />
              <span>{copiedShareText ? 'Copied WhatsApp!' : 'Share WhatsApp'}</span>
            </button>

            <button
              onClick={() => setCurrentTab('settlement')}
              className="px-4 py-1.5 rounded-full bg-[#B6EA84] hover:bg-[#a5db71] text-black border border-black text-xs font-black flex items-center gap-1.5 cursor-pointer transition-transform hover:scale-[1.02] shadow-sm"
            >
              <span>Settlement</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Scoreboard Table (desktop) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5E5E5] text-[#616161] uppercase tracking-wider font-mono text-[10px]">
                <th className="py-2.5 px-3">Player</th>
                <th className="py-2.5 px-3 text-right">Board Fees & Losses</th>
                <th className="py-2.5 px-3 text-right">Bets Won</th>
                <th className="py-2.5 px-3 text-right">Net Profit / Loss</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5] font-mono tabular-nums">
              {[...players]
                .sort((a, b) => {
                  const posA = playerSummaries[a.id]?.netPositionPaise || 0
                  const posB = playerSummaries[b.id]?.netPositionPaise || 0
                  return posB - posA
                })
                .map((p, idx) => {
                  const s = playerSummaries[p.id]
                  const net = s?.netPositionPaise || 0
                  const paid = s?.totalContributionsPaise || 0
                  const won = s?.totalPayoutsPaise || 0
                  const isCurrentBet = p.id === bettingPlayerId

                  return (
                    <tr key={p.id} className={`${isCurrentBet ? 'bg-[#F3FBEA] hover:bg-[#F3FBEA]' : 'hover:bg-[#F8F8F8]'} transition-colors`}>
                      <td className="py-2.5 px-3 font-sans font-bold text-black flex items-center gap-2">
                        <span className="text-[#888888] text-[10px] w-4">
                          {anyBetRecorded && idx === 0 ? '🥇' : anyBetRecorded && idx === 1 ? '🥈' : anyBetRecorded && idx === 2 ? '🥉' : `${idx + 1}.`}
                        </span>
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-black bg-[#B6EA84] border border-black shrink-0"
                        >
                          {p.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="truncate">{p.name}</span>
                      </td>

                      <td className="py-2.5 px-3 text-right text-[#EB5757] font-semibold">
                        -{formatPaise(paid)}
                      </td>

                      <td className="py-2.5 px-3 text-right text-[#194220] font-semibold">
                        +{formatPaise(won)}
                      </td>

                      <td className="py-2.5 px-3 text-right font-black text-sm">
                        <span className={net > 0 ? 'text-[#194220]' : net < 0 ? 'text-[#EB5757]' : 'text-[#616161]'}>
                          {net > 0 ? `+${formatPaise(net)}` : formatPaise(net)}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center font-sans">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            net > 0
                              ? 'bg-[#B6EA84] text-black border border-black'
                              : net < 0
                              ? 'bg-[#EB5757]/15 text-[#EB5757] border border-[#EB5757]/30'
                              : 'bg-[#F0F0F0] text-[#616161] border border-[#D8D8D8]'
                          }`}
                        >
                          {net > 0 ? 'Profit' : net < 0 ? 'Owes' : 'Even'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>

        {/* Mobile: stacked scoreboard rows (no horizontal scrolling) */}
        <div className="sm:hidden divide-y divide-[#E5E5E5]">
          {[...players]
            .sort((a, b) => (playerSummaries[b.id]?.netPositionPaise || 0) - (playerSummaries[a.id]?.netPositionPaise || 0))
            .map((p, idx) => {
              const s = playerSummaries[p.id]
              const net = s?.netPositionPaise || 0
              const paid = s?.totalContributionsPaise || 0
              const won = s?.totalPayoutsPaise || 0

              return (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[#888888] text-[10px] w-4 shrink-0 font-mono">
                      {anyBetRecorded && idx === 0 ? '🥇' : anyBetRecorded && idx === 1 ? '🥈' : anyBetRecorded && idx === 2 ? '🥉' : `${idx + 1}.`}
                    </span>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-black bg-[#B6EA84] border border-black shrink-0">
                      {p.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-black truncate block">{p.name}</span>
                      <span className="text-[10px] font-mono text-[#616161] block">
                        -{formatPaise(paid)} fees &middot; +{formatPaise(won)} won
                      </span>
                    </div>
                  </div>
                  <span className={`text-sm font-black font-mono shrink-0 ${net > 0 ? 'text-[#194220]' : net < 0 ? 'text-[#EB5757]' : 'text-[#616161]'}`}>
                    {net > 0 ? `+${formatPaise(net)}` : formatPaise(net)}
                  </span>
                </div>
              )
            })}
        </div>
      </div>

      {/* COMPLETE GAME & SETTLE MODAL DIALOG */}
      {showCompleteGameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border-2 border-black w-full max-w-md p-6 rounded-[20px] space-y-4 shadow-2xl text-black">
            <div className="flex items-center gap-2.5 text-black font-black text-base">
              <Coins size={22} className="text-[#194220]" />
              <span>Complete Game & Cash Out?</span>
            </div>

            <p className="text-xs text-[#444444] leading-relaxed">
              This will wrap up the session, <strong>remove the unplayed Round #{currentRoundNum} pot automatically taken from everybody</strong>, and open the Final Settlement screen showing exactly who owes whom and how much to pay.
            </p>

            <div className="p-3.5 rounded-[14px] bg-[#F8F8F8] border border-[#D8D8D8] text-xs space-y-1 font-mono text-[#616161]">
              <div className="flex justify-between">
                <span>Completed Rounds:</span>
                <span className="text-black font-bold">{completedRoundsCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Unplayed Pot to Refund:</span>
                <span className="text-[#194220] font-bold">{formatPaise(boardBalancePaise)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
              <button
                type="button"
                onClick={() => setShowCompleteGameModal(false)}
                className="px-4 py-2 rounded-full text-xs font-bold text-[#616161] hover:text-black hover:bg-[#F0F0F0] border border-[#D8D8D8] cursor-pointer"
              >
                Keep Playing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCompleteGameModal(false)
                  completeGameAndSettle()
                }}
                className="px-4 py-2 rounded-full text-xs font-black bg-[#B6EA84] hover:bg-[#a5db71] text-black border border-black cursor-pointer shadow-sm"
              >
                Yes, Complete & Settle Up
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. CANCEL CURRENT ROUND MODAL DIALOG */}
      {showCancelCurrentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border-2 border-black w-full max-w-md p-6 rounded-[20px] space-y-4 shadow-2xl text-black">
            <div className="flex items-center gap-2.5 text-[#EB5757] font-black text-base">
              <Ban size={22} />
              <span className="text-black">Cancel Current Round #{currentRoundNum}?</span>
            </div>

            <p className="text-xs text-[#444444] leading-relaxed">
              Cancelling will <strong>void all bets and payouts that occurred in Round #{currentRoundNum}</strong>.
              All players will be refunded, and the round will restart clean with the starting Board Fee.
            </p>

            {/* Reason selector tabs */}
            <div className="space-y-2">
              <span className="text-[11px] font-mono text-[#616161] block uppercase font-bold">
                Select Reason for Cancellation:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setCancelCurrentReasonType('CONSECUTIVE')}
                  className={`p-2.5 rounded-[12px] border text-center font-bold cursor-pointer transition-colors ${
                    cancelCurrentReasonType === 'CONSECUTIVE'
                      ? 'bg-[#EB5757] text-white border-black shadow-sm'
                      : 'bg-[#F8F8F8] border-[#D8D8D8] text-[#616161] hover:text-black'
                  }`}
                >
                  Consecutive (61, 62)
                </button>
                <button
                  type="button"
                  onClick={() => setCancelCurrentReasonType('GENERAL')}
                  className={`p-2.5 rounded-[12px] border text-center font-bold cursor-pointer transition-colors ${
                    cancelCurrentReasonType === 'GENERAL'
                      ? 'bg-[#EB5757] text-white border-black shadow-sm'
                      : 'bg-[#F8F8F8] border-[#D8D8D8] text-[#616161] hover:text-black'
                  }`}
                >
                  Misdeal / Error
                </button>
              </div>

              {cancelCurrentReasonType === 'CONSECUTIVE' ? (
                <div className="p-3 rounded-[14px] bg-[#F8F8F8] border border-[#D8D8D8] space-y-1.5 text-xs">
                  <label className="text-[#616161] block text-[11px] font-mono uppercase font-bold">
                    Consecutive Numbers Drawn:
                  </label>
                  <input
                    type="text"
                    value={consecutiveNumbersText}
                    onChange={e => setConsecutiveNumbersText(e.target.value)}
                    placeholder="e.g. 61, 62"
                    className="w-full bg-white border border-[#D8D8D8] rounded-[10px] px-3 py-2 text-black font-mono text-sm focus:outline-none focus:border-black"
                  />
                </div>
              ) : (
                <div className="p-3 rounded-[14px] bg-[#F8F8F8] border border-[#D8D8D8] space-y-1.5 text-xs">
                  <label className="text-[#616161] block text-[11px] font-mono uppercase font-bold">
                    Cancellation Reason Note:
                  </label>
                  <input
                    type="text"
                    value={cancelCurrentCustomText}
                    onChange={e => setCancelCurrentCustomText(e.target.value)}
                    placeholder="e.g. Wrong bet declared, misdeal..."
                    className="w-full bg-white border border-[#D8D8D8] rounded-[10px] px-3 py-2 text-black text-xs focus:outline-none focus:border-black"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
              <button
                type="button"
                onClick={() => setShowCancelCurrentModal(false)}
                className="px-4 py-2 rounded-full text-xs font-bold text-[#616161] hover:text-black hover:bg-[#F0F0F0] border border-[#D8D8D8] cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelCurrent}
                className="px-4 py-2 rounded-full text-xs font-bold bg-[#EB5757] hover:bg-[#d94848] text-white border border-black cursor-pointer shadow-sm"
              >
                Yes, Cancel Round #{currentRoundNum}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. CANCEL PREVIOUS ROUND MODAL DIALOG */}
      {showCancelPrevModal && lastCompletedRound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border-2 border-black w-full max-w-md p-6 rounded-[20px] space-y-4 shadow-2xl text-black">
            <div className="flex items-center gap-2.5 text-[#EB5757] font-black text-base">
              <RotateCcw size={22} />
              <span className="text-black">Cancel Previous Round #{lastCompletedRound.roundNumber}?</span>
            </div>

            <p className="text-xs text-[#444444] leading-relaxed">
              This will <strong>completely void all transactions, bets, and payouts from Round #{lastCompletedRound.roundNumber}</strong>.
              Player scores and balances will be rolled back.
            </p>

            <div className="p-3 rounded-[14px] bg-[#F8F8F8] border border-[#D8D8D8] space-y-1.5 text-xs">
              <label className="text-[#616161] block text-[11px] font-mono uppercase font-bold">
                Reason / Note for Voiding Previous Round:
              </label>
              <input
                type="text"
                value={cancelPrevReasonText}
                onChange={e => setCancelPrevReasonText(e.target.value)}
                placeholder="e.g. Consecutive numbers shown late, audit error..."
                className="w-full bg-white border border-[#D8D8D8] rounded-[10px] px-3 py-2 text-black font-mono text-sm focus:outline-none focus:border-black"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
              <button
                type="button"
                onClick={() => setShowCancelPrevModal(false)}
                className="px-4 py-2 rounded-full text-xs font-bold text-[#616161] hover:text-black hover:bg-[#F0F0F0] border border-[#D8D8D8] cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelPrevious}
                className="px-4 py-2 rounded-full text-xs font-bold bg-[#EB5757] hover:bg-[#d94848] text-white border border-black cursor-pointer shadow-sm"
              >
                Yes, Cancel Round #{lastCompletedRound.roundNumber}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
