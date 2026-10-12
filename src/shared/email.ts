export function isValidEmail(value: string): boolean {
  const email = value.trim()
  if (!email || email.length > 254 || /\s/u.test(email)) return false
  const at = email.indexOf('@')
  if (at < 1 || at !== email.lastIndexOf('@')) return false
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false
  if (!/^[\p{L}\p{N}!#$%&'*+/=?^_`{|}~.-]+$/u.test(local)) return false
  const labels = domain.split('.')
  if (labels.length < 2 || labels.at(-1)!.length < 2) return false
  return labels.every((label) => label.length <= 63 && /^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u.test(label))
}
