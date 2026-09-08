"use client";

import { useState } from "react";
import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { Recommender } from "@/components/recommender";
import { GenreLabel } from "@/components/genre-label";

type Recommendation = {
  id: string;
  user_id: string;
  book_title: string;
  book_author: string;
  description: string;
  cover_url?: string | null;
  genre?: string | null;
  created_at?: string | null;
};

type SortOption = "newest" | "oldest" | "title-asc" | "author-asc";

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Naujausios",
  oldest: "Seniausios",
  "title-asc": "Pavadinimas A–Ž",
  "author-asc": "Autorius A–Ž",
};

const PAGE_SIZE = 6;

function sortRecommendations(books: Recommendation[], sort: SortOption) {
  const sorted = [...books];
  switch (sort) {
    case "newest":
      sorted.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
      break;
    case "oldest":
      sorted.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
      break;
    case "title-asc":
      sorted.sort((a, b) => a.book_title.localeCompare(b.book_title, "lt"));
      break;
    case "author-asc":
      sorted.sort((a, b) => a.book_author.localeCompare(b.book_author, "lt"));
      break;
  }
  return sorted;
}

export function RecommendationSearch({ recommendations, profileNames }: { recommendations: Recommendation[]; profileNames: Record<string, string> }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [resetKey, setResetKey] = useState(`${search}|${sort}`);
  const query = search.trim().toLocaleLowerCase("lt");
  const filtered = recommendations.filter((book) =>
    book.book_title.toLocaleLowerCase("lt").includes(query) ||
    book.book_author.toLocaleLowerCase("lt").includes(query),
  );
  const matches = sortRecommendations(filtered, sort);
  const currentKey = `${search}|${sort}`;
  if (currentKey !== resetKey) {
    setResetKey(currentKey);
    setVisibleCount(PAGE_SIZE);
  }
  const visible = matches.slice(0, visibleCount);

  return (
    <>
      <div className="recommendation-toolbar">
        <div className="recommendation-search" role="search">
          <label htmlFor="recommendation-search">Paieška</label>
          <input id="recommendation-search" type="search" value={search}
            placeholder="Ieškoti pagal knygos pavadinimą arba autorių..."
            onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="recommendation-sort">
          <label htmlFor="recommendation-sort">Rikiuoti</label>
          <select id="recommendation-sort" value={sort}
            onChange={(event) => setSort(event.target.value as SortOption)}>
            {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
              <option key={option} value={option}>{SORT_LABELS[option]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="recommendation-grid" aria-live="polite" aria-atomic="false">
        {matches.length === 0 ? (
          <p>{query ? "Rekomendacijų pagal jūsų paiešką nerasta." : "Rekomendacijų dar nėra."}</p>
        ) : visible.map((book) => (
          <div key={book.id} className="recommendation-card recommendation-with-cover recommendation-card-link profile-card">
            <BookCover url={book.cover_url} title={book.book_title} />
            <div className="recommendation-content">
            <h3 className="book-title"><Link className="card-detail-link" href={`/recommendations/${book.id}`}>{book.book_title}</Link></h3>
            <p className="book-author">{book.book_author}</p>
            <GenreLabel genre={book.genre} />
            <p className="book-description"><span className="book-description-text">{book.description}</span></p>
            <Recommender userId={book.user_id} name={profileNames[book.user_id]} />
            </div>
          </div>
        ))}
      </div>
      {visibleCount < matches.length ? (
        <div className="recommendation-load-more">
          <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
            Rodyti daugiau
          </button>
        </div>
      ) : null}
    </>
  );
}
