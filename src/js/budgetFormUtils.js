export const emptyItem = () => ({ product_name: '', quantity: '', amount: '' })

export const emptyPerHeadBlock = () => ({
  for_user_id: '',
  items: [emptyItem()],
})

export function qtyToDb(raw) {
  const s = String(raw ?? '').trim()
  return s === '' ? null : s
}

export function validateLineItem(item, errorPrefix) {
  if (!item.product_name.trim()) {
    return errorPrefix ? `${errorPrefix}Each product needs a name.` : 'All items need a product name.'
  }
  const qStr = String(item.quantity ?? '').trim()
  // No strict quantity validation anymore (strings allowed)
  if (!item.amount || isNaN(item.amount) || Number(item.amount) <= 0) {
    return errorPrefix ? `${errorPrefix}Enter a valid amount for each product.` : 'Enter valid amount for all items.'
  }
  return null
}

export function lineHasAnyData(item) {
  return Boolean(
    item.product_name.trim()
    || String(item.quantity ?? '').trim()
    || (item.amount !== '' && item.amount != null && String(item.amount).trim() !== ''),
  )
}

export function parsePerHeadBlocks(perHeadBlocks) {
  const active = perHeadBlocks.filter((block) => {
    const hasUser = Boolean(block.for_user_id)
    const hasLines = block.items.some(lineHasAnyData)
    return hasUser || hasLines
  })

  for (const block of active) {
    if (!block.for_user_id) {
      return { ok: false, error: 'Per head: select a name for each person who has products.' }
    }
    const meaningful = block.items.filter(lineHasAnyData)
    if (meaningful.length === 0) {
      return { ok: false, error: 'Per head: add at least one product for each selected person, or remove that person.' }
    }
    for (const item of meaningful) {
      const err = validateLineItem(item, 'Per head: ')
      if (err) return { ok: false, error: err }
    }
  }

  const normalized = active.map((block) => ({
    for_user_id: block.for_user_id,
    items: block.items.filter(lineHasAnyData),
  }))

  return { ok: true, blocks: normalized }
}

export function parseMainItems(items) {
  const meaningful = items.filter(lineHasAnyData)
  for (const item of meaningful) {
    const err = validateLineItem(item, '')
    if (err) return { ok: false, error: err }
  }
  return { ok: true, meaningful }
}
