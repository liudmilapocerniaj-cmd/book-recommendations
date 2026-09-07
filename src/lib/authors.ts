export const authorLetters = "A Ą B C Č D E Ę Ė F G H I Į Y J K L M N O P Q R S Š T U Ų Ū V W X Z Ž".split(" ");

export function uniqueAuthors(rows: { book_author: string }[]): string[] {
  // Keep exact database values so links and equality queries stay consistent.
  return [...new Set(rows.map((row) => row.book_author).filter((name) => name.trim()))]
    .sort((a, b) => a.localeCompare(b, "lt"));
}

export function authorInitial(name: string): string {
  const initial = name.trim().normalize("NFC").charAt(0).toLocaleUpperCase("lt");
  return authorLetters.includes(initial) ? initial : "Kiti";
}
