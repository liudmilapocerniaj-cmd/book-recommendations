export const genres = [
  "Grožinė literatūra", "Fantastika", "Mokslinė fantastika", "Detektyvai",
  "Trileriai", "Romantika", "Istorinė literatūra", "Psichologija", "Saviugda",
  "Verslas", "Biografijos", "Vaikų literatūra", "Kita",
];

export function decodeGenre(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}
