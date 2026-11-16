/**
 * Money Utility Module for CoinLedger
 * Strictly operates on integer paise (1 Rupee = 100 paise).
 * Floating-point arithmetic for currency calculations is strictly prohibited.
 */

export function assertPaiseInteger(amountPaise: number, label = 'Amount'): void {
  if (typeof amountPaise !== 'number') {
    throw new Error(`${label} must be a number, received: ${typeof amountPaise}`)
  }
  if (!Number.isFinite(amountPaise)) {
    throw new Error(`${label} must be a finite number`)
  }
  if (!Number.isInteger(amountPaise)) {
    throw new Error(`${label} must be an integer paise amount, received floating point: ${amountPaise}`)
  }
  if (amountPaise < 0) {
    throw new Error(`${label} must be non-negative, received: ${amountPaise}`)
  }
  if (amountPaise > Number.MAX_SAFE_INTEGER) {
    throw new Error(`${label} exceeds maximum safe integer`)
  }
}

/**
 * Parses user input in Rupees (e.g. "100", "100.5", "100.50", 100) into exact integer paise.
 * Avoids direct float multiplication bugs like 0.1 + 0.2.
 */
export function parseRupeesToPaise(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new Error('Input must be finite')
    if (input < 0) throw new Error('Amount cannot be negative')
    // Stringify to parse digits cleanly
    return parseRupeesToPaise(input.toString())
  }

  const clean = input.trim().replace(/,/g, '').replace(/₹/g, '').trim()
  if (!clean) return 0

  if (!/^\d+(\.\d{1,2})?$/.test(clean)) {
    throw new Error(`Invalid currency format: "${input}". Use whole rupees or up to 2 decimal places.`)
  }

  const parts = clean.split('.')
  const rupees = parseInt(parts[0], 10)
  if (isNaN(rupees)) throw new Error(`Invalid rupee amount in "${input}"`)

  let paise = 0
  if (parts.length === 2) {
    const fraction = parts[1]
    if (fraction.length === 1) {
      paise = parseInt(fraction, 10) * 10
    } else if (fraction.length === 2) {
      paise = parseInt(fraction, 10)
    }
  }

  const totalPaise = rupees * 100 + paise
  assertPaiseInteger(totalPaise, 'Parsed amount')
  return totalPaise
}

/**
 * Formats integer paise into Indian Rupee display (e.g. ₹100 or ₹100.50 or -₹50).
 */
export function formatPaise(
  paise: number,
  options: {
    showSign?: boolean
    alwaysShowDecimals?: boolean
    currencySymbol?: string
  } = {}
): string {
  const { showSign = false, alwaysShowDecimals = false, currencySymbol = '₹' } = options

  if (!Number.isInteger(paise)) {
    console.warn(`formatPaise received non-integer paise: ${paise}`)
    paise = Math.round(paise)
  }

  const isNegative = paise < 0
  const absPaise = Math.abs(paise)
  const rupees = Math.floor(absPaise / 100)
  const remainingPaise = absPaise % 100

  // Format with Indian numbering system (e.g. 1,00,000)
  const rupeesFormatted = rupees.toLocaleString('en-IN')

  let formattedAmount = rupeesFormatted
  if (alwaysShowDecimals || remainingPaise > 0) {
    formattedAmount += `.${remainingPaise.toString().padStart(2, '0')}`
  }

  const sign = isNegative ? '-' : showSign && paise > 0 ? '+' : ''
  return `${sign}${currencySymbol}${formattedAmount}`
}

export function formatPaisePlain(paise: number): string {
  const isNegative = paise < 0
  const absPaise = Math.abs(paise)
  const rupees = Math.floor(absPaise / 100)
  const remainingPaise = absPaise % 100
  const sign = isNegative ? '-' : ''
  if (remainingPaise === 0) {
    return `${sign}${rupees}`
  }
  return `${sign}${rupees}.${remainingPaise.toString().padStart(2, '0')}`
}
