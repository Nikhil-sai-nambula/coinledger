import { formatPaise } from './money'
import { Player, SettlementTransfer, PlayerBalanceSummary } from '../types/accounting'

export interface ReceiptData {
  gameName: string
  completedRoundsCount: number
  boardMoneyPaise: number
  boardBalancePaise: number
  players: Player[]
  playerSummaries: Record<string, PlayerBalanceSummary>
  transfers: SettlementTransfer[]
  completedTransferIds: Set<string>
}

// Rounded rectangle helper for Canvas 2D
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.arcTo(x + w, y, x + w, y + radius, radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius)
  ctx.lineTo(x + radius, y + h)
  ctx.arcTo(x, y + h, x, y + h - radius, radius)
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.closePath()
}

export async function generateSettlementPngBlob(data: ReceiptData): Promise<Blob> {
  const {
    completedRoundsCount,
    boardMoneyPaise,
    boardBalancePaise,
    players,
    playerSummaries,
    transfers,
    completedTransferIds,
  } = data

  const width = 940
  const padding = 32

  // Calculate dynamic height
  const headerHeight = 170
  const showPotWarning = boardBalancePaise > 0
  const transfersCardHeight = transfers.length === 0 ? 110 : 80 + transfers.length * 64 + 20 + (showPotWarning ? 40 : 0)
  const leaderboardCardHeight = 85 + 36 + players.length * 48 + 24
  const footerHeight = 80
  const totalHeight = padding + headerHeight + 24 + transfersCardHeight + 24 + leaderboardCardHeight + 24 + footerHeight + padding

  const canvas = document.createElement('canvas')
  const scale = 2 // 2x Retina resolution
  canvas.width = width * scale
  canvas.height = totalHeight * scale

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')

  ctx.scale(scale, scale)

  // 1. Background
  ctx.fillStyle = '#F8F8F8'
  ctx.fillRect(0, 0, width, totalHeight)

  let currentY = padding

  // 2. Header Hero Card (#152822 BentoML Verde Forte)
  const heroX = padding
  const heroY = currentY
  const heroW = width - padding * 2
  const heroH = headerHeight

  roundRect(ctx, heroX, heroY, heroW, heroH, 20)
  ctx.fillStyle = '#152822'
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#000000'
  ctx.stroke()

  // Emblem squircle (#B6EA84)
  const emblemX = heroX + 28
  const emblemY = heroY + 28
  roundRect(ctx, emblemX, emblemY, 44, 44, 12)
  ctx.fillStyle = '#B6EA84'
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#000000'
  ctx.stroke()

  // Coin symbols on emblem
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(emblemX + 18, emblemY + 18, 9, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(emblemX + 26, emblemY + 26, 9, 0, Math.PI * 2)
  ctx.stroke()

  // App Title
  ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText('Coins', emblemX + 56, emblemY + 26)
  ctx.fillStyle = '#B6EA84'
  ctx.fillText('Ledger', emblemX + 118, emblemY + 26)

  // Tag pill: ZERO-SUM ACCURACY
  const tagText = '100% ZERO-SUM SETTLEMENT'
  ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace'
  const tagMetrics = ctx.measureText(tagText)
  const tagW = tagMetrics.width + 16
  const tagX = heroX + heroW - 28 - tagW
  const tagY = heroY + 28
  roundRect(ctx, tagX, tagY, tagW, 24, 12)
  ctx.fillStyle = '#B6EA84'
  ctx.fill()
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = '#000000'
  ctx.fillText(tagText, tagX + 8, tagY + 16)

  // Header Subtitle
  ctx.font = '800 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText('Final Game Settlement & Scorecard', emblemX, emblemY + 74)

  // Header Session Stats
  ctx.font = '500 13px ui-monospace, SFMono-Regular, monospace'
  ctx.fillStyle = '#D0E6D6'
  const dateStr = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  ctx.fillText(
    `Date: ${dateStr}  •  Completed Rounds: ${completedRoundsCount}  •  Board Fee: ${formatPaise(boardMoneyPaise)}`,
    emblemX,
    emblemY + 104
  )

  currentY += headerHeight + 24

  // 3. Section 1: Who Owes Whom (Transfers)
  const card1X = padding
  const card1Y = currentY
  const card1W = width - padding * 2
  const card1H = transfersCardHeight

  roundRect(ctx, card1X, card1Y, card1W, card1H, 20)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#D8D8D8'
  ctx.stroke()

  // Title of Section 1
  ctx.font = '800 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = '#000000'
  ctx.fillText('💸 Direct Settlement Payments (Who Owes Whom)', card1X + 24, card1Y + 36)

  ctx.font = '500 12px ui-monospace, SFMono-Regular, monospace'
  ctx.fillStyle = '#616161'
  ctx.fillText(
    transfers.length === 1 ? '1 Optimized Transfer' : `${transfers.length} Optimized Transfers`,
    card1X + card1W - 24 - 150,
    card1Y + 36
  )

  // Divider
  ctx.strokeStyle = '#E5E5E5'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(card1X + 24, card1Y + 54)
  ctx.lineTo(card1X + card1W - 24, card1Y + 54)
  ctx.stroke()

  let transferRowY = card1Y + 70

  if (transfers.length === 0) {
    const anyOutstanding = players.some(p => (playerSummaries[p.id]?.netPositionPaise || 0) !== 0)
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    if (boardBalancePaise > 0) {
      ctx.fillStyle = '#8A5A00'
      ctx.fillText(`⚠ Board pot still holds ${formatPaise(boardBalancePaise)}. Distribute it in the app to finalize who pays whom.`, card1X + 28, transferRowY + 16)
    } else if (anyOutstanding) {
      ctx.fillStyle = '#8A5A00'
      ctx.fillText('⚠ Player balances are still outstanding. See the scorecard below for who owes what.', card1X + 28, transferRowY + 16)
    } else {
      ctx.fillStyle = '#194220'
      ctx.fillText('✅ All player accounts are completely settled (₹0.00). No transfers needed!', card1X + 28, transferRowY + 16)
    }
  } else {
    transfers.forEach((t, i) => {
      const fromP = players.find(p => p.id === t.fromPlayerId)
      const toP = players.find(p => p.id === t.toPlayerId)
      const isPaid = completedTransferIds.has(t.id)

      // Transfer row background
      roundRect(ctx, card1X + 20, transferRowY, card1W - 40, 52, 14)
      ctx.fillStyle = '#F8F8F8'
      ctx.fill()
      ctx.strokeStyle = isPaid ? '#D8D8D8' : '#000000'
      ctx.lineWidth = isPaid ? 1 : 1.5
      ctx.stroke()

      // Index
      ctx.font = 'bold 12px ui-monospace, SFMono-Regular, monospace'
      ctx.fillStyle = '#888888'
      ctx.fillText(`#${i + 1}`, card1X + 36, transferRowY + 31)

      // Payer Avatar
      const pAvX = card1X + 68
      const pAvY = transferRowY + 12
      roundRect(ctx, pAvX, pAvY, 28, 28, 14)
      ctx.fillStyle = '#EB575722'
      ctx.fill()
      ctx.strokeStyle = '#EB575766'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillStyle = '#EB5757'
      ctx.fillText(fromP?.name.substring(0, 2).toUpperCase() || 'P1', pAvX + 7, pAvY + 18)

      // Payer Name
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillStyle = '#000000'
      ctx.fillText(fromP?.name || 'Player', pAvX + 36, transferRowY + 24)
      ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace'
      ctx.fillStyle = '#EB5757'
      ctx.fillText('PAYS', pAvX + 36, transferRowY + 38)

      // Arrow & Amount Center
      const centerX = card1X + (card1W / 2) - 40
      ctx.font = '900 18px ui-monospace, SFMono-Regular, monospace'
      ctx.fillStyle = '#194220'
      ctx.fillText(formatPaise(t.amountPaise), centerX, transferRowY + 28)
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillStyle = '#888888'
      ctx.fillText('➔', centerX + 18, transferRowY + 44)

      // Receiver Avatar & Name
      const rAvX = card1X + card1W - 250
      const rAvY = transferRowY + 12
      roundRect(ctx, rAvX, rAvY, 28, 28, 14)
      ctx.fillStyle = '#B6EA84'
      ctx.fill()
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillStyle = '#000000'
      ctx.fillText(toP?.name.substring(0, 2).toUpperCase() || 'P2', rAvX + 7, rAvY + 18)

      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillStyle = '#000000'
      ctx.fillText(toP?.name || 'Player', rAvX + 36, transferRowY + 24)
      ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace'
      ctx.fillStyle = '#194220'
      ctx.fillText('RECEIVES', rAvX + 36, transferRowY + 38)

      // Status Pill (Right)
      const stW = 68
      const stX = card1X + card1W - 36 - stW
      const stY = transferRowY + 15
      roundRect(ctx, stX, stY, stW, 22, 11)
      if (isPaid) {
        ctx.fillStyle = '#B6EA84'
        ctx.fill()
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.font = '900 9px ui-monospace, SFMono-Regular, monospace'
        ctx.fillStyle = '#000000'
        ctx.fillText('PAID ✓', stX + 16, stY + 15)
      } else {
        ctx.fillStyle = '#E5E5E5'
        ctx.fill()
        ctx.strokeStyle = '#D8D8D8'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.font = 'bold 9px ui-monospace, SFMono-Regular, monospace'
        ctx.fillStyle = '#616161'
        ctx.fillText('PENDING', stX + 12, stY + 15)
      }

      transferRowY += 64
    })

    if (showPotWarning) {
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillStyle = '#8A5A00'
      ctx.fillText(`⚠ Board pot still holds ${formatPaise(boardBalancePaise)}. Distribute it in the app to finalize who pays whom.`, card1X + 28, transferRowY + 16)
    }
  }

  currentY += transfersCardHeight + 24

  // 4. Section 2: Player Leaderboard Table
  const card2X = padding
  const card2Y = currentY
  const card2W = width - padding * 2
  const card2H = leaderboardCardHeight

  roundRect(ctx, card2X, card2Y, card2W, card2H, 20)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#D8D8D8'
  ctx.stroke()

  // Title of Section 2
  ctx.font = '800 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = '#000000'
  ctx.fillText('🏆 Final Player Scorecard & Net Positions', card2X + 24, card2Y + 36)

  // Table Columns Header
  const thY = card2Y + 68
  ctx.fillStyle = '#F8F8F8'
  roundRect(ctx, card2X + 20, thY - 14, card2W - 40, 28, 8)
  ctx.fill()

  ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace'
  ctx.fillStyle = '#616161'
  ctx.fillText('RANK / PLAYER', card2X + 36, thY + 4)
  ctx.fillText('GAME PAID', card2X + 320, thY + 4)
  ctx.fillText('GAME WON', card2X + 460, thY + 4)
  ctx.fillText('NET PROFIT / LOSS', card2X + 600, thY + 4)
  ctx.fillText('FINAL STATUS', card2X + 760, thY + 4)

  // Sort players by net position descending
  const sortedPlayers = [...players].sort((a, b) => {
    const sA = (playerSummaries[a.id]?.totalPayoutsPaise || 0) - (playerSummaries[a.id]?.totalContributionsPaise || 0)
    const sB = (playerSummaries[b.id]?.totalPayoutsPaise || 0) - (playerSummaries[b.id]?.totalContributionsPaise || 0)
    return sB - sA
  })

  let tableRowY = thY + 28

  sortedPlayers.forEach((p, idx) => {
    const s = playerSummaries[p.id]
    const paid = s?.totalContributionsPaise || 0
    const won = s?.totalPayoutsPaise || 0
    const net = won - paid
    const closing = s?.netPositionPaise || 0

    // Row separator
    ctx.strokeStyle = '#E5E5E5'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(card2X + 24, tableRowY - 6)
    ctx.lineTo(card2X + card2W - 24, tableRowY - 6)
    ctx.stroke()

    // Rank & Name
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.fillStyle = '#000000'
    ctx.fillText(`${medal}  ${p.name}`, card2X + 36, tableRowY + 18)

    // Paid
    ctx.font = 'bold 12px ui-monospace, SFMono-Regular, monospace'
    ctx.fillStyle = '#EB5757'
    ctx.fillText(`-${formatPaise(paid)}`, card2X + 320, tableRowY + 18)

    // Won
    ctx.fillStyle = '#194220'
    ctx.fillText(`+${formatPaise(won)}`, card2X + 460, tableRowY + 18)

    // Net
    ctx.font = '900 13px ui-monospace, SFMono-Regular, monospace'
    if (net > 0) {
      ctx.fillStyle = '#194220'
      ctx.fillText(`+${formatPaise(net)}`, card2X + 600, tableRowY + 18)
    } else if (net < 0) {
      ctx.fillStyle = '#EB5757'
      ctx.fillText(formatPaise(net), card2X + 600, tableRowY + 18)
    } else {
      ctx.fillStyle = '#616161'
      ctx.fillText('₹0.00', card2X + 600, tableRowY + 18)
    }

    // Status Pill (Right)
    const stW = 90
    const stX = card2X + 750
    const stY = tableRowY + 2
    roundRect(ctx, stX, stY, stW, 22, 11)

    if (closing === 0) {
      ctx.fillStyle = '#B6EA84'
      ctx.fill()
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.font = '900 9px ui-monospace, SFMono-Regular, monospace'
      ctx.fillStyle = '#000000'
      ctx.fillText('₹0.00 SETTLED', stX + 11, stY + 15)
    } else if (closing < 0) {
      ctx.fillStyle = '#EB575722'
      ctx.fill()
      ctx.strokeStyle = '#EB575755'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.font = 'bold 9px ui-monospace, SFMono-Regular, monospace'
      ctx.fillStyle = '#EB5757'
      ctx.fillText(`OWES ${formatPaise(Math.abs(closing))}`, stX + 8, stY + 15)
    } else {
      ctx.fillStyle = '#B6EA8444'
      ctx.fill()
      ctx.strokeStyle = '#B6EA84'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.font = 'bold 9px ui-monospace, SFMono-Regular, monospace'
      ctx.fillStyle = '#194220'
      ctx.fillText(`RECEIVES ${formatPaise(closing)}`, stX + 6, stY + 15)
    }

    tableRowY += 48
  })

  currentY += leaderboardCardHeight + 24

  // 5. Footer Branding
  const footerY = currentY
  ctx.strokeStyle = '#D8D8D8'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(padding, footerY)
  ctx.lineTo(width - padding, footerY)
  ctx.stroke()

  ctx.font = '500 12px ui-monospace, SFMono-Regular, monospace'
  ctx.fillStyle = '#616161'
  ctx.fillText('Coins Ledger • Zero-Sum Multi-Round Ledger • 100% Mathematical Precision', padding, footerY + 30)

  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = '#000000'
  ctx.fillText('Created by Nikhil Sai Nambula', width - padding - 210, footerY + 30)

  // Convert canvas to PNG blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Canvas to Blob conversion failed'))
      }
    }, 'image/png')
  })
}

export async function shareOrDownloadReceipt(data: ReceiptData): Promise<'shared' | 'downloaded'> {
  const blob = await generateSettlementPngBlob(data)
  const file = new File([blob], 'coins-ledger-settlement.png', { type: 'image/png' })

  // Try Native Share API first (e.g. on mobile/Safari where user can share directly to WhatsApp)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: 'Coins Ledger — Final Settlement',
        text: 'Final settlement scorecard and who owes whom for our game session.',
        files: [file],
      })
      return 'shared'
    } catch (err: unknown) {
      // If user cancelled share sheet, fallback to download
      if (err instanceof Error && err.name === 'AbortError') {
        return 'downloaded'
      }
    }
  }

  // Fallback to direct file download
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `coins-ledger-settlement-${Date.now()}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 3000)

  return 'downloaded'
}
