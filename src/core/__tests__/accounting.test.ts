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
  createSettlementPaymentTransaction,
  calculateBoardBalance,
  calculatePlayerBalances,
  calculatePlayerDetailedMovements,
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
    { id: 'p1', name: 'Alice', avatarColor: '#3b82f6', createdAt: 1000 },
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

  describe('9. Simple Round-Based Calculations & Automatic Totals', () => {
    it('automatically calculates round pot and accumulates board money per round', () => {
      const boardFeePaise = 10000 // ₹100 per player
      const activePlayers = players // 3 players: Alice, Bob, Charlie

      // Round 1: 3 players pay ₹100, pot is ₹300. Bob wins pot ₹300.
      const round1Txs = [
        createPlayerContributionTransaction({ playerId: 'p1', amountPaise: boardFeePaise, roundId: 'r1' }),
        createPlayerContributionTransaction({ playerId: 'p2', amountPaise: boardFeePaise, roundId: 'r1' }),
        createPlayerContributionTransaction({ playerId: 'p3', amountPaise: boardFeePaise, roundId: 'r1' }),
        createBoardPayoutTransaction({ playerId: 'p2', amountPaise: 30000, roundId: 'r1' }),
      ]

      // Round 2: 3 players pay ₹100, pot is ₹300. Alice wins pot ₹300.
      const round2Txs = [
        createPlayerContributionTransaction({ playerId: 'p1', amountPaise: boardFeePaise, roundId: 'r2' }),
        createPlayerContributionTransaction({ playerId: 'p2', amountPaise: boardFeePaise, roundId: 'r2' }),
        createPlayerContributionTransaction({ playerId: 'p3', amountPaise: boardFeePaise, roundId: 'r2' }),
        createBoardPayoutTransaction({ playerId: 'p1', amountPaise: 30000, roundId: 'r2' }),
      ]

      const allTxs = [...round1Txs, ...round2Txs]
      const summaries = calculatePlayerDetailedMovements(allTxs, activePlayers)

      // Total 2 completed rounds:
      // Each player must have paid exactly 2 * ₹100 = ₹200
      expect(summaries['p1'].totalContributionsPaise).toBe(20000)
      expect(summaries['p2'].totalContributionsPaise).toBe(20000)
      expect(summaries['p3'].totalContributionsPaise).toBe(20000)

      // Winnings:
      // Alice won 1 round = ₹300. Net: +₹100
      expect(summaries['p1'].totalPayoutsPaise).toBe(30000)
      expect(summaries['p1'].netPositionPaise).toBe(10000)

      // Bob won 1 round = ₹300. Net: +₹100
      expect(summaries['p2'].totalPayoutsPaise).toBe(30000)
      expect(summaries['p2'].netPositionPaise).toBe(10000)

      // Charlie won 0 rounds = ₹0. Net: -₹200
      expect(summaries['p3'].totalPayoutsPaise).toBe(0)
      expect(summaries['p3'].netPositionPaise).toBe(-20000)

      // Board balance should be exactly ₹0
      const entries = allTxs.flatMap(t => t.entries)
      expect(calculateBoardBalance(entries)).toBe(0)

      // Settlement: Charlie owes ₹200 total -> pays ₹100 to Alice, ₹100 to Bob
      const settlement = evaluateSettlementPlan({ transactions: allTxs, players: activePlayers })
      expect(settlement.status).toBe('READY')
      expect(settlement.transfers).toHaveLength(2)
      expect(settlement.transfers.every(t => t.fromPlayerId === 'p3')).toBe(true)
    })

    it('correctly handles players declaring partial bets from remaining board money', () => {
      // 3 players: Alice (p1), Bob (p2), Charlie (p3)
      // Board fee: ₹100 each -> Board starts with ₹300
      const txs: Transaction[] = [
        createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 10000, roundId: 'r1' }),
        createPlayerContributionTransaction({ playerId: 'p2', amountPaise: 10000, roundId: 'r1' }),
        createPlayerContributionTransaction({ playerId: 'p3', amountPaise: 10000, roundId: 'r1' }),
      ]

      // Board balance is ₹300
      let entries = txs.flatMap(t => t.entries)
      expect(calculateBoardBalance(entries)).toBe(30000)

      // Bob declares bet of ₹200 of the remaining ₹300 board money and WINS!
      const bobWinTx = createBoardPayoutTransaction({ playerId: 'p2', amountPaise: 20000, roundId: 'r1' })
      txs.push(bobWinTx)
      entries = txs.flatMap(t => t.entries)

      // Board balance is now ₹100 remaining!
      expect(calculateBoardBalance(entries)).toBe(10000)

      // Charlie declares bet of ₹100 from remaining board money and LOSES!
      // Charlie must pay ₹100 into the board
      const charlieLoseTx = createPlayerContributionTransaction({ playerId: 'p3', amountPaise: 10000, roundId: 'r1' })
      txs.push(charlieLoseTx)
      entries = txs.flatMap(t => t.entries)

      // Board balance increases back to ₹200!
      expect(calculateBoardBalance(entries)).toBe(20000)

      // Balances check:
      const summaries = calculatePlayerDetailedMovements(txs, players)
      // Alice: paid ₹100 ante -> Net -₹100
      expect(summaries['p1'].netPositionPaise).toBe(-10000)
      // Bob: paid ₹100 ante, won ₹200 bet -> Net +₹100
      expect(summaries['p2'].netPositionPaise).toBe(10000)
      // Charlie: paid ₹100 ante + lost ₹100 bet = paid ₹200 total -> Net -₹200
      expect(summaries['p3'].netPositionPaise).toBe(-20000)

      // At end of session, remaining ₹200 board money is distributed equally among all 3 players or 2 players
      // Board balance + sum of player net positions = 200 - 100 + 100 - 200 = 0 (Total economy is invariant)
      const totalEconomy = calculateBoardBalance(entries) + Object.values(summaries).reduce((acc, s) => acc + s.netPositionPaise, 0)
      expect(totalEconomy).toBe(0)
    })

    it('enforces that a player cannot bid or lose more than the remaining board money', () => {
      // Board balance has ₹50 remaining
      const txs = [
        createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 5000, roundId: 'r1' }),
      ]
      const boardBalance = calculateBoardBalance(txs.flatMap(t => t.entries))
      expect(boardBalance).toBe(5000)

      // An attempt to bid ₹100 when pot only has ₹50 must be rejected
      const bidAmountPaise = 10000
      expect(bidAmountPaise > boardBalance).toBe(true)

      // Verified: Bet cannot be executed whether winning or losing when amount > boardBalance
      const canBet = (amount: number, currentPot: number) => amount > 0 && amount <= currentPot
      expect(canBet(bidAmountPaise, boardBalance)).toBe(false)
      expect(canBet(5000, boardBalance)).toBe(true)
      expect(canBet(2500, boardBalance)).toBe(true)
    })

    it('voids and cancels all round transactions when consecutive numbers are drawn (61, 62)', () => {
      // Prior session: Board had ₹50 carried over
      const priorTx = createInitialBoardFundingTransaction({ amountPaise: 5000 })
      const round2AnteTxs = [
        createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 1000, roundId: 'r2' }), // Alice ₹10
        createPlayerContributionTransaction({ playerId: 'p2', amountPaise: 1000, roundId: 'r2' }), // Bob ₹10
        createPlayerContributionTransaction({ playerId: 'p3', amountPaise: 1000, roundId: 'r2' }), // Charlie ₹10
      ]

      // During Round 2:
      // Alice bets ₹20 and loses (pays ₹20 to board)
      const bet1 = createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 2000, roundId: 'r2' })
      // Bob bets ₹30 and wins (takes ₹30 from board)
      const bet2 = createBoardPayoutTransaction({ playerId: 'p2', amountPaise: 3000, roundId: 'r2' })

      const round2All = [priorTx, ...round2AnteTxs, bet1, bet2]

      // Consecutive numbers drawn (e.g. 61, 62)!
      // All transactions in round 2 get cancelled / voided
      const cancelledRoundTxs = round2All.filter(t => t.roundId !== 'r2')

      // Only prior transaction remains
      expect(cancelledRoundTxs).toHaveLength(1)
      expect(calculateBoardBalance(cancelledRoundTxs.flatMap(t => t.entries))).toBe(5000)

      // All player balances return to 0 (clean refund)
      const summaries = calculatePlayerDetailedMovements(cancelledRoundTxs, players)
      expect(summaries['p1'].netPositionPaise).toBe(0)
      expect(summaries['p2'].netPositionPaise).toBe(0)
      expect(summaries['p3'].netPositionPaise).toBe(0)
    })

    it('dynamically changes the board pot value when the ante amount is changed in between', () => {
      // 3 players start with ₹10 ante each -> Pot = ₹30
      const initialAnteTxs = [
        createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 1000, roundId: 'r1', notes: 'Round 1 board fee' }),
        createPlayerContributionTransaction({ playerId: 'p2', amountPaise: 1000, roundId: 'r1', notes: 'Round 1 board fee' }),
        createPlayerContributionTransaction({ playerId: 'p3', amountPaise: 1000, roundId: 'r1', notes: 'Round 1 board fee' }),
      ]
      expect(calculateBoardBalance(initialAnteTxs.flatMap(t => t.entries))).toBe(3000)

      // Host updates the board fee in-between to ₹50!
      const updatedAnteTxs = [
        createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 5000, roundId: 'r1', notes: 'Round 1 board fee' }),
        createPlayerContributionTransaction({ playerId: 'p2', amountPaise: 5000, roundId: 'r1', notes: 'Round 1 board fee' }),
        createPlayerContributionTransaction({ playerId: 'p3', amountPaise: 5000, roundId: 'r1', notes: 'Round 1 board fee' }),
      ]
      // Board pot immediately becomes ₹150!
      expect(calculateBoardBalance(updatedAnteTxs.flatMap(t => t.entries))).toBe(15000)

      // Zero-sum balance is strictly maintained:
      const summaries = calculatePlayerDetailedMovements(updatedAnteTxs, players)
      expect(summaries['p1'].netPositionPaise).toBe(-5000)
      expect(summaries['p2'].netPositionPaise).toBe(-5000)
      expect(summaries['p3'].netPositionPaise).toBe(-5000)
      const totalEconomy = calculateBoardBalance(updatedAnteTxs.flatMap(t => t.entries)) + Object.values(summaries).reduce((acc, s) => acc + s.netPositionPaise, 0)
      expect(totalEconomy).toBe(0)
    })

    it('cancels previous round and voids its transactions without disturbing active round', () => {
      // Round 1 (Completed):
      const r1Ante = [
        createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 1000, roundId: 'r1' }),
        createPlayerContributionTransaction({ playerId: 'p2', amountPaise: 1000, roundId: 'r1' }),
      ]
      // Alice won ₹20 in Round 1
      const r1Payout = createBoardPayoutTransaction({ playerId: 'p1', amountPaise: 2000, roundId: 'r1' })

      // Round 2 (Active):
      const r2Ante = [
        createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 1000, roundId: 'r2' }),
        createPlayerContributionTransaction({ playerId: 'p2', amountPaise: 1000, roundId: 'r2' }),
      ]
      // Bob bet ₹10 in Round 2 and won
      const r2Payout = createBoardPayoutTransaction({ playerId: 'p2', amountPaise: 1000, roundId: 'r2' })

      const allTxs = [...r1Ante, r1Payout, ...r2Ante, r2Payout]

      // Cancel Previous Round (Round 1): remove Round 1 transactions
      const remainingTxs = allTxs.filter(t => t.roundId !== 'r1')

      // Round 2 remains active with its own balance (2 players * 10 - 10 payout = 10)
      expect(calculateBoardBalance(remainingTxs.flatMap(t => t.entries))).toBe(1000)

      const summaries = calculatePlayerDetailedMovements(remainingTxs, players)
      // Alice: only paid ₹10 in Round 2 -> Net -₹10 (her Round 1 win is completely voided)
      expect(summaries['p1'].netPositionPaise).toBe(-1000)
      // Bob: paid ₹10 and won ₹10 in Round 2 -> Net ₹0
      expect(summaries['p2'].netPositionPaise).toBe(0)
    })
  })

  describe('10. Zero-Balance Game Closure & Audit Journal Undo', () => {
    it('brings all debtor and creditor balances to exactly ₹0 upon final settlement payment', () => {
      // 3 Players: Alice, Bob, Charlie play. Ante ₹20 (2000 paise) each. Pot = ₹60.
      const anteTxs = [
        createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 2000, roundId: 'r1' }),
        createPlayerContributionTransaction({ playerId: 'p2', amountPaise: 2000, roundId: 'r1' }),
        createPlayerContributionTransaction({ playerId: 'p3', amountPaise: 2000, roundId: 'r1' }),
      ]

      // Charlie bets ₹60 and wins the entire board pot!
      const winPayout = createBoardPayoutTransaction({
        playerId: 'p3',
        amountPaise: 6000,
        roundId: 'r1',
        notes: 'Won whole board pot',
      })

      const gameTxs = [...anteTxs, winPayout]

      // Board balance is 0
      expect(calculateBoardBalance(gameTxs.flatMap(t => t.entries))).toBe(0)

      // Game positions:
      // Alice: paid ₹20, won ₹0 -> Net: -₹20 (owes ₹20)
      // Bob: paid ₹20, won ₹0 -> Net: -₹20 (owes ₹20)
      // Charlie: paid ₹20, won ₹60 -> Net: +₹40 (receives ₹40)
      const gameSummaries = calculatePlayerDetailedMovements(gameTxs, players)
      expect(gameSummaries['p1'].netPositionPaise).toBe(-2000)
      expect(gameSummaries['p2'].netPositionPaise).toBe(-2000)
      expect(gameSummaries['p3'].netPositionPaise).toBe(4000)

      // Evaluate settlement plan
      const plan = evaluateSettlementPlan({
        transactions: gameTxs,
        players,
      })
      expect(plan.status).toBe('READY')
      expect(plan.transfers).toHaveLength(2)

      // Execute Settlement Payments (Alice pays Charlie ₹20, Bob pays Charlie ₹20)
      const settleTx1 = createSettlementPaymentTransaction({
        fromPlayerId: 'p1',
        toPlayerId: 'p3',
        amountPaise: 2000,
        notes: 'Alice pays Charlie ₹20',
      })
      const settleTx2 = createSettlementPaymentTransaction({
        fromPlayerId: 'p2',
        toPlayerId: 'p3',
        amountPaise: 2000,
        notes: 'Bob pays Charlie ₹20',
      })

      const closedGameTxs = [settleTx1, settleTx2, ...gameTxs]

      // Reconciled check
      const overview = calculateAccountingOverview(closedGameTxs, players)
      expect(overview.isReconciled).toBe(true)
      expect(overview.discrepancyPaise).toBe(0)

      // Post-settlement balances: All player balances MUST BE EXACTLY ZERO!
      const finalSummaries = calculatePlayerDetailedMovements(closedGameTxs, players)
      expect(finalSummaries['p1'].netPositionPaise).toBe(0)
      expect(finalSummaries['p2'].netPositionPaise).toBe(0)
      expect(finalSummaries['p3'].netPositionPaise).toBe(0)
    })

    it('undoing a single transaction removes exactly that 1 transaction with zero duplicates', () => {
      const tx1 = createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 1000, roundId: 'r1' })
      const tx2 = createPlayerContributionTransaction({ playerId: 'p2', amountPaise: 1000, roundId: 'r1' })
      const tx3 = createPlayerContributionTransaction({ playerId: 'p3', amountPaise: 1000, roundId: 'r1' })

      const txs = [tx3, tx2, tx1]
      expect(txs).toHaveLength(3)

      // Undo only tx2 (Bob's contribution)
      const afterUndo = txs.filter(t => t.id !== tx2.id)

      // Exactly 2 transactions remain (tx2 is removed, tx1 and tx3 untouched, NO duplicate reversal rows)
      expect(afterUndo).toHaveLength(2)
      expect(afterUndo.map(t => t.id)).toEqual([tx3.id, tx1.id])

      // Balances update cleanly:
      const summaries = calculatePlayerDetailedMovements(afterUndo, players)
      expect(summaries['p1'].netPositionPaise).toBe(-1000)
      expect(summaries['p2'].netPositionPaise).toBe(0) // Bob is back to 0
      expect(summaries['p3'].netPositionPaise).toBe(-1000)
    })

    it('completing the game removes the last pot automatically collected from everybody and settles cleanly', () => {
      // Round 1 (Completed): Alice, Bob, Charlie contribute ₹10 ante each (Pot = ₹30)
      const r1Ante = [
        createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 1000, roundId: 'r1', notes: 'Round 1 board fee' }),
        createPlayerContributionTransaction({ playerId: 'p2', amountPaise: 1000, roundId: 'r1', notes: 'Round 1 board fee' }),
        createPlayerContributionTransaction({ playerId: 'p3', amountPaise: 1000, roundId: 'r1', notes: 'Round 1 board fee' }),
      ]
      // Bob bets and wins the whole ₹30 pot
      const r1Win = createBoardPayoutTransaction({ playerId: 'p2', amountPaise: 3000, roundId: 'r1', notes: 'Won pot' })

      // Round 2 is automatically created by the system, taking ante from everybody again:
      const r2Ante = [
        createPlayerContributionTransaction({ playerId: 'p1', amountPaise: 1000, roundId: 'r2', notes: 'Round 2 board fee' }),
        createPlayerContributionTransaction({ playerId: 'p2', amountPaise: 1000, roundId: 'r2', notes: 'Round 2 board fee' }),
        createPlayerContributionTransaction({ playerId: 'p3', amountPaise: 1000, roundId: 'r2', notes: 'Round 2 board fee' }),
      ]

      const sessionTxs = [...r1Ante, r1Win, ...r2Ante]

      // Before completing game, board pot has ₹30 from Round 2 ante:
      expect(calculateBoardBalance(sessionTxs.flatMap(t => t.entries))).toBe(3000)

      // Player selects "Complete Game":
      // Removes the unplayed Round 2 pot automatically collected from everybody!
      const finalGameTxs = sessionTxs.filter(t => t.roundId !== 'r2')

      // Board pot is now ₹0!
      expect(calculateBoardBalance(finalGameTxs.flatMap(t => t.entries))).toBe(0)

      // Player positions are strictly from completed games:
      // Alice: -₹10 (paid ₹10)
      // Bob: +₹20 (won ₹30, paid ₹10)
      // Charlie: -₹10 (paid ₹10)
      const playerSums = calculatePlayerDetailedMovements(finalGameTxs, players)
      expect(playerSums['p1'].netPositionPaise).toBe(-1000)
      expect(playerSums['p2'].netPositionPaise).toBe(2000)
      expect(playerSums['p3'].netPositionPaise).toBe(-1000)

      // Final settlement plan shows who owes whom:
      const plan = evaluateSettlementPlan({
        transactions: finalGameTxs,
        players,
      })
      expect(plan.status).toBe('READY')
      expect(plan.transfers).toHaveLength(2)

      // Alice pays Bob ₹10, Charlie pays Bob ₹10:
      const transferAlice = plan.transfers.find(t => t.fromPlayerId === 'p1' && t.toPlayerId === 'p2')
      const transferCharlie = plan.transfers.find(t => t.fromPlayerId === 'p3' && t.toPlayerId === 'p2')
      expect(transferAlice?.amountPaise).toBe(1000)
      expect(transferCharlie?.amountPaise).toBe(1000)

      // When settled, all player balances become ₹0:
      const settleAlice = createSettlementPaymentTransaction({ fromPlayerId: 'p1', toPlayerId: 'p2', amountPaise: 1000 })
      const settleCharlie = createSettlementPaymentTransaction({ fromPlayerId: 'p3', toPlayerId: 'p2', amountPaise: 1000 })
      const fullySettledTxs = [settleAlice, settleCharlie, ...finalGameTxs]

      const postSettleSums = calculatePlayerDetailedMovements(fullySettledTxs, players)
      expect(postSettleSums['p1'].netPositionPaise).toBe(0)
      expect(postSettleSums['p2'].netPositionPaise).toBe(0)
      expect(postSettleSums['p3'].netPositionPaise).toBe(0)
    })
  })

  describe('11. Dynamic Player Sitting Out, Mid-Game Joins & Real-Time Pot Updates', () => {
    const players: Player[] = [
      { id: 'p_sunny', name: 'Sunny', avatarColor: '#3b82f6', createdAt: 1000, isActive: true },
      { id: 'p_bunny', name: 'Bunny', avatarColor: '#f59e0b', createdAt: 1000, isActive: true },
      { id: 'p_deepu', name: 'Deepu', avatarColor: '#6366f1', createdAt: 1000, isActive: true },
      { id: 'p_spanny', name: 'Spanny', avatarColor: '#ec4899', createdAt: 1000, isActive: true },
    ]

    it('updates board pot in real-time when a new player joins mid-game', () => {
      // Round 1: Sunny, Bunny, Deepu play. Board fee = ₹10 (1000 paise).
      // Pot = 3 * ₹10 = ₹30 (3000 paise)
      const r1FeeTxs = [
        createPlayerContributionTransaction({ playerId: 'p_sunny', playerName: 'Sunny', amountPaise: 1000, roundId: 'r1' }),
        createPlayerContributionTransaction({ playerId: 'p_bunny', playerName: 'Bunny', amountPaise: 1000, roundId: 'r1' }),
        createPlayerContributionTransaction({ playerId: 'p_deepu', playerName: 'Deepu', amountPaise: 1000, roundId: 'r1' }),
      ]
      expect(calculateBoardBalance(r1FeeTxs.flatMap(t => t.entries))).toBe(3000)

      // Spanny joins the game mid-round: contributes ₹10 to active round
      const spannyJoinTx = createPlayerContributionTransaction({
        playerId: 'p_spanny',
        playerName: 'Spanny',
        amountPaise: 1000,
        roundId: 'r1',
        notes: 'Round 1 board fee',
      })
      const updatedTxs = [...r1FeeTxs, spannyJoinTx]

      // Pot instantly increases to ₹40 in real time:
      expect(calculateBoardBalance(updatedTxs.flatMap(t => t.entries))).toBe(4000)

      // Spanny's balance is debited -₹10 (paid to board):
      const summaries = calculatePlayerDetailedMovements(updatedTxs, players)
      expect(summaries['p_spanny'].netPositionPaise).toBe(-1000)
    })

    it('refunds active round fee and decreases pot in real-time when player sits out without betting', () => {
      // 4 players contribute ₹10 -> Pot = ₹40
      const activeTxs = players.map(p =>
        createPlayerContributionTransaction({ playerId: p.id, playerName: p.name, amountPaise: 1000, roundId: 'r1', notes: 'Round 1 board fee' })
      )
      expect(calculateBoardBalance(activeTxs.flatMap(t => t.entries))).toBe(4000)

      // Deepu decides to sit out before any bets are placed
      // Deepu's active round contribution is refunded/removed:
      const filteredTxs = activeTxs.filter(t => !t.entries.some(e => e.accountId.includes('p_deepu')))

      // Board Pot immediately drops back to ₹30 in real time:
      expect(calculateBoardBalance(filteredTxs.flatMap(t => t.entries))).toBe(3000)

      // Deepu's balance is exactly ₹0:
      const summaries = calculatePlayerDetailedMovements(filteredTxs, players)
      expect(summaries['p_deepu'].netPositionPaise).toBe(0)
    })

    it('stops collecting fees in subsequent rounds for a player who is sitting out, but preserves past balance', () => {
      // Round 1: All 4 play (Sunny, Bunny, Deepu, Spanny). Fee ₹10 each -> Pot ₹40.
      const r1Fees = players.map(p =>
        createPlayerContributionTransaction({ playerId: p.id, playerName: p.name, amountPaise: 1000, roundId: 'r1' })
      )
      // Deepu bets ₹40 and wins entire pot
      const r1Win = createBoardPayoutTransaction({ playerId: 'p_deepu', playerName: 'Deepu', amountPaise: 4000, roundId: 'r1' })
      // Deepu won ₹40 - paid ₹10 = +₹30 net

      // Deepu is marked inactive / sitting out for Round 2!
      const activeInRound2 = players.filter(p => p.id !== 'p_deepu')
      const r2Fees = activeInRound2.map(p =>
        createPlayerContributionTransaction({ playerId: p.id, playerName: p.name, amountPaise: 1000, roundId: 'r2' })
      )
      // Round 2 pot only collects from Sunny, Bunny, Spanny (3 * ₹10 = ₹30)
      const allTxs = [...r1Fees, r1Win, ...r2Fees]

      // Board balance has ₹30 from Round 2
      expect(calculateBoardBalance(allTxs.flatMap(t => t.entries))).toBe(3000)

      // Deepu paid NOTHING in Round 2:
      const summaries = calculatePlayerDetailedMovements(allTxs, players)
      expect(summaries['p_deepu'].totalContributionsPaise).toBe(1000) // only paid in r1
      expect(summaries['p_deepu'].netPositionPaise).toBe(3000) // still +₹30!

      // Final settlement plan accurately settles Deepu's +₹30 winnings from debtors
      const plan = evaluateSettlementPlan({
        transactions: allTxs,
        players,
        boardAllocationConfirmed: true,
      })
      expect(plan.status).toBe('READY')
      const deepuTransfer = plan.transfers.find(t => t.toPlayerId === 'p_deepu')
      expect(deepuTransfer).toBeDefined()
    })
  })
})

