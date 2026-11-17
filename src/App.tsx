import React from 'react'
import { GameProvider, useGame } from './context/GameContext'
import { Header } from './components/Header'
import { SimpleGameView } from './components/SimpleGameView'
import { RoundManager } from './components/RoundManager'
import { FinalSettlementView } from './components/FinalSettlementView'
import { CoinsLedgerLogo } from './components/CoinsLedgerLogo'
import { CheckCircle2, ShieldCheck } from 'lucide-react'

const AppContent: React.FC = () => {
  const { currentTab, completedRoundsCount } = useGame()

  return (
    <div className="min-h-screen bg-[#F8F8F8] text-[#221F20] flex flex-col font-sans selection:bg-[#B6EA84] selection:text-[#000000]">
      {/* Coins Ledger Top Header */}
      <Header />

      {/* Main Content Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-5 sm:py-7">
        {(currentTab === 'play' || currentTab === 'overview') && <SimpleGameView />}
        {currentTab === 'settlement' && <FinalSettlementView />}
        {currentTab === 'rounds' && <RoundManager />}
      </main>

      {/* Coins Ledger Clean Footer */}
      <footer className="border-t border-[#D8D8D8] bg-white py-6 text-xs text-[#616161]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <CoinsLedgerLogo />
            <span className="text-[#888888] font-mono text-[11px]">
              &bull; Zero-Sum Accounting
            </span>
          </div>
          <div className="text-[11px] font-mono text-[#616161]">
            &copy; {new Date().getFullYear()} Coins Ledger. All rights reserved. Created by <span className="text-black font-bold">Nikhil Sai Nambula</span>.
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
