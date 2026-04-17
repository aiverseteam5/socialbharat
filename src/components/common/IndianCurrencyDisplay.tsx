/**
 * Indian Currency Display Component
 * Formats numbers in Indian numbering system (lakhs/crores)
 * Not Western comma grouping
 */

interface IndianCurrencyDisplayProps {
  amount: number // in paise
  showPaise?: boolean
}

export function IndianCurrencyDisplay({ amount, showPaise = false }: IndianCurrencyDisplayProps) {
  // Convert paise to rupees
  const rupees = amount / 100

  // Format in Indian numbering system
  const formatted = formatIndianCurrency(rupees, showPaise)

  return <span>{formatted}</span>
}

/**
 * Format currency in Indian numbering system
 * Indian system: 1,00,000 (1 lakh) instead of 100,000 (Western)
 */
function formatIndianCurrency(amount: number, showPaise: boolean): string {
  const isNegative = amount < 0
  const absoluteAmount = Math.abs(amount)

  // Split into rupees and paise
  const rupeesPart = Math.floor(absoluteAmount)
  const paisePart = Math.round((absoluteAmount - rupeesPart) * 100)

  // Format rupees in Indian numbering system
  const formattedRupees = formatIndianNumber(rupeesPart)

  let result = `₹${isNegative ? '-' : ''}${formattedRupees}`

  if (showPaise && paisePart > 0) {
    result += `.${paisePart.toString().padStart(2, '0')}`
  }

  return result
}

/**
 * Format number in Indian numbering system
 * Groups by 2 digits after the first 3 digits from right
 */
function formatIndianNumber(num: number): string {
  const numStr = Math.floor(num).toString()
  
  if (numStr.length <= 3) {
    return numStr
  }

  // Indian numbering: first group from right is 3 digits, then groups of 2
  const lastThree = numStr.slice(-3)
  const otherDigits = numStr.slice(0, -3)

  // Split remaining digits into groups of 2 from right
  const groups = []
  for (let i = otherDigits.length; i > 0; i -= 2) {
    groups.unshift(otherDigits.slice(Math.max(0, i - 2), i))
  }

  return groups.join(',') + ',' + lastThree
}

export default IndianCurrencyDisplay
