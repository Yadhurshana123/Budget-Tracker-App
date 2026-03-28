/** LKR (Sri Lankan rupees) display */
export function formatLkr(amount) {
  const n = typeof amount === 'number' ? amount : parseFloat(amount)
  const v = Number.isFinite(n) ? n : 0
  return `Rs. ${v.toFixed(2)}`
}
