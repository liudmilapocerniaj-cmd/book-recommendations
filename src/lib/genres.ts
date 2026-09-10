export const genres = [
  "Grožinė literatūra", "Fantastika", "Mokslinė fantastika", "Detektyvai",
  "Trileriai", "Romantika", "Istorinė literatūra", "Siaubo literatūra",
  "Jaunimo literatūra", "Vaikų literatūra", "Humoras", "Poezija",
  "Kelionių literatūra", "Psichologija", "Saviugda", "Verslas",
  "Biografijos", "Esė", "Kita",
];

export function decodeGenre(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}
