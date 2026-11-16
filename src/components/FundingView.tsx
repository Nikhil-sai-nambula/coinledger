import React, { useState } from 'react'
import { useGame } from '../context/GameContext'
import { formatPaise, parseRupeesToPaise } from '../utils/money'
import {
  Landmark,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Check,
  AlertCircle,
  Plus,
} from 'lucide-react'

export const FundingView: React.FC = () => {
  const {
    state,
    recordInitialFunding,
    recordExternalDeposit,
    recordExternalWithdrawal,
    boardBalancePaise,
  } = useGame()

  // Form states
  const [boardInitialRupees, setBoardInitialRupees] = useState('500')
  const [playerInitialAmounts, setPlayerInitialAmounts] = useState<Record<string, string>>({})
  const [fundingSuccess, setFundingSuccess] = useState<string | null>(null)
  const [fundingError, setFundingError] = useState<string | null>(null)

  // Mid-game external movement state
  const [extMovementType, setExtMovementType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT')
  const [extAmountRupees, setExtAmountRupees] = useState('200')
  const [extNotes, setExtNotes] = useState('')

  const handlePlayerInitialChange = (playerId: string, val: string) => {
    setPlayerInitialAmounts(prev => ({ ...prev, [playerId]: val }))
  }

  const handleInitialFundingSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFundingSuccess(null)
    setFundingError(null)

    try {
      const boardPaise = parseRupeesToPaise(boardInitialRupees || '0')
      const playerBalancesPaise: Record<string, number> = {}

      for (const [pId, strVal] of Object.entries(playerInitialAmounts)) {
        if (strVal && strVal.trim()) {
          const paise = parseRupeesToPaise(strVal)
          if (paise > 0) {
            playerBalancesPaise[pId] = paise
          }
        }
      }

      recordInitialFunding(boardPaise, playerBalancesPaise)
      setFundingSuccess('Initial game funding recorded as explicit double-entry transactions!')
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFundingError(err.message)
      } else {
        setFundingError('Failed to record initial funding')
      }
    }
  }

  const handleExtMovementSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFundingSuccess(null)
    setFundingError(null)

    try {
      const amountPaise = parseRupeesToPaise(extAmountRupees)
      if (amountPaise <= 0) {
        setFundingError('Amount must be positive')
        return
      }

      if (extMovementType === 'DEPOSIT') {
        recordExternalDeposit(amountPaise, extNotes || 'External mid-game deposit')
        setFundingSuccess(`Injected ${formatPaise(amountPaise)} external funding into Board account`)
      } else {
        recordExternalWithdrawal(amountPaise, extNotes || 'External mid-game withdrawal')
        setFundingSuccess(`Withdrew ${formatPaise(amountPaise)} from Board account to external funder`)
      }
      setExtNotes('')
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFundingError(err.message)
      } else {
        setFundingError('Failed to process external movement')
      }
    }
  }

  // Count existing initial funding transactions
  const existingInitialTxs = state.transactions.filter(
    t => t.category === 'INITIAL_BOARD_FUNDING' || t.category === 'INITIAL_PLAYER_BALANCE'
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
            Game Bankroll & Capitalization
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            Account: ACCOUNT_EXTERNAL
          </span>
        </div>
        <h2 className="text-xl font-bold text-white mt-1">Initial Game Funding & External Liquidity</h2>
        <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
          Never silently create money. Every rupee injected into the game is backed by an explicit double-entry
          transaction originating from the External Capital Account.
        </p>
      </div>

      {fundingSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2">
          <Check size={16} className="text-emerald-400 shrink-0" />
          <span>{fundingSuccess}</span>
        </div>
      )}

      {fundingError && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-400 shrink-0" />
          <span>{fundingError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section A: Initial Game Funding */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-5">
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Landmark size={16} className="text-emerald-400" />
              <span>Initial Game Funding</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Set starting board float and optional initial player stacks before round play begins.
            </p>
          </div>

          <form onSubmit={handleInitialFundingSubmit} className="space-y-4">
            {/* Starting Board Balance */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 block flex items-center justify-between">
                <span>Starting Board Bankroll (₹)</span>
                <span className="text-[11px] text-slate-500 font-normal">Debit External, Credit Board</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-mono">₹</span>
                <input
                  type="text"
                  value={boardInitialRupees}
                  onChange={e => setBoardInitialRupees(e.target.value)}
                  placeholder="500"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm font-mono text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Optional Player Initial Balances */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-xs font-mono text-slate-300 block flex items-center justify-between">
                <span>Optional Starting Player Balances (₹)</span>
                <span className="text-[11px] text-slate-500 font-normal">Debit External, Credit Player</span>
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {state.players.map(player => (
                  <div key={player.id} className="flex items-center gap-2">
                    <span className="w-28 text-xs text-slate-300 truncate" title={player.name}>
                      {player.name}
                    </span>
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-2 text-slate-500 text-xs font-mono">₹</span>
                      <input
                        type="text"
                        value={playerInitialAmounts[player.id] || ''}
                        onChange={e => handlePlayerInitialChange(player.id, e.target.value)}
                        placeholder="0"
                        className="w-full bg-slate-950 border border-slate-800 rounded-md pl-6 pr-2 py-1.5 text-xs font-mono text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl font-semibold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              Record Initial Funding Transactions
            </button>
          </form>

          {existingInitialTxs.length > 0 && (
            <div className="pt-2 text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-400" />
              <span>{existingInitialTxs.length} initial funding transaction(s) recorded in audit ledger.</span>
            </div>
          )}
        </div>

        {/* Section B: Mid-Game External Deposits & Withdrawals */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-5">
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Coins size={16} className="text-amber-400" />
              <span>External Liquidity Adjustments</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Inject emergency float into the board or withdraw excess host capital mid-game.
            </p>
          </div>

          <form onSubmit={handleExtMovementSubmit} className="space-y-4">
            {/* Movement Type */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
              <button
                type="button"
                onClick={() => setExtMovementType('DEPOSIT')}
                className={`py-2 rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                  extMovementType === 'DEPOSIT'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ArrowUpRight size={13} />
                <span>External Deposit</span>
              </button>
              <button
                type="button"
                onClick={() => setExtMovementType('WITHDRAWAL')}
                className={`py-2 rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                  extMovementType === 'WITHDRAWAL'
                    ? 'bg-rose-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ArrowDownLeft size={13} />
                <span>External Withdrawal</span>
              </button>
            </div>

            {/* Current Board Notice */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono flex items-center justify-between">
              <span className="text-slate-400">Current Board Balance:</span>
              <span className="text-white font-bold">{formatPaise(boardBalancePaise)}</span>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 block">
                {extMovementType === 'DEPOSIT' ? 'Deposit Amount (₹)' : 'Withdrawal Amount (₹)'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-mono">₹</span>
                <input
                  type="text"
                  value={extAmountRupees}
                  onChange={e => setExtAmountRupees(e.target.value)}
                  placeholder="200"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm font-mono text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 block">
                Reason / Note
              </label>
              <input
                type="text"
                value={extNotes}
                onChange={e => setExtNotes(e.target.value)}
                placeholder="e.g. Added ₹500 chip float, ATM cash withdrawal..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              className={`w-full py-2.5 rounded-xl font-semibold text-xs text-slate-950 transition-colors shadow-lg cursor-pointer ${
                extMovementType === 'DEPOSIT'
                  ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20'
                  : 'bg-rose-500 hover:bg-rose-400 shadow-rose-500/20'
              }`}
            >
              {extMovementType === 'DEPOSIT'
                ? 'Record External Deposit to Board'
                : 'Record External Withdrawal from Board'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
