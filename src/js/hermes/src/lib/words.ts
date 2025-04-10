export function capitalize(phrase: string) {
  const words = phrase.split(/[_\s]+/)
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}
