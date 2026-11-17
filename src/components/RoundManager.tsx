import React, { useState } from 'react'
import { useGame } from '../context/GameContext'
import { formatPaise } from '../utils/money'
import {
  Trophy,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  Ban,
} from 'lucide-react'

export const RoundManager: React.FC = () => {
  const {
    state,
    boardMoneyPaise,
    boardBalancePaise,
    undoRound,
    setCurrentTab,
  } = useGame()

  const [confirmUndoId, setConfirmUndoId] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL')

  const players = state.players
  const rounds = state.rounds

  const handleConfirmUndo = (roundId: string) => {
    undoRound(roundId)
    setConfirmUndoId(null)
  }

  const filteredRounds = [...rounds].reverse().filter(r => {
    if (filterMode === 'COMPLETED') return r.status === 'COMPLETED'
    if (filterMode === 'CANCELLED') return r.status === 'CANCELLED'
    return true
  })

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header Hero Card - BentoML dark green styling */}
      <div className="bg-[#152822] text-white border border-black rounded-[20px] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative overflow-hidden shadow-sm">
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest uppercase font-black text-black bg-[#B6EA84] px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
              TIMELINE ENGINE
            </span>
            <span className="text-xs text-[#D0E6D6]/80 font-mono">100% Zero-Sum Accuracy</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Rounds & Match Timeline
          </h1>
          <p className="text-xs sm:text-sm text-[#D0E6D6]/80 max-w-lg leading-relaxed">
            Accurate chronological record of every starting Board Fee, declared bet from the board pot, won/lost payouts, and consecutive-number cancellations.
          </p>
        </div>

        <button
          onClick={() => setCurrentTab('play')}
          className="px-5 py-2.5 rounded-full bg-[#B6EA84] hover:bg-[#a5db71] text-black font-black text-xs flex items-center gap-2 transition-transform hover:scale-[1.02] cursor-pointer shadow-sm self-start sm:self-auto shrink-0 border border-black"
        >
          <ArrowLeft size={15} className="text-black stroke-[3]" />
          <span>Back to Play Deck</span>
        </button>
      </div>

      {/* Filter Tabs & Quick Stat */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 p-1 rounded-full bg-white border border-[#D8D8D8]">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3.5 py-1.5 rounded-full font-mono text-xs transition-all cursor-pointer ${
              filterMode === 'ALL'
                ? 'bg-black text-white font-black shadow-sm'
                : 'text-[#616161] hover:text-black font-bold'
            }`}
          >
            All ({rounds.length})
          </button>
          <button
            onClick={() => setFilterMode('COMPLETED')}
            className={`px-3.5 py-1.5 rounded-full font-mono text-xs transition-all cursor-pointer ${
              filterMode === 'COMPLETED'
                ? 'bg-black text-white font-black shadow-sm'
                : 'text-[#616161] hover:text-black font-bold'
            }`}
          >
            Completed ({rounds.filter(r => r.status === 'COMPLETED').length})
          </button>
          <button
            onClick={() => setFilterMode('CANCELLED')}
            className={`px-3.5 py-1.5 rounded-full font-mono text-xs transition-all cursor-pointer ${
              filterMode === 'CANCELLED'
                ? 'bg-[#EB5757] text-white font-black shadow-sm'
                : 'text-[#616161] hover:text-black font-bold'
            }`}
          >
            Cancelled / Voided ({rounds.filter(r => r.status === 'CANCELLED').length})
          </button>
        </div>

        <span className="text-[11px] font-mono text-[#616161] hidden sm:inline">
          Board Money: <strong className="text-[#194220] font-bold">{formatPaise(boardBalancePaise)}</strong>
        </span>
      </div>

      {/* Rounds Timeline List */}
      {filteredRounds.length === 0 ? (
        <div className="p-12 rounded-[20px] bg-white border border-[#D8D8D8] text-center space-y-3">
          <Trophy size={32} className="text-[#888888] mx-auto" />
          <h3 className="text-base font-black text-black">No Rounds Found</h3>
          <p className="text-xs text-[#616161]">Play rounds in the main deck to build your timeline.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRounds.map((round) => {
            const isCancelled = round.status === 'CANCELLED'
            const isActive = round.status === 'ACTIVE'
            const roundTxs = state.transactions.filter(t => t.roundId === round.id)
            const bets = roundTxs.filter(t => t.category === 'BOARD_PAYOUT' || (t.category === 'PLAYER_CONTRIBUTION' && !t.notes?.includes('board fee')))
            const anteTxs = roundTxs.filter(t => t.category === 'PLAYER_CONTRIBUTION' && t.notes?.includes('board fee'))

            return (
              <div
                key={round.id}
                className={`p-5 sm:p-6 rounded-[20px] transition-all ${
                  isCancelled
                    ? 'bg-[#FFF5F5] border border-[#EB5757]/40'
                    : isActive
                    ? 'bento-card-white bg-white border-2 border-black shadow-md'
                    : 'bento-card-white bg-white border border-[#D8D8D8]'
                }`}
              >
                {/* Round Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E5E5] pb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-sm font-black font-mono text-black">
                      Round #{round.roundNumber}
                    </span>

                    {/* Status Pill */}
                    {isCancelled ? (
                      <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#EB5757]/15 text-[#EB5757] border border-[#EB5757]/30 flex items-center gap-1">
                        <Ban size={10} />
                        VOIDED / CANCELLED (61, 62)
                      </span>
                    ) : isActive ? (
                      <span className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full bg-[#B6EA84] text-black border border-black flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                        ACTIVE ROUND
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#F0F0F0] text-[#616161] border border-[#D8D8D8]">
                        COMPLETED
                      </span>
                    )}

                    {round.completedAt && (
                      <span className="text-[11px] text-[#888888] font-mono">
                        {new Date(round.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {/* Actions / Undo */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {confirmUndoId === round.id ? (
                      <div className="flex items-center gap-1 bg-white p-1 rounded-full border border-black text-xs shadow-md">
                        <span className="text-[11px] text-black px-2 font-bold">Delete?</span>
                        <button
                          type="button"
                          onClick={() => handleConfirmUndo(round.id)}
                          className="px-2.5 py-1 bg-[#EB5757] hover:bg-[#d94848] text-white rounded-full font-bold cursor-pointer"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmUndoId(null)}
                          className="px-2 py-1 text-[#616161] hover:text-black cursor-pointer font-bold"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmUndoId(round.id)}
                        className="p-1.5 text-[#888888] hover:text-[#EB5757] transition-colors cursor-pointer"
                        title="Delete round"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Cancelled Notice Banner */}
                {isCancelled && (
                  <div className="my-3 p-3.5 rounded-[14px] bg-[#EB5757]/10 border border-[#EB5757]/30 text-xs text-[#EB5757] flex items-start gap-2.5">
                    <Ban size={16} className="shrink-0 mt-0.5 text-[#EB5757]" />
                    <div>
                      <strong className="block text-black font-bold">Round Cancelled (Consecutive Cards / Numbers)</strong>
                      <span className="text-[#616161]">{round.cancellationReason || round.notes || 'Consecutive cards shown (e.g. 61, 62). All bets and transactions voided.'}</span>
                    </div>
                  </div>
                )}

                {/* Board Fee & Bet Stats */}
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[#616161] font-mono text-[11px]">
                    <span>Round Board Fee: <strong className="text-[#194220] font-bold">{formatPaise(round.boardMoneyPaise || boardMoneyPaise)}</strong> ({anteTxs.length} players contributed)</span>
                    <span>{bets.length} {bets.length === 1 ? 'bet action' : 'bet actions'}</span>
                  </div>

                  {/* Play-by-play Bet Feed */}
                  {bets.length > 0 ? (
                    <div className="space-y-1.5 bg-[#F8F8F8] p-3 rounded-[14px] border border-[#E5E5E5]">
                      {bets.map((tx, idx) => {
                        const isWon = tx.category === 'BOARD_PAYOUT'
                        const pEntry = tx.entries.find(e => e.accountId.startsWith('ACCOUNT_PLAYER_'))
                        const pId = pEntry?.accountId.replace('ACCOUNT_PLAYER_', '')
                        const player = players.find(p => p.id === pId)
                        const amt = pEntry?.amountPaise || 0

                        return (
                          <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-[#E5E5E5] last:border-0 font-mono text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-[#888888]">#{idx + 1}</span>
                              <span className={`w-1.5 h-1.5 rounded-full ${isWon ? 'bg-[#194220]' : 'bg-[#EB5757]'}`} />
                              <span className="font-sans font-bold text-black">{player?.name || 'Player'}</span>
                              <span className="text-[#616161] text-[11px] font-sans">
                                {isWon ? 'won declared bet' : 'lost declared bet'}
                              </span>
                            </div>
                            <span className={`font-bold ${isWon ? 'text-[#194220]' : 'text-[#EB5757]'}`}>
                              {isWon ? `+${formatPaise(amt)}` : `-${formatPaise(amt)}`}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : !isCancelled ? (
                    <div className="text-[11px] text-[#616161] font-mono py-1">
                      No declared bets placed during this round.
                    </div>
                  ) : null}

                  {/* Player Round Net Summary (How much each person got or lost in this round) */}
                  {!isCancelled && (
                    <div className="pt-2 border-t border-[#E5E5E5]">
                      <div className="text-[10px] font-mono text-[#616161] uppercase tracking-wider mb-1.5 font-bold">
                        Round Net Summary:
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {players.map(p => {
                          const paidInRound = roundTxs
                            .filter(t => t.category === 'PLAYER_CONTRIBUTION' && t.entries.some(e => e.accountId === `ACCOUNT_PLAYER_${p.id}`))
                            .reduce((sum, t) => {
                              const e = t.entries.find(entry => entry.accountId === `ACCOUNT_PLAYER_${p.id}`)
                              return sum + (e?.amountPaise || 0)
                            }, 0)
                          const wonInRound = roundTxs
                            .filter(t => t.category === 'BOARD_PAYOUT' && t.entries.some(e => e.accountId === `ACCOUNT_PLAYER_${p.id}`))
                            .reduce((sum, t) => {
                              const e = t.entries.find(entry => entry.accountId === `ACCOUNT_PLAYER_${p.id}`)
                              return sum + (e?.amountPaise || 0)
                            }, 0)
                          const roundNet = wonInRound - paidInRound

                          if (paidInRound === 0 && wonInRound === 0) return null

                          return (
                            <div
                              key={p.id}
                              className="p-2 rounded-[10px] bg-[#F8F8F8] border border-[#E5E5E5] text-[11px] font-mono flex items-center justify-between"
                            >
                              <span className="font-sans font-bold text-black truncate max-w-[80px]">
                                {p.name}
                              </span>
                              <span
                                className={`font-bold ${
                                  roundNet > 0
                                    ? 'text-[#194220]'
                                    : roundNet < 0
                                    ? 'text-[#EB5757]'
                                    : 'text-[#888888]'
                                }`}
                              >
                                {roundNet > 0 ? `+${formatPaise(roundNet)}` : formatPaise(roundNet)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
