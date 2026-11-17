import React, { useState } from 'react'
import { useGame } from '../context/GameContext'
import { formatPaise } from '../utils/money'
import { shareOrDownloadReceipt } from '../utils/receiptGenerator'
import {
  Coins,
  CheckCircle2,
  Check,
  ArrowRight,
  Trophy,
  Landmark,
  ArrowUpRight,
  ShieldCheck,
  Download,
  Image,
} from 'lucide-react'

export const FinalSettlementView: React.FC = () => {
  const {
    state,
    settlementPlan,
    boardBalancePaise,
    playerSummaries,
    resolveBoardAllocation,
    toggleSettlementTransfer,
    settleAllAndCloseGame,
    completedRoundsCount,
    boardMoneyPaise,
    setCurrentTab,
  } = useGame()

  const [isGeneratingPng, setIsGeneratingPng] = useState(false)
  const [pngSuccessMsg, setPngSuccessMsg] = useState<string | null>(null)

  const players = state.players

  // Track completed settlement transfer IDs
  const completedTransferIds = new Set(
    state.settlementTransfers.filter(t => t.completed).map(t => t.id)
  )

  const handleSharePng = async () => {
    setIsGeneratingPng(true)
    try {
      const result = await shareOrDownloadReceipt({
        gameName: state.gameName,
        completedRoundsCount,
        boardMoneyPaise,
        players,
        playerSummaries,
        transfers: settlementPlan.transfers,
        completedTransferIds,
      })
      setPngSuccessMsg(result === 'shared' ? 'Receipt Shared!' : 'High-Res PNG Saved!')
      setTimeout(() => setPngSuccessMsg(null), 3500)
    } catch (err) {
      console.error('Failed to generate PNG receipt', err)
    } finally {
      setIsGeneratingPng(false)
    }
  }

  const completedCount = settlementPlan.transfers.filter(t => completedTransferIds.has(t.id)).length
  const totalTransfers = settlementPlan.transfers.length
  const allSettled = totalTransfers > 0 && completedCount === totalTransfers

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Coins Ledger Header Hero Card - BentoML dark green styling */}
      <div className="bg-[#152822] text-white border border-black rounded-[20px] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden shadow-sm">
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest font-black text-black bg-[#B6EA84] px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
              MINIMUM TRANSFERS
            </span>
            <span className="text-xs text-[#D0E6D6]/80 font-mono">Coins Ledger Cash Out</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Final Settlement & Cash Out
          </h1>
          <p className="text-xs sm:text-sm text-[#D0E6D6]/80 max-w-xl leading-relaxed">
            All debts are mathematically optimized into the absolute minimum direct peer-to-peer payments so everyone settles with single-digit transactions and zero balance.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap relative z-10">
          {!allSettled && totalTransfers > 0 && (
            <button
              onClick={settleAllAndCloseGame}
              className="px-4 py-2.5 rounded-full bg-[#B6EA84] hover:bg-[#a5db71] text-black font-black text-xs flex items-center gap-2 transition-transform hover:scale-[1.02] cursor-pointer shadow-sm border border-black"
              title="Record all pending payments and close the game at ₹0 balance"
            >
              <CheckCircle2 size={15} />
              <span>Settle All & Close Game</span>
            </button>
          )}

          {/* High-Quality PNG Share Button */}
          <button
            onClick={handleSharePng}
            disabled={isGeneratingPng}
            className="px-4 py-2.5 rounded-full bg-[#B6EA84] hover:bg-[#a5db71] text-black border border-black font-black text-xs flex items-center gap-2 transition-transform hover:scale-[1.02] cursor-pointer shadow-sm disabled:opacity-50"
            title="Download or share high-resolution PNG receipt with leaderboard and who owes whom"
          >
            <Download size={14} className="text-black" />
            <span>{isGeneratingPng ? 'Generating PNG...' : pngSuccessMsg || 'Share PNG Receipt'}</span>
          </button>

          <button
            onClick={() => setCurrentTab('play')}
            className="px-4 py-2.5 rounded-full bg-transparent hover:bg-white/10 text-white border border-white/20 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span>← Play Deck</span>
          </button>
        </div>
      </div>

      {/* Zero Balance / All Settled Celebratory Banner */}
      {allSettled && (
        <div className="p-5 sm:p-6 rounded-[20px] bg-[#D0E6D6] border-2 border-black flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm text-[#152822]">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-[#B6EA84] border border-black text-black flex items-center justify-center font-bold shrink-0 shadow-sm">
              <ShieldCheck size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-[#152822]">
                  Game Officially Closed
                </h3>
                <span className="text-[10px] font-mono font-black bg-[#152822] text-[#B6EA84] px-2.5 py-0.5 rounded-full">
                  ₹0.00 ZERO BALANCE
                </span>
              </div>
              <p className="text-xs text-[#194220] mt-1">
                All peer-to-peer debts have been received and paid. Every player's final balance is exactly ₹0.00.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={handleSharePng}
              disabled={isGeneratingPng}
              className="pl-4 pr-1.5 py-1.5 rounded-full bg-black text-[#B6EA84] font-black text-xs flex items-center gap-2 cursor-pointer shadow-sm shrink-0 border border-black disabled:opacity-50 transition-transform hover:scale-[1.02]"
            >
              <Download size={14} />
              <span>{isGeneratingPng ? 'Generating PNG...' : 'Share PNG Receipt'}</span>
              <div className="w-6 h-6 rounded-full bg-[#B6EA84] text-black flex items-center justify-center">
                <ArrowRight size={12} />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Quick Game Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-[20px] bento-card-white bg-white border border-[#D8D8D8]">
          <span className="text-[10px] font-mono text-[#616161] uppercase tracking-wider block font-bold">
            Rounds Completed
          </span>
          <span className="text-xl font-black font-mono text-black mt-0.5 block">
            {completedRoundsCount}
          </span>
        </div>

        <div className="p-4 rounded-[20px] bento-card-white bg-white border border-[#D8D8D8]">
          <span className="text-[10px] font-mono text-[#616161] uppercase tracking-wider block font-bold">
            Board Fee / Round
          </span>
          <span className="text-xl font-black font-mono text-[#194220] mt-0.5 block">
            {formatPaise(boardMoneyPaise)}
          </span>
        </div>

        <div className="p-4 rounded-[20px] bento-card-white bg-white border border-[#D8D8D8]">
          <span className="text-[10px] font-mono text-[#616161] uppercase tracking-wider block font-bold">
            Payments Needed
          </span>
          <span className="text-xl font-black font-mono text-black mt-0.5 block">
            {totalTransfers} {totalTransfers === 1 ? 'Transfer' : 'Transfers'}
          </span>
        </div>

        <div className="p-4 rounded-[20px] bento-card-white bg-white border border-[#D8D8D8]">
          <span className="text-[10px] font-mono text-[#616161] uppercase tracking-wider block font-bold">
            Settlement Status
          </span>
          <span className="text-xl font-black font-mono text-black mt-0.5 block">
            {allSettled ? 'All Paid ✓' : `${completedCount} / ${totalTransfers} Paid`}
          </span>
        </div>
      </div>

      {/* Residual Board Funds Alert (If any) */}
      {boardBalancePaise > 0 && (
        <div className="p-5 rounded-[20px] bg-white border-2 border-black space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-black font-black text-sm">
              <Landmark size={18} className="text-[#194220]" />
              <span>Board Pot has Remaining Funds: {formatPaise(boardBalancePaise)}</span>
            </div>
            <span className="text-xs font-mono text-[#616161] font-bold">
              {formatPaise(Math.floor(boardBalancePaise / Math.max(1, players.length)))} per player
            </span>
          </div>

          <p className="text-xs text-[#616161]">
            There is money remaining in the central Board Pot. You can distribute it equally among all players with 1 click before finalizing payments:
          </p>

          <div className="flex gap-2 flex-wrap pt-1">
            <button
              onClick={() => resolveBoardAllocation('DISTRIBUTE_EQUAL')}
              className="px-4 py-2 rounded-full text-xs font-black bg-[#B6EA84] hover:bg-[#a5db71] text-black border border-black transition-transform hover:scale-[1.02] cursor-pointer shadow-sm"
            >
              Distribute Equally to All Players
            </button>
            <button
              onClick={() => resolveBoardAllocation('CONFIRM_AS_IS')}
              className="px-4 py-2 rounded-full text-xs font-bold bg-[#F8F8F8] hover:bg-[#EAEAEA] text-black border border-[#D8D8D8] transition-colors cursor-pointer"
            >
              Keep in Board Pot
            </button>
          </div>
        </div>
      )}

      {/* MAIN CARDS: Who Pays Whom */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-black flex items-center gap-2">
            <Coins size={18} className="text-[#194220]" />
            <span>Direct Payment Instructions</span>
          </h2>
          <span className="text-xs text-[#616161] font-mono">
            Click any transfer to toggle "Paid"
          </span>
        </div>

        {totalTransfers === 0 ? (
          <div className="p-8 rounded-[20px] bg-white border border-[#D8D8D8] text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#B6EA84] border border-black text-black flex items-center justify-center mx-auto">
              <CheckCircle2 size={28} />
            </div>
            <h3 className="text-base font-black text-black">Everyone is Even!</h3>
            <p className="text-xs text-[#616161] max-w-sm mx-auto">
              {completedRoundsCount === 0
                ? 'No rounds played yet. Start playing rounds to generate live settlements.'
                : 'All player balances are completely settled. No one owes anyone anything!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settlementPlan.transfers.map((t, index) => {
              const fromPlayer = players.find(p => p.id === t.fromPlayerId)
              const toPlayer = players.find(p => p.id === t.toPlayerId)
              const isPaid = completedTransferIds.has(t.id)
              const amountRupees = (t.amountPaise / 100).toFixed(0)

              // UPI payment intent link (Standard Indian UPI)
              const upiPayLink = `upi://pay?pn=${encodeURIComponent(toPlayer?.name || 'Player')}&am=${amountRupees}&cu=INR&tn=${encodeURIComponent(`Coins Ledger ${state.gameName}`)}`

              return (
                <div
                  key={t.id}
                  className={`p-5 rounded-[20px] border transition-all ${isPaid
                      ? 'bg-[#F8F8F8] border-[#D8D8D8] opacity-60'
                      : 'bento-card-white bg-white border border-black shadow-[0px_2px_8px_rgba(0,0,0,0.06)]'
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[11px] font-mono text-[#616161] font-bold">
                      Transfer #{index + 1}
                    </span>

                    <button
                      onClick={() => toggleSettlementTransfer(t.id)}
                      className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors ${isPaid
                          ? 'bg-[#B6EA84] text-black border border-black font-black'
                          : 'bg-[#F8F8F8] text-[#616161] border border-[#D8D8D8] hover:border-black hover:text-black'
                        }`}
                    >
                      <Check size={11} className={isPaid ? 'text-black' : 'text-[#616161]'} />
                      <span>{isPaid ? 'PAID ✓' : 'MARK PAID'}</span>
                    </button>
                  </div>

                  {/* Payment Path */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    {/* Payer */}
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-[#EB5757] bg-[#EB5757]/15 border border-[#EB5757]/30 shrink-0"
                      >
                        {fromPlayer?.name.substring(0, 2).toUpperCase() || 'P1'}
                      </div>
                      <div>
                        <span className="text-xs text-[#616161] block font-bold">PAYS</span>
                        <span className="text-sm font-black text-black block truncate max-w-[100px]">
                          {fromPlayer?.name || 'Player'}
                        </span>
                      </div>
                    </div>

                    {/* Arrow & Amount */}
                    <div className="text-center px-2">
                      <span className="text-base sm:text-lg font-black font-mono text-[#194220] block">
                        {formatPaise(t.amountPaise)}
                      </span>
                      <ArrowRight size={16} className="text-[#194220]/60 mx-auto" />
                    </div>

                    {/* Receiver */}
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-xs text-[#616161] block font-bold">RECEIVES</span>
                        <span className="text-sm font-black text-black block truncate max-w-[100px]">
                          {toPlayer?.name || 'Player'}
                        </span>
                      </div>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-black bg-[#B6EA84] border border-black shrink-0"
                      >
                        {toPlayer?.name.substring(0, 2).toUpperCase() || 'P2'}
                      </div>
                    </div>
                  </div>

                  {/* UPI Payment Link */}
                  <div className="mt-4 pt-3 border-t border-[#E5E5E5] flex items-center justify-between text-xs font-mono">
                    <a
                      href={upiPayLink}
                      className="text-[#194220] hover:text-black hover:underline flex items-center gap-1 transition-colors font-bold"
                    >
                      <span>Pay via UPI App</span>
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* PLAYER SCORECARD TABLE */}
      <div className="bento-card-white bg-white border border-[#D8D8D8] rounded-[20px] p-6 sm:p-7 space-y-4">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-[#194220]" />
          <h3 className="text-base font-black text-black tracking-tight">
            Final Player Positions
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#E5E5E5] text-[#616161] uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Player</th>
                <th className="py-2.5 px-3 text-right">Game Paid</th>
                <th className="py-2.5 px-3 text-right">Game Won</th>
                <th className="py-2.5 px-3 text-right">Game Net</th>
                <th className="py-2.5 px-3 text-right">Closing Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {[...players]
                .sort((a, b) => {
                  const gameNetA = (playerSummaries[a.id]?.totalPayoutsPaise || 0) - (playerSummaries[a.id]?.totalContributionsPaise || 0)
                  const gameNetB = (playerSummaries[b.id]?.totalPayoutsPaise || 0) - (playerSummaries[b.id]?.totalContributionsPaise || 0)
                  return gameNetB - gameNetA
                })
                .map((p, idx) => {
                  const s = playerSummaries[p.id]
                  const net = s?.netPositionPaise || 0
                  const paid = s?.totalContributionsPaise || 0
                  const won = s?.totalPayoutsPaise || 0
                  const gameNet = won - paid

                  return (
                    <tr key={p.id} className="hover:bg-[#F8F8F8] transition-colors">
                      <td className="py-2.5 px-3 font-sans font-bold text-black flex items-center gap-2">
                        <span className="text-[#888888] text-[10px]">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                        </span>
                        <span>{p.name}</span>
                        {p.isActive === false && (
                          <span className="text-[9px] font-mono font-bold bg-[#E5E5E5] text-[#616161] px-1.5 py-0.2 rounded-full">
                            Sitting Out
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#EB5757] font-semibold">
                        -{formatPaise(paid)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#194220] font-semibold">
                        +{formatPaise(won)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">
                        <span className={gameNet > 0 ? 'text-[#194220]' : gameNet < 0 ? 'text-[#EB5757]' : 'text-[#888888]'}>
                          {gameNet > 0 ? `+${formatPaise(gameNet)}` : formatPaise(gameNet)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {net === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-black bg-[#B6EA84] border border-black px-2.5 py-0.5 rounded-full">
                            <Check size={10} />
                            <span>₹0.00 Settled</span>
                          </span>
                        ) : net < 0 ? (
                          <span className="text-[11px] font-bold text-[#EB5757] bg-[#EB5757]/15 border border-[#EB5757]/30 px-2 py-0.5 rounded-full inline-block font-mono">
                            Owes {formatPaise(Math.abs(net))}
                          </span>
                        ) : (
                          <span className="text-[11px] font-black text-black bg-[#B6EA84] border border-black px-2 py-0.5 rounded-full inline-block font-mono">
                            Receives {formatPaise(net)}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
