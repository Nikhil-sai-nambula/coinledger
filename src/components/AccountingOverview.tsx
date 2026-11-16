import React, { useState } from 'react'
import { useGame } from '../context/GameContext'
import { formatPaise } from '../utils/money'
import {
  ShieldCheck,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Trophy,
  TrendingDown,
  Scale,
  PlusCircle,
  HelpCircle,
  UserPlus,
  Play,
  RotateCcw,
} from 'lucide-react'

export const AccountingOverview: React.FC = () => {
  const {
    state,
    overview,
    playerSummaries,
    boardBalancePaise,
    setCurrentTab,
    addPlayer,
  } = useGame()

  const [newPlayerName, setNewPlayerName] = useState('')
  const [showAddPlayer, setShowAddPlayer] = useState(false)

  const handleAddPlayerSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlayerName.trim()) return
    addPlayer(newPlayerName.trim())
    setNewPlayerName('')
    setShowAddPlayer(false)
  }

  return (
    <div className="space-y-6">
      {/* Top Ledger Reconciliation Banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          overview.isReconciled
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
            : 'bg-rose-950/50 border-rose-500/50 text-rose-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
              overview.isReconciled
                ? 'bg-emerald-900/50 border-emerald-500/40 text-emerald-400'
                : 'bg-rose-900/50 border-rose-500/40 text-rose-400'
            }`}
          >
            {overview.isReconciled ? <ShieldCheck size={22} /> : <AlertTriangle size={22} />}
          </div>
          <div>
            <div className="flex items-center gap-2 font-bold text-sm tracking-wide">
              <span>{overview.isReconciled ? 'STRICT DOUBLE-ENTRY LEDGER RECONCILED' : 'LEDGER DISCREPANCY DETECTED'}</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/40 border border-current/20">
                100% INTEGER PAISE
              </span>
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              {overview.isReconciled
                ? `Every transaction balances. Total Debits: ${formatPaise(overview.totalDebitsPaise)} == Total Credits: ${formatPaise(overview.totalCreditsPaise)}`
                : `Discrepancy of ${formatPaise(overview.discrepancyPaise)}. Debits (${formatPaise(overview.totalDebitsPaise)}) != Credits (${formatPaise(overview.totalCreditsPaise)}).`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setCurrentTab('ledger')}
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-slate-900/70 hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer text-slate-200 flex items-center gap-1.5"
          >
            <Scale size={13} />
            <span>Audit Journal →</span>
          </button>
        </div>
      </div>

      {/* Prominent Board Balance Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800 p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
              <Landmark size={15} />
              <span>Dedicated Financial Account: Board Balance</span>
            </div>
            <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white flex items-baseline gap-2">
              <span>{formatPaise(boardBalancePaise)}</span>
              <span className="text-xs font-sans font-medium text-slate-400">
                ({boardBalancePaise} paise)
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-xl leading-relaxed pt-1">
              Derived dynamically from ledger entries. The board is a separate financial account, not a player.
              Negative board balances are blocked by invariant enforcement.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3 shrink-0">
            <button
              onClick={() => setCurrentTab('rounds')}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-medium text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all font-semibold shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play size={14} className="fill-current" />
              <span>Record Round Action</span>
            </button>
            <button
              onClick={() => setCurrentTab('funding')}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-medium text-xs bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Landmark size={14} />
              <span>Initial / External Funding</span>
            </button>
          </div>
        </div>

        {/* Board Financial Flow Metrics Sub-bar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div className="space-y-1">
            <span className="text-slate-400 text-[11px] block">Player Contributions</span>
            <span className="text-emerald-400 font-bold text-sm block">
              +{formatPaise(overview.totalContributionsPaise)}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 text-[11px] block">Board Payouts</span>
            <span className="text-rose-400 font-bold text-sm block">
              -{formatPaise(overview.totalBoardPayoutsPaise)}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 text-[11px] block">Unallocated Board Funds</span>
            <span className={`font-bold text-sm block ${boardBalancePaise > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              {formatPaise(Math.max(0, boardBalancePaise))}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 text-[11px] block">Active Rounds</span>
            <span className="text-slate-200 font-bold text-sm block">
              {state.rounds.length} round{state.rounds.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      {/* Core Accounting Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Player Contributions */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Player Inflow</span>
            <ArrowUpRight size={14} className="text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {formatPaise(overview.totalContributionsPaise)}
          </div>
          <div className="text-[11px] text-slate-400 leading-snug">
            All buy-ins, antes, and chips paid to board
          </div>
        </div>

        {/* Total Board Payouts */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Board Outflow</span>
            <ArrowDownLeft size={14} className="text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-400">
            {formatPaise(overview.totalBoardPayoutsPaise)}
          </div>
          <div className="text-[11px] text-slate-400 leading-snug">
            All round pots and prizes awarded
          </div>
        </div>

        {/* Total Player Winnings */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Player Winnings</span>
            <Trophy size={14} className="text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-300">
            {formatPaise(overview.totalPlayerWinningsPaise)}
          </div>
          <div className="text-[11px] text-slate-400 leading-snug">
            Sum of all positive player net positions
          </div>
        </div>

        {/* Unsettled Balances */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Unsettled Balances</span>
            <Scale size={14} className="text-blue-400" />
          </div>
          <div className="text-xl font-bold font-mono text-blue-300">
            {formatPaise(overview.unsettledBalancesPaise)}
          </div>
          <div className="text-[11px] text-slate-400 leading-snug">
            Volume pending player-to-player settlement
          </div>
        </div>
      </div>

      {/* Players Net Balances Ledger Section */}
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Player Net Balances</span>
              <span className="text-xs font-mono font-normal text-slate-400">
                ({state.players.length} registered)
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Net position = Total Payouts + Received Credits − Total Contributions − Sent Debits.
              <span className="text-emerald-400 ml-1">Positive (+): Receive money</span>.
              <span className="text-rose-400 ml-1">Negative (−): Owes money</span>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddPlayer(prev => !prev)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus size={13} />
              <span>Add Player</span>
            </button>
            <button
              onClick={() => setCurrentTab('settlement')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>Settlement Plan →</span>
            </button>
          </div>
        </div>

        {/* Inline Add Player Form */}
        {showAddPlayer && (
          <form
            onSubmit={handleAddPlayerSubmit}
            className="p-3 rounded-xl bg-slate-950/80 border border-slate-700/60 flex items-center gap-2"
          >
            <input
              type="text"
              value={newPlayerName}
              onChange={e => setNewPlayerName(e.target.value)}
              placeholder="Enter player name (e.g. Vikram R.)..."
              className="flex-1 bg-transparent border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={!newPlayerName.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors cursor-pointer disabled:opacity-40"
            >
              Save Player
            </button>
            <button
              type="button"
              onClick={() => setShowAddPlayer(false)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Players Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {state.players.map(player => {
            const summary = playerSummaries[player.id]
            const net = summary?.netPositionPaise ?? 0
            const isPositive = net > 0
            const isNegative = net < 0
            const isZero = net === 0

            return (
              <div
                key={player.id}
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  isPositive
                    ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50'
                    : isNegative
                    ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50'
                    : 'bg-slate-950/40 border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-slate-950 shrink-0"
                        style={{ backgroundColor: player.avatarColor }}
                      >
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-sm text-white truncate" title={player.name}>
                        {player.name}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                        isPositive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : isNegative
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isPositive ? 'CREDITOR' : isNegative ? 'DEBTOR' : 'EVEN'}
                    </span>
                  </div>

                  <div className="mt-3">
                    <span className="text-[11px] font-mono text-slate-400 block">Net Position</span>
                    <div
                      className={`text-xl font-bold font-mono tracking-tight ${
                        isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-slate-300'
                      }`}
                    >
                      {formatPaise(net, { showSign: true })}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1 text-[11px] font-mono text-slate-400">
                  <div className="flex justify-between">
                    <span>Contributions:</span>
                    <span className="text-rose-300">-{formatPaise(summary?.totalContributionsPaise ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Board Payouts:</span>
                    <span className="text-emerald-300">+{formatPaise(summary?.totalPayoutsPaise ?? 0)}</span>
                  </div>
                  {(summary?.directReceivedPaise ?? 0) > 0 || (summary?.directPaidPaise ?? 0) > 0 ? (
                    <div className="flex justify-between">
                      <span>Direct Transfers:</span>
                      <span className="text-slate-200">
                        +{formatPaise(summary?.directReceivedPaise ?? 0)} / -{formatPaise(summary?.directPaidPaise ?? 0)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
