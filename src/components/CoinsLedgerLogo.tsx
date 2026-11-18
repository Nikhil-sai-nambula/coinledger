import React from 'react'

interface CoinsLedgerLogoProps {
  className?: string
}

export const CoinsLedgerLogo: React.FC<CoinsLedgerLogoProps> = ({
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Coins Ledger Sleek BentoML Signature Coin Stack Icon */}
      <div className="w-9 h-9 rounded-[10px] bg-[#B6EA84] border border-black flex items-center justify-center text-black shadow-[-2px_2px_0px_#000000] shrink-0">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
          <path d="M7 6h2v4H7z" fill="currentColor" stroke="none" />
          <path d="M14 13h2v4h-2z" fill="currentColor" stroke="none" />
        </svg>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-extrabold text-sm sm:text-base tracking-tight text-black whitespace-nowrap">
          Coins <span className="text-[#194220]">Ledger</span>
        </span>
      </div>
    </div>
  )
}

export default CoinsLedgerLogo
