import React, { useState } from 'react'
import { useGame } from '../context/GameContext'
import { formatPaise } from '../utils/money'
import { CoinsLedgerLogo } from './CoinsLedgerLogo'
import {
  Coins,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Play,
  Trophy,
  History,
  CheckCircle2,
  X,
  Check,
  ArrowUpRight,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'

export const Header: React.FC = () => {
  const {
    state,
    completedRoundsCount,
    boardMoneyPaise,
    boardBalancePaise,
    currentTab,
    setCurrentTab,
    loadDemoGame,
    resetGame,
    updateGameName,
    activeRound,
  } = useGame()

  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)

  const activePlayersCount = state.players.filter(p => p.isActive !== false).length

  return (
    <>
      {/* Main Navbar */}
      <header className="border-b border-[#D8D8D8] bg-white/95 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3.5">
          <div className="flex flex-row items-center justify-between gap-2 md:gap-4">

            {/* Left: Coins Ledger Official Logo */}
            <div className="flex items-center gap-4">
              <div 
                onClick={() => setCurrentTab('play')} 
                className="cursor-pointer transition-transform hover:scale-[1.02]"
              >
                <CoinsLedgerLogo />
              </div>
            </div>

            {/* Right: Live Metrics & Quick Actions */}
            <div className="flex items-center gap-2 md:gap-2.5 shrink-0">

              {/* Table Status Pill */}
              <div className="hidden sm:flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-[#F8F8F8] border border-[#D8D8D8] text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#B6EA84] border border-[#194220] animate-pulse" />
                  <span className="text-[#616161] text-[11px]">BOARD POT:</span>
                  <span className="font-black text-[#194220]">{formatPaise(boardBalancePaise)}</span>
                </div>
                <span className="text-[#D8D8D8]">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[#616161] text-[11px]">BOARD FEE PER HEAD:</span>
                  <span className="font-bold text-black">{formatPaise(boardMoneyPaise)}</span>
                </div>
              </div>

              {/* Load Demo Button */}
              <button
                onClick={loadDemoGame}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#F8F8F8] hover:bg-black hover:text-white text-black border border-[#D8D8D8] hover:border-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Load sample cards game with completed rounds"
              >
                <Sparkles size={13} className="text-[#194220]" />
                <span>Load Demo</span>
              </button>

              {/* Help & Guide Button */}
              <button
                onClick={() => setShowHelpModal(true)}
                className="w-8 h-8 rounded-full bg-[#F8F8F8] border border-[#D8D8D8] text-[#616161] hover:text-black hover:border-black flex items-center justify-center transition-colors cursor-pointer"
                title="How to play & accounting rules"
              >
                <HelpCircle size={15} />
              </button>

              {/* Reset Game Button */}
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-8 h-8 rounded-full bg-[#F8F8F8] border border-[#D8D8D8] text-[#616161] hover:text-[#EB5757] hover:border-[#EB5757] flex items-center justify-center transition-colors cursor-pointer"
                title="Reset game state"
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </div>

          {/* Navigation Bar Tabs */}
          <nav className="flex items-center gap-1.5 sm:gap-2 mt-2 pt-2 sm:mt-3 sm:pt-3 border-t border-[#D8D8D8] text-xs font-mono">
            <button
              onClick={() => setCurrentTab('play')}
              className={`px-2 sm:px-4 py-2 rounded-[12px] transition-all whitespace-nowrap cursor-pointer flex flex-1 sm:flex-initial items-center justify-center gap-2 font-bold ${
                currentTab === 'play' || currentTab === 'overview'
                  ? 'bg-black text-white shadow-sm font-black'
                  : 'text-[#616161] hover:text-black hover:bg-[#F0F0F0]'
              }`}
            >
              <Play size={13} className={currentTab === 'play' || currentTab === 'overview' ? 'fill-current' : ''} />
              <span className="sm:hidden">PLAY</span>
              <span className="hidden sm:inline">PLAY DECK</span>
            </button>

            <button
              onClick={() => setCurrentTab('rounds')}
              className={`px-2 sm:px-4 py-2 rounded-[12px] transition-all whitespace-nowrap cursor-pointer flex flex-1 sm:flex-initial items-center justify-center gap-2 font-bold ${
                currentTab === 'rounds'
                  ? 'bg-black text-white shadow-sm font-black'
                  : 'text-[#616161] hover:text-black hover:bg-[#F0F0F0]'
              }`}
            >
              <History size={13} />
              <span className="sm:hidden">ROUNDS</span>
              <span className="hidden sm:inline">ROUNDS TIMELINE</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                currentTab === 'rounds' ? 'bg-[#B6EA84] text-black' : 'bg-[#E5E5E5] text-[#404040]'
              }`}>
                {state.rounds.length}
              </span>
            </button>

            <button
              onClick={() => setCurrentTab('settlement')}
              className={`px-2 sm:px-4 py-2 rounded-[12px] transition-all whitespace-nowrap cursor-pointer flex flex-1 sm:flex-initial items-center justify-center gap-2 font-bold ${
                currentTab === 'settlement'
                  ? 'bg-black text-white shadow-sm font-black'
                  : 'text-[#616161] hover:text-black hover:bg-[#F0F0F0]'
              }`}
            >
              <Coins size={13} />
              <span className="sm:hidden">SETTLE</span>
              <span className="hidden sm:inline">FINAL SETTLEMENT</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border-2 border-black w-full max-w-md p-6 rounded-[20px] space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
              <div className="flex items-center gap-2.5 text-[#EB5757]">
                <div className="w-8 h-8 rounded-full bg-[#EB5757]/15 border border-[#EB5757]/30 flex items-center justify-center shrink-0">
                  <RotateCcw size={16} className="text-[#EB5757]" />
                </div>
                <h3 className="font-black text-base text-black">Reset Scoreboard & Rounds?</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="p-1 rounded-full text-[#616161] hover:text-black hover:bg-[#F0F0F0] cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[#616161] leading-relaxed">
              This will clear all completed rounds, transactions, and player balance history. A fresh board pot session will begin with the starting Board Fee.
            </p>

            <div className="p-3 rounded-[14px] bg-[#FFF5F5] border border-[#EB5757]/20 text-xs text-[#EB5757] font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#EB5757] shrink-0" />
              <span>Warning: This cannot be undone. All game history will be erased.</span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-full text-xs font-bold text-[#616161] hover:text-black hover:bg-[#F0F0F0] border border-[#D8D8D8] cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetGame()
                  setShowResetConfirm(false)
                }}
                className="px-4 py-2 rounded-full text-xs font-black bg-[#EB5757] hover:bg-[#d64141] text-white border border-black cursor-pointer shadow-sm transition-colors"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help / Rules Guide Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border-2 border-black w-full max-w-lg p-6 sm:p-7 rounded-[20px] space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[8px] bg-[#B6EA84] text-black border border-black flex items-center justify-center font-bold">
                  <ShieldCheck size={16} />
                </div>
                <h3 className="font-black text-base text-black">How Coins Ledger Works</h3>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1.5 rounded-full text-[#616161] hover:text-black hover:bg-[#F0F0F0] cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#404040] leading-relaxed">
              <div className="p-3.5 rounded-[14px] bg-[#F8F8F8] border border-[#D8D8D8] space-y-1">
                <strong className="text-black block font-mono uppercase text-[11px]">1. Round Board Fee</strong>
                <p className="text-[#616161]">Before cards are dealt, every active player contributes the agreed board fee (₹2, ₹5, ₹10, ₹50, etc.). The board pot begins with all fees combined.</p>
              </div>

              <div className="p-3.5 rounded-[14px] bg-[#F8F8F8] border border-[#D8D8D8] space-y-1">
                <strong className="text-black block font-mono uppercase text-[11px]">2. Partial Board Betting</strong>
                <p className="text-[#616161]">Players do not have to win the entire pot in one turn. When it is their turn, they declare how much of the remaining board money they wish to bet (25%, 50%, 75%, or Full Pot).</p>
                <p className="text-[#616161]">• If they <strong className="text-[#194220]">WIN</strong>: They take their declared bet amount from the board pot.</p>
                <p className="text-[#616161]">• If they <strong className="text-[#EB5757]">LOSE</strong>: They pay their bet amount into the board pot (pot increases).</p>
              </div>

              <div className="p-3.5 rounded-[14px] bg-[#F8F8F8] border border-[#D8D8D8] space-y-1">
                <strong className="text-black block font-mono uppercase text-[11px]">3. Consecutive Numbers Rule (61, 62)</strong>
                <p className="text-[#616161]">If consecutive numbers/cards appear (e.g. 61, 62), all transactions that occurred in that round are completely cancelled and refunded back to pre-round state.</p>
              </div>

              <div className="p-3.5 rounded-[14px] bg-[#F8F8F8] border border-[#D8D8D8] space-y-1">
                <strong className="text-black block font-mono uppercase text-[11px]">4. Automated Multi-Round Accounting</strong>
                <p className="text-[#616161]">Completed rounds, fees paid, payouts won, and live net balances are calculated automatically in integer paise precision with 100% mathematical zero-sum verification.</p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E5E5E5] flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 rounded-full text-xs font-black bg-[#B6EA84] hover:bg-[#a5db71] text-black border border-black cursor-pointer shadow-sm transition-colors"
              >
                Got It!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
