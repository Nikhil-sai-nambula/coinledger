import React from 'react'
import { GameProvider, useGame } from './context/GameContext'
import { Header } from './components/Header'
import { AccountingOverview } from './components/AccountingOverview'
import { RoundManager } from './components/RoundManager'
import { LedgerTable } from './components/LedgerTable'
import { FinalSettlementView } from './components/FinalSettlementView'
import { FundingView } from './components/FundingView'
import { Scale, CheckCircle2, ShieldCheck } from 'lucide-react'

const AppContent: React.FC = () => {
  const { currentTab, overview, state } = useGame()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {currentTab === 'overview' && <AccountingOverview />}
        {currentTab === 'rounds' && <RoundManager />}
        {currentTab === 'ledger' && <LedgerTable />}
        {currentTab === 'settlement' && <FinalSettlementView />}
        {currentTab === 'funding' && <FundingView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-6 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Scale size={12} />
            </div>
            <span className="font-semibold text-slate-300">CoinLedger</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">Strict Double-Entry Accounting Model</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck size={14} className="text-emerald-400" />
              Integer Paise Precision (0 floats)
            </span>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <CheckCircle2 size={14} className={overview.isReconciled ? 'text-emerald-400' : 'text-rose-400'} />
              {overview.isReconciled ? 'Ledger Balanced' : 'Ledger Discrepancy'}
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-400">
              {state.transactions.length} Transactions committed
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  )
}

export default App
