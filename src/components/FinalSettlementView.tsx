import React, { useState } from 'react'
import { useGame } from '../context/GameContext'
import { formatPaise } from '../utils/money'
import {
  Scale,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  Copy,
  Check,
  Landmark,
  ArrowRight,
  Gift,
  RotateCcw,
  Sparkles,
  Users,
} from 'lucide-react'

export const FinalSettlementView: React.FC = () => {
  const {
    state,
    settlementPlan,
    boardBalancePaise,
    playerSummaries,
    resolveBoardAllocation,
    toggleSettlementTransfer,
  } = useGame()

  const [copiedSummary, setCopiedSummary] = useState(false)

  // Track completed settlement transfer IDs
  const completedTransferIds = new Set(
    state.settlementTransfers.filter(t => t.completed).map(t => t.id)
  )

  const isBlocked = settlementPlan.status !== 'READY'

  const copySettlementText = () => {
    const lines = [
      `🪙 ${state.gameName.toUpperCase()} — FINAL SETTLEMENT PLAN`,
      `Date: ${new Date().toLocaleDateString()}`,
      `Ledger Status: Reconciled & Audited`,
      `Board Balance: ${formatPaise(boardBalancePaise)}`,
      '',
      '--- MINIMAL TRANSFERS TO SETTLE ALL DEBTS ---',
    ]

    if (settlementPlan.transfers.length === 0) {
      lines.push('All player accounts are completely settled (₹0 balance). No transfers needed!')
    } else {
      settlementPlan.transfers.forEach((t, i) => {
        const fromPlayer = state.players.find(p => p.id === t.fromPlayerId)?.name || t.fromPlayerId
        const toPlayer = state.players.find(p => p.id === t.toPlayerId)?.name || t.toPlayerId
        const isDone = completedTransferIds.has(t.id) ? ' [PAID ✓]' : ' [PENDING]'
        lines.push(`${i + 1}. ${fromPlayer} pays ${toPlayer}: ${formatPaise(t.amountPaise)}${isDone}`)
      })
    }

    lines.push('', 'Generated with CoinLedger Double-Entry Engine.')
    navigator.clipboard.writeText(lines.join('\n'))
    setCopiedSummary(true)
    setTimeout(() => setCopiedSummary(false), 2500)
  }

  const completedCount = settlementPlan.transfers.filter(t => completedTransferIds.has(t.id)).length
  const totalTransfers = settlementPlan.transfers.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
              Final Settlement Engine
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              Greedy Debtor-Creditor Minimizer
            </span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Cash Settlement & P2P Resolution</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict accounting settlement: board funds must be explicitly accounted for before settling player accounts.
          </p>
        </div>

        {settlementPlan.status === 'READY' && totalTransfers > 0 && (
          <button
            onClick={copySettlementText}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            {copiedSummary ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedSummary ? 'Copied Summary!' : 'Copy Settlement Message'}</span>
          </button>
        )}
      </div>

      {/* BLOCKED CASE 1: Negative Board Balance */}
      {settlementPlan.status === 'BLOCKED_NEGATIVE_BOARD' && (
        <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-500/40 space-y-3">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <AlertTriangle size={20} />
            <span>FINAL SETTLEMENT BLOCKED: NEGATIVE BOARD BALANCE</span>
          </div>
          <p className="text-xs text-rose-200 leading-relaxed">
            {settlementPlan.explanation}
          </p>
          <div className="text-xs font-mono text-slate-300 bg-black/40 p-3 rounded-lg border border-rose-500/20">
            Current Board Account: <span className="text-rose-400 font-bold">{formatPaise(boardBalancePaise)}</span>.
            Under double-entry accounting rules, the board cannot create phantom money. Please reverse erroneous payouts in the Ledger.
          </div>
        </div>
      )}

      {/* BLOCKED CASE 2: Ledger Discrepancy */}
      {settlementPlan.status === 'BLOCKED_UNRECONCILED' && (
        <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-500/40 space-y-3">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <AlertTriangle size={20} />
            <span>FINAL SETTLEMENT BLOCKED: UNBALANCED LEDGER</span>
          </div>
          <p className="text-xs text-rose-200 leading-relaxed">
            {settlementPlan.explanation}
          </p>
        </div>
      )}

      {/* UNALLOCATED BOARD FUNDS INTERFACE (Core Rule #6) */}
      {boardBalancePaise > 0 && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-amber-950/30 border border-amber-500/40 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <Landmark size={20} />
              <span>UNALLOCATED GAME FUNDS: {formatPaise(boardBalancePaise)}</span>
            </div>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
              SEPARATE BOARD ACCOUNT
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            The board account still holds <strong>{formatPaise(boardBalancePaise)}</strong> in remaining game funds.
            Under strict accounting invariants, <em>money remaining in the board is never treated as automatically belonging to players</em>.
            Confirm how you want to handle these remaining board funds:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Action 1: Distribute Equally */}
            <button
              onClick={() => resolveBoardAllocation('DISTRIBUTE_EQUAL')}
              className="p-4 rounded-xl bg-slate-950/80 hover:bg-slate-950 border border-emerald-500/30 hover:border-emerald-500 text-left transition-all cursor-pointer space-y-1.5 group"
            >
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <Gift size={15} />
                <span>Distribute to Players</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Credit remaining {formatPaise(boardBalancePaise)} equally among all {state.players.length} players ({formatPaise(Math.floor(boardBalancePaise / state.players.length))} each) and debit board to ₹0.
              </p>
            </button>

            {/* Action 2: Refund to External / Rake */}
            <button
              onClick={() => resolveBoardAllocation('REFUND_EXTERNAL')}
              className="p-4 rounded-xl bg-slate-950/80 hover:bg-slate-950 border border-blue-500/30 hover:border-blue-500 text-left transition-all cursor-pointer space-y-1.5 group"
            >
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
                <Landmark size={15} />
                <span>Refund / House Rake</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Debit board and return {formatPaise(boardBalancePaise)} to the external organizer or table rake account.
              </p>
            </button>

            {/* Action 3: Settle As-Is (Acknowledge Board Retains Funds) */}
            <button
              onClick={() => resolveBoardAllocation('CONFIRM_AS_IS')}
              className="p-4 rounded-xl bg-slate-950/80 hover:bg-slate-950 border border-amber-500/30 hover:border-amber-500 text-left transition-all cursor-pointer space-y-1.5 group"
            >
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <CheckCircle size={15} />
                <span>Board Retains Funds</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Confirm {formatPaise(boardBalancePaise)} stays unallocated in board account and proceed with player-to-player transfers.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* FINAL SETTLEMENT PLAN: Greedy Matching Result */}
      {settlementPlan.status === 'READY' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <span>Minimal Cash Transfers</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                    {settlementPlan.transfers.length} TRANSFER{settlementPlan.transfers.length === 1 ? '' : 'S'} REQUIRED
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Greedy debtor-creditor algorithm optimizes debt cancellation to settle all player accounts in minimum transactions.
                </p>
              </div>

              {totalTransfers > 0 && (
                <div className="text-xs font-mono text-slate-300 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  Progress: <span className="text-emerald-400 font-bold">{completedCount} of {totalTransfers}</span> Paid ({totalTransfers > 0 ? Math.round((completedCount / totalTransfers) * 100) : 100}%)
                </div>
              )}
            </div>

            {totalTransfers === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                <ShieldCheck size={36} className="mx-auto text-emerald-400" />
                <p className="font-bold text-sm text-white">All Accounts Perfectly Balanced!</p>
                <p className="text-slate-500">
                  Every player's net position is zero. No money needs to change hands.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {settlementPlan.transfers.map((transfer, index) => {
                  const fromPlayer = state.players.find(p => p.id === transfer.fromPlayerId)
                  const toPlayer = state.players.find(p => p.id === transfer.toPlayerId)
                  const isDone = completedTransferIds.has(transfer.id)

                  return (
                    <div
                      key={transfer.id}
                      onClick={() => toggleSettlementTransfer(transfer.id)}
                      className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all cursor-pointer ${
                        isDone
                          ? 'bg-emerald-950/15 border-emerald-500/30 opacity-75'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Interactive Checkbox */}
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                            isDone
                              ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                              : 'border-slate-600 bg-slate-900'
                          }`}
                        >
                          {isDone && <Check size={13} className="stroke-[3]" />}
                        </div>

                        <span className="font-mono text-xs text-slate-500 shrink-0">
                          #{index + 1}
                        </span>

                        {/* From Player */}
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-slate-950 shrink-0"
                            style={{ backgroundColor: fromPlayer?.avatarColor || '#94a3b8' }}
                          >
                            {fromPlayer?.name.charAt(0) || '?'}
                          </div>
                          <div className="truncate">
                            <span className="font-bold text-white text-xs block truncate">
                              {fromPlayer?.name || 'Unknown'}
                            </span>
                            <span className="text-[10px] font-mono text-rose-400 block">
                              Debtor (Owes)
                            </span>
                          </div>
                        </div>

                        {/* Arrow */}
                        <div className="flex items-center gap-1 text-slate-500 shrink-0 px-1">
                          <span className="text-[11px] font-mono hidden sm:inline">PAYS</span>
                          <ArrowRight size={14} className="text-emerald-400" />
                        </div>

                        {/* To Player */}
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-slate-950 shrink-0"
                            style={{ backgroundColor: toPlayer?.avatarColor || '#94a3b8' }}
                          >
                            {toPlayer?.name.charAt(0) || '?'}
                          </div>
                          <div className="truncate">
                            <span className="font-bold text-white text-xs block truncate">
                              {toPlayer?.name || 'Unknown'}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 block">
                              Creditor (Receives)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Transfer Amount */}
                      <div className="text-right shrink-0">
                        <div
                          className={`text-lg font-black font-mono tracking-tight ${
                            isDone ? 'text-emerald-400 line-through' : 'text-emerald-300'
                          }`}
                        >
                          {formatPaise(transfer.amountPaise)}
                        </div>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                            isDone
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {isDone ? 'COMPLETED' : 'CLICK TO MARK PAID'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
