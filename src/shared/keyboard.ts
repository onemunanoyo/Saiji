export function isImeComposing(event: KeyboardEvent): boolean {
  // Enter during conversion can have keyCode 13 with isComposing=true.
  return event.isComposing || event.keyCode === 229;
}
