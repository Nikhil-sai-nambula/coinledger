import { describe, it, expect } from 'vitest'
import {
  ACCOUNT_BOARD,
  ACCOUNT_EXTERNAL,
  getPlayerAccountId,
  type Player,
  type Transaction,
} from '../../types/accounting'
import {
  createPlayerContributionTransaction,
  createBoardPayoutTransaction,
  createPlayerTransferTransaction,
  createInitialBoardFundingTransaction,
  createInitialPlayerBalanceTransaction,
  createExternalDepositTransaction,
  createExternalWithdrawalTransaction,
  createReversalTransaction,
  calculateBoardBalance,
  calculatePlayerBalances,
  calculateAccountingOverview,
  assertCanApplyTransaction,
  validateTransactionEntries,
  AccountingError,
} from '../ledger'
import {
  evaluateSettlementPlan,
  calculateGreedySettlementTransfers,
  createDistributeBoardFundsEquallyTransaction,
  createRefundBoardFundsToExternalTransaction,
} from '../settlement'
import { parseRupeesToPaise, formatPaise, assertPaiseInteger } from '../../utils/money'

describe('CoinLedger Double-Entry Accounting Model', () => {
  const players: Player[] = [
    { id: 'p1', name: 'Alice', avatarColor: '#10b981', createdAt: 1000 },
    { id: 'p2', name: 'Bob', avatarColor: '#3b82f6', createdAt: 1000 },
    { id: 'p3', name: 'Charlie', avatarColor: '#f59e0b', createdAt: 1000 },
  ]

  describe('1. Integer Paise Precision & Money Utilities', () => {
    it('accurately parses rupee input into integer paise without float errors', () => {
      expect(parseRupeesToPaise('100')).toBe(10000)
      expect(parseRupeesToPaise('100.5')).toBe(10050)
      expect(parseRupeesToPaise('100.50')).toBe(10050)
      expect(parseRupeesToPaise('0.05')).toBe(5)
      expect(parseRupeesToPaise('₹ 1,250.75')).toBe(125075)
      expect(parseRupeesToPaise(50)).toBe(5000)
    })

    it('rejects invalid currency inputs and floating paise amounts', () => {
      expect(() => parseRupeesToPaise('abc')).toThrow()
      expect(() => parseRupeesToPaise('-50')).toThrow()
      expect(() => parseRupeesToPaise('10.123')).toThrow() // more than 2 decimal places
      expect(() => assertPaiseInteger(10.5)).toThrow()
      expect(() => assertPaiseInteger(-100)).toThrow()
      expect(() => assertPaiseInteger(NaN)).toThrow()
    })

    it('formats paise correctly into rupee strings with Indian numbering', () => {
      expect(formatPaise(10000)).toBe('₹100')
      expect(formatPaise(10050)).toBe('₹100.50')
      expect(formatPaise(10000000)).toBe('₹1,00,000') // 1 lakh
      expect(formatPaise(-25000)).toBe('-₹250')
      expect(formatPaise(5000, { showSign: true })).toBe('+₹50')
    })
  })

  describe('2. Core Accounting Rules (Contributions, Payouts, Transfers)', () => {
    it('Player contribution: Debits Player, Credits Board under same transaction ID', () => {
      const tx = createPlayerContributionTransaction({
        playerId: 'p1',
        playerName: 'Alice',
        amountPaise: 10000, // ₹100
        roundId: 'r1',
      })

      expect(tx.entries).toHaveLength(2)
      const debitEntry = tx.entries.find(e => e.type === 'DEBIT')!
      const creditEntry = tx.entries.find(e => e.type === 'CREDIT')!

      expect(debitEntry).toBeDefined()
      expect(creditEntry).toBeDefined()

      // Debit Player A's account
      expect(debitEntry.accountId).toBe(getPlayerAccountId('p1'))
      expect(debitEntry.amountPaise).toBe(10000)

      // Credit the Board account
      expect(creditEntry.accountId).toBe(ACCOUNT_BOARD)
      expect(creditEntry.amountPaise).toBe(10000)

      // Same transaction ID
      expect(debitEntry.transactionId).toBe(tx.id)
      expect(creditEntry.transactionId).toBe(tx.id)

      // Invariant: Total Debits == Total Credits
      expect(debitEntry.amountPaise).toBe(creditEntry.amountPaise)
    })

    it('Board payout to player: Debits Board, Credits Player under same transaction ID', () => {
      const tx = createBoardPayoutTransaction({
        playerId: 'p2',
        playerName: 'Bob',
        amountPaise: 30000, // ₹300
        roundId: 'r1',
      })

      expect(tx.entries).toHaveLength(2)
      const debitEntry = tx.entries.find(e => e.type === 'DEBIT')!
      const creditEntry = tx.entries.find(e => e.type === 'CREDIT')!

      // Debit Board account
      expect(debitEntry.accountId).toBe(ACCOUNT_BOARD)
      expect(debitEntry.amountPaise).toBe(30000)

      // Credit Player B account
      expect(creditEntry.accountId).toBe(getPlayerAccountId('p2'))
      expect(creditEntry.amountPaise).toBe(30000)

      // Same transaction ID
      expect(debitEntry.transactionId).toBe(tx.id)
      expect(creditEntry.transactionId).toBe(tx.id)
    })

    it('Player-to-player transfer: Debits Sender, Credits Receiver', () => {
      const tx = createPlayerTransferTransaction({
        fromPlayerId: 'p1',
        toPlayerId: 'p2',
        fromPlayerName: 'Alice',
        toPlayerName: 'Bob',
        amountPaise: 20000, // ₹200
        roundId: 'r1',
      })

      expect(tx.entries).toHaveLength(2)
      const debitEntry = tx.entries.find(e => e.type === 'DEBIT')!
      const creditEntry = tx.entries.find(e => e.type === 'CREDIT')!

      // Debit Player A
      expect(debitEntry.accountId).toBe(getPlayerAccountId('p1'))
      expect(debitEntry.amountPaise).toBe(20000)

      // Credit Player B
      expect(creditEntry.accountId).toBe(getPlayerAccountId('p2'))
      expect(creditEntry.amountPaise).toBe(20000)
    })

    it('Rejects invalid transactions that violate debit-credit balance', () => {
      const unbalancedEntries = [
        { id: '1', transactionId: 't1', accountId: ACCOUNT_BOARD, type: 'DEBIT' as const, amountPaise: 10000, createdAt: 1 },
        { id: '2', transactionId: 't1', accountId: getPlayerAccountId('p1'), type: 'CREDIT' as const, amountPaise: 9000, createdAt: 1 },
      ]
      expect(() => validateTransactionEntries(unbalancedEntries)).toThrow(AccountingError)
    })
  })

  describe('3. Initial Game Funding & External Movements', () => {
    it('Records initial board funding as an explicit double-entry transaction', () => {
      const tx = createInitialBoardFundingTransaction({
        amountPaise: 50000, // ₹500
        notes: 'Initial table stack',
      })

      expect(tx.category).toBe('INITIAL_BOARD_FUNDING')
      const debitEntry = tx.entries.find(e => e.type === 'DEBIT')!
      const creditEntry = tx.entries.find(e => e.type === 'CREDIT')!

      expect(debitEntry.accountId).toBe(ACCOUNT_EXTERNAL)
      expect(creditEntry.accountId).toBe(ACCOUNT_BOARD)
      expect(debitEntry.amountPaise).toBe(50000)
      expect(creditEntry.amountPaise).toBe(50000)
    })

    it('Records optional initial player balance explicitly from external funding', () => {
      const tx = createInitialPlayerBalanceTransaction({
        playerId: 'p1',
        playerName: 'Alice',
        amountPaise: 20000, // ₹200
      })

      expect(tx.category).toBe('INITIAL_PLAYER_BALANCE')
      const debitEntry = tx.entries.find(e => e.type === 'DEBIT')!
      const creditEntry = tx.entries.find(e => e.type === 'CREDIT')!

      expect(debitEntry.accountId).toBe(ACCOUNT_EXTERNAL)
      expect(creditEntry.accountId).toBe(getPlayerAccountId('p1'))
    })

    it('Allows external deposits and withdrawals to board during game', () => {
      const depTx = createExternalDepositTransaction({ amountPaise: 10000 })
      expect(depTx.entries.find(e => e.type === 'DEBIT')!.accountId).toBe(ACCOUNT_EXTERNAL)
      expect(depTx.entries.find(e => e.type === 'CREDIT')!.accountId).toBe(ACCOUNT_BOARD)

      const withTx = createExternalWithdrawalTransaction({ amountPaise: 5000 })
      expect(withTx.entries.find(e => e.type === 'DEBIT')!.accountId).toBe(ACCOUNT_BOARD)
      expect(withTx.entries.find(e => e.type === 'CREDIT')!.accountId).toBe(ACCOUNT_EXTERNAL)
    })
  })

  describe('4. Board Balance & Negative Balance Prevention', () => {
    it('Correctly calculates board balance from ledger entries', () => {
      const tx1 = createInitialBoardFundingTransaction({ amountPaise: 50000 }) // +₹500
      const tx2 = createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 10000 }) // +₹100
      const tx3 = createBoardPayoutTransaction({ playerId: 'p2', amountPaise: 25000 }) // -₹250

      const entries = [...tx1.entries, ...tx2.entries, ...tx3.entries]
      const boardBalance = calculateBoardBalance(entries)

      // 500 + 100 - 250 = 350
      expect(boardBalance).toBe(35000)
    })

    it('Strictly prevents accidental negative board balance', () => {
      // Board has ₹100 from contribution
      const tx1 = createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 10000 })
      const existing = [tx1]

      // Attempting to payout ₹150 when board only has ₹100
      const badPayout = createBoardPayoutTransaction({ playerId: 'p2', amountPaise: 15000 })

      expect(() => {
        assertCanApplyTransaction(existing, badPayout)
      }).toThrow(/Board balance can never be negative/i)
    })

    it('Prevents duplicate transaction submissions', () => {
      const tx1 = createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 10000 })
      const existing = [tx1]

      expect(() => {
        assertCanApplyTransaction(existing, tx1)
      }).toThrow(/already been processed/i)
    })
  })

  describe('5. Player Net Balances & Invariants', () => {
    it('Correctly derives player net position: Positive = to receive, Negative = owes', () => {
      // Alice contributes ₹100 to board
      const tx1 = createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 10000 })
      // Board pays Bob ₹300
      const tx2 = createBoardPayoutTransaction({ playerId: 'p2', amountPaise: 30000 })
      // Alice pays Charlie ₹50 directly
      const tx3 = createPlayerTransferTransaction({ fromPlayerId: 'p1', toPlayerId: 'p3', amountPaise: 5000 })

      const entries = [...tx1.entries, ...tx2.entries, ...tx3.entries]
      const balances = calculatePlayerBalances(entries, players)

      // Alice: Debited 100 (contrib) + 50 (transfer) = -₹150
      expect(balances['p1'].netPositionPaise).toBe(-15000)

      // Bob: Credited 300 (payout) = +₹300
      expect(balances['p2'].netPositionPaise).toBe(30000)

      // Charlie: Credited 50 (transfer) = +₹50
      expect(balances['p3'].netPositionPaise).toBe(5000)
    })
  })

  describe('6. Reversals & Adjustments', () => {
    it('Creates an exact inverted reversal transaction and restores prior balances', () => {
      // Board starts with ₹500
      const initTx = createInitialBoardFundingTransaction({ amountPaise: 50000 })
      // Erroneous payout of ₹200 to Bob
      const payoutTx = createBoardPayoutTransaction({ playerId: 'p2', amountPaise: 20000 })

      const initialEntries = [...initTx.entries, ...payoutTx.entries]
      expect(calculateBoardBalance(initialEntries)).toBe(30000)

      // Reverse the payout
      const revTx = createReversalTransaction(payoutTx, 'Mistaken payout to Bob')
      expect(revTx.category).toBe('REVERSAL')
      expect(revTx.reversedTransactionId).toBe(payoutTx.id)

      const finalEntries = [...initialEntries, ...revTx.entries]
      // Board balance restored to ₹500
      expect(calculateBoardBalance(finalEntries)).toBe(50000)

      // Bob's net balance restored to ₹0
      const balances = calculatePlayerBalances(finalEntries, players)
      expect(balances['p2'].netPositionPaise).toBe(0)
    })

    it('Disallows double-reversing the same transaction', () => {
      const payoutTx = createBoardPayoutTransaction({ playerId: 'p2', amountPaise: 20000 })
      payoutTx.isReversed = true

      expect(() => {
        createReversalTransaction(payoutTx, 'Try reverse again')
      }).toThrow(/already been reversed/i)
    })
  })

  describe('7. Multi-Round Game Flow & Reconciliation', () => {
    it('Executes multi-round game and ensures global ledger balance', () => {
      const txs: Transaction[] = []

      // Round 1
      txs.push(createInitialBoardFundingTransaction({ amountPaise: 100000 })) // Board: +1000
      txs.push(createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 20000, roundId: 'r1' })) // Alice: -200, Board: +200
      txs.push(createPlayerContributionTransaction({ playerId: 'p2', amountPaise: 20000, roundId: 'r1' })) // Bob: -200, Board: +200
      txs.push(createBoardPayoutTransaction({ playerId: 'p1', amountPaise: 30000, roundId: 'r1' })) // Board: -300, Alice: +300

      // Round 2
      txs.push(createPlayerContributionTransaction({ playerId: 'p3', amountPaise: 40000, roundId: 'r2' })) // Charlie: -400, Board: +400
      txs.push(createPlayerTransferTransaction({ fromPlayerId: 'p3', toPlayerId: 'p2', amountPaise: 10000, roundId: 'r2' })) // Charlie: -100, Bob: +100
      txs.push(createBoardPayoutTransaction({ playerId: 'p2', amountPaise: 50000, roundId: 'r2' })) // Board: -500, Bob: +500

      const overview = calculateAccountingOverview(txs, players)

      // Debits must equal Credits across the ledger
      expect(overview.totalDebitsPaise).toBe(overview.totalCreditsPaise)
      expect(overview.isReconciled).toBe(true)
      expect(overview.discrepancyPaise).toBe(0)

      // Board Balance = 1000 + 200 + 200 - 300 + 400 - 500 = 1000
      expect(overview.currentBoardBalancePaise).toBe(100000)
    })
  })

  describe('8. Final Settlement, Unallocated Board Funds & Greedy Matching', () => {
    it('Blocks final settlement when unallocated board funds exist and host has not confirmed', () => {
      const tx1 = createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 20000 }) // Board has ₹200
      const plan = evaluateSettlementPlan({
        transactions: [tx1],
        players,
        boardAllocationConfirmed: false,
      })

      expect(plan.status).toBe('BLOCKED_UNALLOCATED_BOARD')
      expect(plan.unallocatedBoardFundsPaise).toBe(20000)
      expect(plan.transfers).toHaveLength(0)
    })

    it('Proceeds with final settlement when board balance is exactly zero', () => {
      // Alice pays board ₹100, Board pays Bob ₹100. Board balance is ₹0.
      const tx1 = createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 10000 })
      const tx2 = createBoardPayoutTransaction({ playerId: 'p2', amountPaise: 10000 })

      const plan = evaluateSettlementPlan({
        transactions: [tx1, tx2],
        players,
        boardAllocationConfirmed: false, // Not needed because board is ₹0
      })

      expect(plan.status).toBe('READY')
      expect(plan.boardBalancePaise).toBe(0)
      expect(plan.transfers).toHaveLength(1)
      expect(plan.transfers[0].fromPlayerId).toBe('p1') // Alice pays
      expect(plan.transfers[0].toPlayerId).toBe('p2') // Bob
      expect(plan.transfers[0].amountPaise).toBe(10000) // ₹100
    })

    it('Allows host to distribute remaining board funds equally and then settles', () => {
      // Alice contributes ₹300. Board has ₹300 remaining.
      const tx1 = createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 30000 })
      const txs = [tx1]

      // Host chooses to distribute remaining ₹300 equally to all 3 players (₹100 each)
      const distTx = createDistributeBoardFundsEquallyTransaction({
        boardBalancePaise: 30000,
        players,
      })
      txs.push(distTx)

      // Board balance is now ₹0
      expect(calculateBoardBalance(txs.flatMap(t => t.entries))).toBe(0)

      const plan = evaluateSettlementPlan({
        transactions: txs,
        players,
        boardAllocationConfirmed: true,
      })

      expect(plan.status).toBe('READY')
      expect(plan.boardBalancePaise).toBe(0)

      // Alice contributed 300, received 100 share -> Net -200
      // Bob received 100 share -> Net +100
      // Charlie received 100 share -> Net +100
      // Greedy transfers: Alice pays Bob 100, Alice pays Charlie 100.
      expect(plan.transfers).toHaveLength(2)
      const totalTransferred = plan.transfers.reduce((sum, t) => sum + t.amountPaise, 0)
      expect(totalTransferred).toBe(20000)
    })

    it('Allows host to refund remaining board funds to external organizer/rake', () => {
      // Board funded with ₹500, unspent
      const tx1 = createInitialBoardFundingTransaction({ amountPaise: 50000 })
      const refundTx = createRefundBoardFundsToExternalTransaction({ boardBalancePaise: 50000 })

      const entries = [...tx1.entries, ...refundTx.entries]
      expect(calculateBoardBalance(entries)).toBe(0)
    })

    it('Greedy settlement algorithm minimizes transfers across complex debt graphs', () => {
      // Scenario:
      // Player A owes ₹100
      // Player B owes ₹50
      // Player C owed ₹150
      const balances = [
        { playerId: 'p1', playerName: 'Alice', netPositionPaise: -10000 },
        { playerId: 'p2', playerName: 'Bob', netPositionPaise: -5000 },
        { playerId: 'p3', playerName: 'Charlie', netPositionPaise: 15000 },
      ]

      const transfers = calculateGreedySettlementTransfers(balances)
      // Expect 2 transfers:
      // Alice -> Charlie ₹100
      // Bob -> Charlie ₹50
      expect(transfers).toHaveLength(2)
      expect(transfers[0].fromPlayerId).toBe('p1')
      expect(transfers[0].toPlayerId).toBe('p3')
      expect(transfers[0].amountPaise).toBe(10000)

      expect(transfers[1].fromPlayerId).toBe('p2')
      expect(transfers[1].toPlayerId).toBe('p3')
      expect(transfers[1].amountPaise).toBe(5000)
    })
  })
})
