import React, { useState } from 'react'
import { useGame } from '../context/GameContext'
import { formatPaise } from '../utils/money'
import {
  ACCOUNT_BOARD,
  ACCOUNT_EXTERNAL,
  type TransactionCategory,
} from '../types/accounting'
import {
  Scale,
  Search,
  Filter,
  Download,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Layers,
  FileText,
} from 'lucide-react'

export const LedgerTable: React.FC = () => {
  const { state, reverseTransaction } = useGame()

  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [accountFilter, setAccountFilter] = useState<string>('ALL')
  const [reversingTxId, setReversingTxId] = useState<string | null>(null)
  const [reversalReason, setReversalReason] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Filter transactions
  const filteredTransactions = state.transactions.filter(tx => {
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchDesc = tx.description.toLowerCase().includes(q)
      const matchId = tx.id.toLowerCase().includes(q)
      const matchNotes = tx.notes?.toLowerCase().includes(q) || false
      if (!matchDesc && !matchId && !matchNotes) return false
    }

    // Category filter
    if (categoryFilter !== 'ALL' && tx.category !== categoryFilter) {
      return false
    }

    // Account filter
    if (accountFilter !== 'ALL') {
      const hasAccount = tx.entries.some(e => e.accountId === accountFilter)
      if (!hasAccount) return false
    }

    return true
  })

  const handleConfirmReversal = () => {
    if (!reversingTxId) return
    setErrorMsg(null)
    try {
      reverseTransaction(reversingTxId, reversalReason || 'Correction via audit ledger')
      setReversingTxId(null)
      setReversalReason('')
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message)
      }
    }
  }

  const exportLedgerJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `coinledger_export_${Date.now()}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  const exportLedgerCsv = () => {
    const headers = ['TransactionID', 'Timestamp', 'Round', 'Category', 'Description', 'Account', 'EntryType', 'AmountPaise', 'AmountRupees', 'IsReversed', 'Notes']
    const rows: string[] = [headers.join(',')]

    for (const tx of state.transactions) {
      for (const e of tx.entries) {
        rows.push([
          `"${tx.id}"`,
          `"${new Date(tx.timestamp).toISOString()}"`,
          `"${tx.roundId || 'GLOBAL'}"`,
          `"${tx.category}"`,
          `"${tx.description.replace(/"/g, '""')}"`,
          `"${e.accountId.replace('ACCOUNT_', '')}"`,
          `"${e.type}"`,
          e.amountPaise,
          (e.amountPaise / 100).toFixed(2),
          tx.isReversed ? 'YES' : 'NO',
          `"${(tx.notes || '').replace(/"/g, '""')}"`,
        ].join(','))
      }
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', csvContent)
    downloadAnchor.setAttribute('download', `coinledger_journal_${Date.now()}.csv`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  return (
    <div className="space-y-5">
      {/* Table Header and Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
              General Ledger Journal
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {filteredTransactions.length} of {state.transactions.length} Transactions
            </span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Audit Trail & Double-Entry Journal</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable financial movement ledger. Every transaction maintains strict debit-credit equilibrium.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportLedgerCsv}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
          <button
            onClick={exportLedgerJson}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileText size={13} />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search description, tx ID, notes..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-slate-400 shrink-0" />
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-emerald-500 font-mono"
          >
            <option value="ALL">All Categories</option>
            <option value="PLAYER_CONTRIBUTION">Contributions (Player → Board)</option>
            <option value="BOARD_PAYOUT">Payouts (Board → Player)</option>
            <option value="PLAYER_TRANSFER">Player-to-Player Transfers</option>
            <option value="INITIAL_BOARD_FUNDING">Initial Board Funding</option>
            <option value="INITIAL_PLAYER_BALANCE">Initial Player Credit</option>
            <option value="EXTERNAL_DEPOSIT">External Deposit</option>
            <option value="EXTERNAL_WITHDRAWAL">External Withdrawal</option>
            <option value="BOARD_SETTLEMENT_ALLOCATION">Settlement Allocation</option>
            <option value="REVERSAL">Reversals</option>
          </select>
        </div>

        {/* Account Filter */}
        <div className="flex items-center gap-1.5">
          <Scale size={14} className="text-slate-400 shrink-0" />
          <select
            value={accountFilter}
            onChange={e => setAccountFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-emerald-500 font-mono"
          >
            <option value="ALL">All Accounts</option>
            <option value={ACCOUNT_BOARD}>Board Account (ACCOUNT_BOARD)</option>
            <option value={ACCOUNT_EXTERNAL}>External Funding (ACCOUNT_EXTERNAL)</option>
            {state.players.map(p => (
              <option key={p.id} value={`ACCOUNT_PLAYER_${p.id}`}>
                Player: {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Transaction / Time</th>
                <th className="py-3 px-4">Category & Scope</th>
                <th className="py-3 px-4">Description & Audit Notes</th>
                <th className="py-3 px-4">Double-Entry Debits & Credits</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No transactions match your query.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(tx => {
                  const totalDebits = tx.entries.filter(e => e.type === 'DEBIT').reduce((s, e) => s + e.amountPaise, 0)
                  const totalCredits = tx.entries.filter(e => e.type === 'CREDIT').reduce((s, e) => s + e.amountPaise, 0)
                  const isBalanced = totalDebits === totalCredits

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-slate-800/30 transition-colors ${
                        tx.isReversed ? 'opacity-60 bg-rose-950/10' : ''
                      }`}
                    >
                      {/* ID and Time */}
                      <td className="py-3.5 px-4 font-mono align-top space-y-1">
                        <div className="font-bold text-slate-200 text-[11px] flex items-center gap-1.5">
                          <span>{tx.id}</span>
                          {tx.isReversed && (
                            <span className="text-[10px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 line-through">
                              REVERSED
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(tx.timestamp).toLocaleString()}
                        </div>
                      </td>

                      {/* Category & Round */}
                      <td className="py-3.5 px-4 align-top space-y-1 font-mono">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.category === 'PLAYER_CONTRIBUTION'
                              ? 'bg-blue-500/20 text-blue-300'
                              : tx.category === 'BOARD_PAYOUT'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : tx.category === 'PLAYER_TRANSFER'
                              ? 'bg-amber-500/20 text-amber-300'
                              : tx.category === 'REVERSAL'
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {tx.category}
                        </span>
                        {tx.roundId && (
                          <div className="text-[10px] text-slate-400">
                            Scope: {state.rounds.find(r => r.id === tx.roundId)?.name || tx.roundId}
                          </div>
                        )}
                      </td>

                      {/* Description & Notes */}
                      <td className="py-3.5 px-4 align-top space-y-1">
                        <div className="font-medium text-white">{tx.description}</div>
                        {tx.notes && <div className="text-slate-400 italic text-[11px]">"{tx.notes}"</div>}
                        {tx.reversedTransactionId && (
                          <div className="text-[10px] font-mono text-rose-400">
                            Reverses: {tx.reversedTransactionId}
                          </div>
                        )}
                      </td>

                      {/* Entries: Debits and Credits */}
                      <td className="py-3.5 px-4 align-top space-y-1 font-mono">
                        <div className="space-y-1">
                          {tx.entries.map(e => {
                            const isCredit = e.type === 'CREDIT'
                            const accountLabel = e.accountId === ACCOUNT_BOARD
                              ? 'BOARD'
                              : e.accountId === ACCOUNT_EXTERNAL
                              ? 'EXTERNAL'
                              : state.players.find(p => `ACCOUNT_PLAYER_${p.id}` === e.accountId)?.name || e.accountId

                            return (
                              <div
                                key={e.id}
                                className="flex items-center justify-between gap-3 text-[11px] px-2 py-0.5 rounded bg-slate-950/70 border border-slate-800"
                              >
                                <span className="text-slate-300 truncate max-w-[140px]" title={accountLabel}>
                                  {accountLabel}
                                </span>
                                <span
                                  className={`font-bold ${
                                    isCredit ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  {e.type} {formatPaise(e.amountPaise)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                          <span>Balance check:</span>
                          <span className={isBalanced ? 'text-emerald-500' : 'text-rose-500 font-bold'}>
                            {isBalanced ? '✓ Balanced' : '✕ Discrepancy'} (Debits: {formatPaise(totalDebits)} / Credits: {formatPaise(totalCredits)})
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 align-top text-right">
                        {!tx.isReversed && (
                          <button
                            onClick={() => {
                              setReversingTxId(tx.id)
                              setReversalReason('')
                              setErrorMsg(null)
                            }}
                            className="px-2 py-1 rounded text-[11px] font-mono text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-slate-800 transition-colors cursor-pointer"
                            title="Reverse transaction with inverse entry"
                          >
                            <RotateCcw size={12} className="inline mr-1" />
                            Reverse
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reversal Confirmation Modal */}
      {reversingTxId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md p-6 rounded-2xl space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <RotateCcw size={18} />
              <span>Reverse Transaction</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Creates an exact inverted double-entry transaction to cancel this movement without deleting history.
            </p>
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200">
                {errorMsg}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400 block">Reason for Reversal</label>
              <input
                type="text"
                value={reversalReason}
                onChange={e => setReversalReason(e.target.value)}
                placeholder="e.g. Host data correction, duplicate entry..."
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
    </div>
  )
}
