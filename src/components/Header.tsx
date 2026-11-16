import React, { useState } from 'react'
import { useGame } from '../context/GameContext'
import { formatPaise } from '../utils/money'
import {
  Scale,
  Landmark,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  CheckCircle,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'

export const Header: React.FC = () => {
  const {
    state,
    boardBalancePaise,
    currentTab,
    setCurrentTab,
    loadDemoGame,
    resetGame,
    overview,
  } = useGame()

  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Brand & Game Meta */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20">
              <Scale size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-lg text-white tracking-tight">CoinLedger</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  DOUBLE-ENTRY
                </span>
                <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                  {overview.isReconciled ? '✓ Reconciled' : '✕ Unbalanced'}
                </span>
              </div>
              <div className="text-xs text-slate-400 truncate max-w-xs sm:max-w-md">
                {state.gameName} · {state.players.length} Players · Round {state.rounds.length}
              </div>
            </div>
          </div>

          {/* Quick Actions & Board Balance Badge */}
          <div className="flex items-center gap-3 self-end md:self-auto flex-wrap">
            {/* Live Board Balance Pill */}
            <div
              onClick={() => setCurrentTab('overview')}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2 cursor-pointer hover:border-slate-700 transition-colors"
              title="Click to view Accounting Overview"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div className="text-left font-mono text-xs">
                <span className="text-[10px] text-slate-400 block uppercase tracking-wider leading-none">
                  Board Balance
                </span>
                <span className="font-bold text-white text-sm">
                  {formatPaise(boardBalancePaise)}
                </span>
              </div>
            </div>

            {/* Demo Data button */}
            <button
              onClick={loadDemoGame}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Load demo game with completed rounds, payouts, and transfers"
            >
              <Sparkles size={13} className="text-amber-400" />
              <span>Load Demo Game</span>
            </button>

            {/* Help / Guide */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Accounting Rules Guide"
            >
              <HelpCircle size={16} />
            </button>

            {/* Reset */}
            <button
              onClick={() => setShowResetConfirm(true)}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="Reset Game to New Ledger"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800/80 overflow-x-auto no-scrollbar text-xs font-mono">
          <button
            onClick={() => setCurrentTab('overview')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'overview'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            Accounting Overview
          </button>
          <button
            onClick={() => setCurrentTab('rounds')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              currentTab === 'rounds'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <span>Round Entry & Actions</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30">
              R{state.rounds.length}
            </span>
          </button>
          <button
            onClick={() => setCurrentTab('ledger')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              currentTab === 'ledger'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <span>Audit Journal & Ledger</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30">
              {state.transactions.length}
            </span>
          </button>
          <button
            onClick={() => setCurrentTab('settlement')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              currentTab === 'settlement'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <span>Final Settlement</span>
            {boardBalancePaise > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>
          <button
            onClick={() => setCurrentTab('funding')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'funding'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            Capital & Funding
          </button>
        </nav>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md p-6 rounded-2xl space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-white">Reset Game Ledger?</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will clear all transactions, rounds, and player balances. A clean ledger will be initialized.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetGame()
                  setShowResetConfirm(false)
                }}
                className="px-3.5 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-lg shadow-rose-600/20"
              >
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accounting Guide Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl p-6 rounded-2xl space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Scale size={18} className="text-emerald-400" />
                <span>CoinLedger Core Accounting Rules</span>
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                [Close ✕]
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed font-sans">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <strong className="text-white block font-mono text-[11px] text-emerald-400 uppercase">
                  1. Player Contribution to Board
                </strong>
                <p>Debit Player Account, Credit Board Account under the same transaction ID.</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <strong className="text-white block font-mono text-[11px] text-emerald-400 uppercase">
                  2. Board Payout to Player
                </strong>
                <p>Debit Board Account, Credit Player Account under the same transaction ID.</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <strong className="text-white block font-mono text-[11px] text-emerald-400 uppercase">
                  3. Player-to-Player Transfer
                </strong>
                <p>Debit Sender Account, Credit Receiver Account. Board is untouched.</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <strong className="text-white block font-mono text-[11px] text-emerald-400 uppercase">
                  4. The Board is an Account, Not a Player
                </strong>
                <p>
                  Money remaining in the board is unallocated game funds and never automatically distributed.
                  Negative board balances are blocked by invariant checks.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <strong className="text-white block font-mono text-[11px] text-emerald-400 uppercase">
                  5. Integer Paise Math
                </strong>
                <p>All calculations use 64-bit integer paise. Floating-point currency math is prohibited.</p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
