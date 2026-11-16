# CoinLedger — Strict Double-Entry Board & Player Accounting

**CoinLedger** is a board game and poker session financial ledger built on strict double-entry accounting principles. It guarantees financial integrity, eliminates floating-point rounding errors through integer paise precision, treats the Game Board as an independent financial account, and optimizes final player-to-player settlement through a greedy debt minimization algorithm.

---

## 🏛️ Core Accounting Model

Every financial movement is recorded as a balanced transaction where **Total Debits = Total Credits**.

### 1. Financial Accounts
- **Board Account (`ACCOUNT_BOARD`)**: An independent financial entity that collects table stakes, blinds, contributions, and pays out winnings. The board is **not a player**.
- **Player Accounts (`PLAYER:<playerId>`)**: Each player holds a distinct sub-ledger tracking debits (money given/sent) and credits (money won/received).
- **External Account (`ACCOUNT_EXTERNAL`)**: Source and sink for initial table funding, host re-buys, and bank deposits/withdrawals.

### 2. Transaction Rules
| Event | Debit Entry | Credit Entry | Notes |
| :--- | :--- | :--- | :--- |
| **Player Contribution** | Player Account (Dr) | Board Account (Cr) | Increases board pool, records player debit. Same Tx ID. |
| **Board Payout** | Board Account (Dr) | Player Account (Cr) | Decreases board pool, records player credit. Same Tx ID. |
| **Player-to-Player Transfer** | Sender Account (Dr) | Receiver Account (Cr) | Direct settlement, side-bets, or penalty chips. Board untouched. |
| **Initial Board Funding** | External Account (Dr) | Board Account (Cr) | Seed money for table without unbacked money creation. |
| **External Deposit** | External Account (Dr) | Board Account (Cr) | Additional cash injected during play. |
| **External Withdrawal / Rake**| Board Account (Dr) | External Account (Cr) | Host rake or early cash-out from board. |
| **Reversal / Adjustment** | Inverted Original Debits | Inverted Original Credits | Immutable audit log; no silent deletes. |

---

## 📐 Invariants & Formulas

1. **Transaction Balance Invariant**:
   $$\sum \text{Debits} = \sum \text{Credits}$$
   Enforced at transaction creation; unbalanced entries are rejected with runtime invariant errors.

2. **Integer Paise Precision**:
   All monetary amounts are stored as integer paise ($1\text{ ₹} = 100\text{ paise}$). Floating-point values are strictly forbidden across calculation and storage layers.

3. **Board Balance Equation**:
   $$\text{Board Balance} = \sum \text{Board Credits} - \sum \text{Board Debits}$$
   - Any transaction attempting to drive the board balance below ₹0 (e.g., an overdraft payout) is rejected immediately.

4. **Player Net Position**:
   $$\text{Player Net} = \sum \text{Player Credits} - \sum \text{Player Debits}$$
   - $\text{Net} > 0$: Player is a **net winner / creditor** (should receive money).
   - $\text{Net} < 0$: Player is a **net debtor** (owes money into the game).
   - $\text{Net} = 0$: Player is even.

5. **Ledger Conservation Law**:
   $$\sum_{\text{all accounts } A} (\text{Credits}_A - \text{Debits}_A) = 0$$

6. **Settlement Constraint with Board**:
   $$\sum_{p \in \text{Players}} \text{Net}_p + \text{Board Balance} = 0$$
   Player-to-player debts can only resolve symmetrically when $\text{Board Balance} = 0$. Unallocated board funds are presented separately and require explicit host resolution before final settlement can be finalized.

---

## 🚀 Key Features

- **Double-Entry Ledger Journal**: View every journal entry with credit (green) and debit (red) badges, category filters, and 1-click transaction reversal.
- **Round-by-Round Entry**: Add contributions, payouts, and player transfers per round with quick batch ante tools.
- **Accounting Overview**: Real-time board balance hero card, ledger reconciliation badge, total contributions, board payouts, winnings, and debtor/creditor breakdowns.
- **Final Settlement View**:
  - Automatically identifies unallocated board funds.
  - Interactive resolution options: distribute equally, refund to external organizer/rake, or acknowledge.
  - Greedy matching algorithm minimizes total cash handoffs between debtors and creditors.
  - Checkboxes to mark transfers completed, with a copyable WhatsApp / Telegram settlement summary.
- **CSV & JSON Export**: Export the entire double-entry journal for accounting audits.
- **Preloaded Demo Mode**: Instantly load a 5-player, 3-round realistic game to test settlements and reversals.

---

## 🧪 Automated Test Suite

CoinLedger includes comprehensive automated tests covering all 11 required accounting scenarios:

```bash
npm test
```

### Verified Test Scenarios:
1. Integer Paise Precision & Money Utilities (accurate parsing, rejecting floats, Indian formatting).
2. Player contributions: Debits Player, Credits Board under same transaction ID.
3. Board payouts: Debits Board, Credits Player under same transaction ID.
4. Player-to-player transfers: Debits Sender, Credits Receiver.
5. Invariant check: Rejection of unbalanced debit/credit transactions.
6. Initial board funding and player balance allocation via explicit external transactions.
7. External deposits and withdrawals during play.
8. Board balance calculation & negative board balance prevention.
9. Duplicate transaction submission prevention.
10. Player net position derivations (positive = receive, negative = owes).
11. Transaction reversals with mirrored double entries.
12. Multi-round execution & global ledger balance verification.
13. Final settlement unallocated board funds blocking and resolution (equal split, refund).
14. Greedy debtor-creditor matching algorithm transfer minimization.

---

## 🛠️ Tech Stack & Architecture

- **Framework**: React 18 + Vite 6 + TypeScript
- **Styling**: Tailwind CSS 4 + Lucide React Icons
- **State Management**: React Context (`GameContext`) with `localStorage` persistence
- **Testing**: Vitest 5.1
- **File Structure**:
  - `src/types/accounting.ts` — Type definitions for accounts, entries, transactions, rounds, and summaries.
  - `src/utils/money.ts` — Integer paise converters, formatters, and assertions.
  - `src/core/ledger.ts` — Invariant checkers, double-entry transaction creators, board balance calculator, player movement calculator.
  - `src/core/settlement.ts` — Greedy debtor-creditor matching algorithm, board fund resolution generators, settlement blockers.
  - `src/components/Header.tsx` — App header with live board balance pill, double-entry badge, and accounting guide.
  - `src/components/AccountingOverview.tsx` — Dashboard with hero board metrics, reconciliation banner, and player balances.
  - `src/components/RoundManager.tsx` — Round entry interface for contributions, payouts, and transfers.
  - `src/components/LedgerTable.tsx` — Full journal table with CSV/JSON export and reversal controls.
  - `src/components/FinalSettlementView.tsx` — Unallocated funds resolver, transfer checklist, and shareable settlement text.
  - `src/components/FundingView.tsx` — External capital injector and withdrawal manager.

---

## 💻 Getting Started

```bash
# Navigate to the project
cd /Users/nikhil_sai/coinledger

# Install dependencies (already installed)
npm install

# Run unit tests
npm test

# Run development server
npm run dev

# Build for production
npm run build
```
