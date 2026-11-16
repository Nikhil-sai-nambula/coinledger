import React, { useState } from 'react'
import { useGame } from '../context/GameContext'
import { formatPaise, parseRupeesToPaise } from '../utils/money'
import {
  Play,
  CheckCircle,
  Plus,
  Coins,
  Trophy,
  ArrowRightLeft,
  RotateCcw,
  Clock,
  Check,
  AlertCircle,
  ChevronDown,
  Layers,
} from 'lucide-react'

export const RoundManager: React.FC = () => {
  const {
    state,
    activeRound,
    createRound,
    completeRound,
    recordContribution,
    recordPayout,
    recordPlayerTransfer,
    reverseTransaction,
    boardBalancePaise,
  } = useGame()

  const [selectedRoundId, setSelectedRoundId] = useState<string>(
    activeRound?.id || state.rounds[state.rounds.length - 1]?.id || ''
  )

  // Modals / Entry Form state
  const [entryType, setEntryType] = useState<'CONTRIBUTION' | 'PAYOUT' | 'TRANSFER' | 'BATCH_ANTE'>('CONTRIBUTION')
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(state.players[0]?.id || '')
  const [toPlayerId, setToPlayerId] = useState<string>(state.players[1]?.id || '')
  const [amountRupees, setAmountRupees] = useState<string>('100')
  const [notes, setNotes] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Reversal dialog state
  const [reversingTxId, setReversingTxId] = useState<string | null>(null)
  const [reversalReason, setReversalReason] = useState<string>('')

  // New Round modal
  const [showNewRoundModal, setShowNewRoundModal] = useState(false)
  const [newRoundName, setNewRoundName] = useState('')
  const [newRoundNotes, setNewRoundNotes] = useState('')

  const activeOrSelectedRound = state.rounds.find(r => r.id === selectedRoundId) || activeRound

  const roundTransactions = state.transactions.filter(tx => tx.roundId === activeOrSelectedRound?.id)

  const handleCreateNewRound = (e: React.FormEvent) => {
    e.preventDefault()
    createRound(newRoundName || undefined, newRoundNotes || undefined)
    setShowNewRoundModal(false)
    setNewRoundName('')
    setNewRoundNotes('')
  }

  const handleExecuteEntry = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const amountPaise = parseRupeesToPaise(amountRupees)
      if (amountPaise <= 0) {
        setErrorMsg('Amount must be greater than zero')
        return
      }

      const targetRoundId = activeOrSelectedRound?.id

      if (entryType === 'CONTRIBUTION') {
        recordContribution(selectedPlayerId, amountPaise, targetRoundId, notes)
        setSuccessMsg(`Recorded contribution of ${formatPaise(amountPaise)} to Board`)
      } else if (entryType === 'PAYOUT') {
        recordPayout(selectedPlayerId, amountPaise, targetRoundId, notes)
        setSuccessMsg(`Recorded payout of ${formatPaise(amountPaise)} from Board`)
      } else if (entryType === 'TRANSFER') {
        if (selectedPlayerId === toPlayerId) {
          setErrorMsg('Sender and receiver cannot be the same player')
          return
        }
        recordPlayerTransfer(selectedPlayerId, toPlayerId, amountPaise, targetRoundId, notes)
        setSuccessMsg(`Recorded direct transfer of ${formatPaise(amountPaise)}`)
      } else if (entryType === 'BATCH_ANTE') {
        // Collect contribution from all players
        for (const p of state.players) {
          recordContribution(p.id, amountPaise, targetRoundId, notes || 'Batch round ante')
        }
        setSuccessMsg(`Recorded ${formatPaise(amountPaise)} contribution from all ${state.players.length} players`)
      }

      setNotes('')
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message)
      } else {
        setErrorMsg('Failed to record transaction')
      }
    }
  }

  const handleConfirmReversal = () => {
    if (!reversingTxId) return
    try {
      reverseTransaction(reversingTxId, reversalReason || 'Host correction')
      setReversingTxId(null)
      setReversalReason('')
      setSuccessMsg('Transaction reversed successfully with inverse double-entry!')
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message)
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Round Header & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
              Game Rounds Engine
            </span>
            {activeOrSelectedRound?.status === 'ACTIVE' && (
              <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE ACTIVE
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            {activeOrSelectedRound?.name || `Round ${activeOrSelectedRound?.roundNumber || 1}`}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {activeOrSelectedRound?.notes || 'Record multiple player contributions, payouts, and transfers.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={activeOrSelectedRound?.id || ''}
            onChange={e => setSelectedRoundId(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 rounded-lg px-3 py-2 outline-none"
          >
            {state.rounds.map(r => (
              <option key={r.id} value={r.id}>
                {r.name || `Round ${r.roundNumber}`} ({r.status})
              </option>
            ))}
          </select>

          {activeOrSelectedRound?.status === 'ACTIVE' && (
            <button
              onClick={() => completeRound(activeOrSelectedRound.id)}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle size={13} className="text-emerald-400" />
              <span>Mark Round Complete</span>
            </button>
          )}

          <button
            onClick={() => setShowNewRoundModal(true)}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            <Plus size={14} />
            <span>New Round</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Entry Form & Round Journal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Round Entry Form */}
        <div className="lg:col-span-5 rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
          <div>
            <h3 className="font-bold text-sm text-white">Record Round Financial Movement</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              All financial actions immediately update the strict double-entry ledger.
            </p>
          </div>

          {/* Action Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => setEntryType('CONTRIBUTION')}
              className={`py-2 px-2 rounded-lg transition-all text-center cursor-pointer ${
                entryType === 'CONTRIBUTION'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Contribution
            </button>
            <button
              type="button"
              onClick={() => setEntryType('PAYOUT')}
              className={`py-2 px-2 rounded-lg transition-all text-center cursor-pointer ${
                entryType === 'PAYOUT'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Payout
            </button>
            <button
              type="button"
              onClick={() => setEntryType('TRANSFER')}
              className={`py-2 px-2 rounded-lg transition-all text-center cursor-pointer ${
                entryType === 'TRANSFER'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              P2P Transfer
            </button>
            <button
              type="button"
              onClick={() => setEntryType('BATCH_ANTE')}
              className={`py-2 px-2 rounded-lg transition-all text-center cursor-pointer ${
                entryType === 'BATCH_ANTE'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Antes
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleExecuteEntry} className="space-y-4 pt-2">
            {/* Player Selection */}
            {entryType !== 'BATCH_ANTE' && (
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400 block">
                  {entryType === 'CONTRIBUTION'
                    ? 'Contributing Player (Debit Player, Credit Board)'
                    : entryType === 'PAYOUT'
                    ? 'Receiving Player (Debit Board, Credit Player)'
                    : 'Paying Player (Debit Sender)'}
                </label>
                <select
                  value={selectedPlayerId}
                  onChange={e => setSelectedPlayerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-emerald-500"
                >
                  {state.players.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* P2P Transfer: To Player */}
            {entryType === 'TRANSFER' && (
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400 block">
                  Receiving Player (Credit Receiver)
                </label>
                <select
                  value={toPlayerId}
                  onChange={e => setToPlayerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-emerald-500"
                >
                  {state.players
                    .filter(p => p.id !== selectedPlayerId)
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Batch Ante Notice */}
            {entryType === 'BATCH_ANTE' && (
              <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200 leading-relaxed">
                Will record a contribution of the specified amount from <strong>all {state.players.length} players</strong> directly into the Board account.
              </div>
            )}

            {/* Amount Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400 block flex items-center justify-between">
                <span>Amount (₹ Rupees)</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  Integer paise precision
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-mono">₹</span>
                <input
                  type="text"
                  value={amountRupees}
                  onChange={e => setAmountRupees(e.target.value)}
                  placeholder="100"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm font-mono text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Optional Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400 block">
                Optional Notes / Hand Description
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Flush win, ante round 2, split pot..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-emerald-500"
              />
            </div>

            {/* Alert Messages */}
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/50 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/50 text-xs text-emerald-300 flex items-start gap-2">
                <Check size={15} className="shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl font-semibold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              Commit Double-Entry Transaction
            </button>
          </form>
        </div>

        {/* Right Column: Transactions Recorded in this Round */}
        <div className="lg:col-span-7 rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Transactions in this Round</span>
                <span className="text-xs font-mono text-slate-400">
                  ({roundTransactions.length})
                </span>
              </h3>
              <span className="text-xs font-mono text-emerald-400 font-medium">
                Current Board: {formatPaise(boardBalancePaise)}
              </span>
            </div>

            {roundTransactions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                <Coins size={28} className="mx-auto text-slate-600" />
                <p>No transactions recorded in this round yet.</p>
                <p className="text-[11px] text-slate-600">
                  Use the entry form to record contributions or payouts.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 max-h-[480px] overflow-y-auto pr-1">
                {roundTransactions.map(tx => (
                  <div key={tx.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            tx.category === 'PLAYER_CONTRIBUTION'
                              ? 'bg-blue-500/20 text-blue-300'
                              : tx.category === 'BOARD_PAYOUT'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : tx.category === 'PLAYER_TRANSFER'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {tx.category.replace(/_/g, ' ')}
                        </span>
                        {tx.isReversed && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 line-through">
                            REVERSED
                          </span>
                        )}
                        <span className="text-slate-500 text-[11px] font-mono">
                          {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="font-medium text-slate-200">
                        {tx.description}
                      </div>
                      {tx.notes && (
                        <div className="text-[11px] text-slate-400 italic">
                          "{tx.notes}"
                        </div>
                      )}
                      {/* Double Entry Breakdown */}
                      <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-400 pt-0.5">
                        {tx.entries.map(e => (
                          <span
                            key={e.id}
                            className={`px-1.5 py-0.5 rounded ${
                              e.type === 'CREDIT' ? 'bg-emerald-950/60 text-emerald-400' : 'bg-rose-950/60 text-rose-400'
                            }`}
                          >
                            {e.type} {e.accountId.replace('ACCOUNT_', '').replace('PLAYER_', 'P:')} {formatPaise(e.amountPaise)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {!tx.isReversed && (
                      <button
                        onClick={() => {
                          setReversingTxId(tx.id)
                          setReversalReason('')
                        }}
                        className="px-2 py-1 rounded text-[11px] font-mono text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-slate-800 transition-colors cursor-pointer shrink-0"
                        title="Reverse this transaction with balancing double-entry"
                      >
                        <RotateCcw size={12} className="inline mr-1" />
                        Reverse
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reversal Confirmation Modal */}
      {reversingTxId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md p-6 rounded-2xl space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <RotateCcw size={18} />
              <span>Reverse Transaction (Double-Entry Reversal)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              In accordance with strict double-entry rules, transactions are never silently deleted.
              A balancing reversal transaction will be recorded with inverted debits and credits.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400 block">
                Reason for Reversal
              </label>
              <input
                type="text"
                value={reversalReason}
                onChange={e => setReversalReason(e.target.value)}
                placeholder="e.g. Input error, misdeal, recalculated ante..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-rose-500"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setReversingTxId(null)}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReversal}
                className="px-3.5 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-lg shadow-rose-600/20"
              >
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Round Modal */}
      {showNewRoundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form onSubmit={handleCreateNewRound} className="bg-slate-900 border border-slate-700 w-full max-w-md p-6 rounded-2xl space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-white">Start New Game Round</h3>
            <p className="text-xs text-slate-400">
              Creates Round {state.rounds.length + 1}. Previous active rounds will be marked completed.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400 block">Round Name (Optional)</label>
              <input
                type="text"
                value={newRoundName}
                onChange={e => setNewRoundName(e.target.value)}
                placeholder={`Round ${state.rounds.length + 1}: Flop & River`}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400 block">Round Notes / Stakes</label>
              <input
                type="text"
                value={newRoundNotes}
                onChange={e => setNewRoundNotes(e.target.value)}
                placeholder="Blinds: ₹50/₹100, Ante: ₹25"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowNewRoundModal(false)}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                Create Round
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
