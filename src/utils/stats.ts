export function calculateStars(wpm: number, accuracy: number) {
  if (accuracy >= 98 && wpm >= 60) return 3;
  if (accuracy >= 95) return 2;
  if (accuracy >= 90) return 1;
  return 0;
}

export function joinNodeText(lines: string[]) {
  return lines.join(" ");
}
