import { genres } from "@/lib/genres";

export function GenreSelect({ value, disabled }: { value?: string | null; disabled: boolean }) {
  return <>
    <label htmlFor="genre">Žanras</label>
    <select id="genre" name="genre" className="genre-select" defaultValue={value ?? ""} disabled={disabled}>
      <option value="">Nenurodyta</option>
      {genres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
    </select>
  </>;
}
