import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SongPick = {
  title: string;
  artist: string;
  album: string;
  cover: string;
  previewUrl: string;
  link: string;
  excerpt: string;
};

type MoviePick = {
  title: string;
  year: number;
  poster: string;
  note: string;
  link: string;
};

type SeriesPick = {
  title: string;
  years: string;
  poster: string;
  note: string;
  link: string;
};

function dayNumber(date: string) {
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 86_400_000) : 0;
}

function chooseOfDay<T>(items: T[], day: number, offset = 0) {
  if (!items.length) return null;
  return items[((day + offset) % items.length + items.length) % items.length];
}

function cleanSummary(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

async function fetchSong(day: number): Promise<SongPick | null> {
  try {
    const params = new URLSearchParams({ term: "romantic love", entity: "song", limit: "50", country: "ph", explicit: "No" });
    const response = await fetch(`https://itunes.apple.com/search?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const tracks = Array.isArray(data?.results)
      ? data.results.filter((track: any) => typeof track?.trackName === "string" && typeof track?.artistName === "string" && typeof track?.trackViewUrl === "string")
      : [];
    const track = chooseOfDay(tracks, day);
    if (!track) return null;
    const album = typeof track.collectionName === "string" ? track.collectionName : "";
    return {
      title: track.trackName,
      artist: track.artistName,
      album,
      cover: "",
      previewUrl: "",
      link: track.trackViewUrl,
      excerpt: album ? `From the album ${album}.` : `A daily pick from the Apple music catalog.`,
    };
  } catch {
    return null;
  }
}

async function fetchMovie(day: number): Promise<MoviePick | null> {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const page = (day % 10) + 1;
    const params = new URLSearchParams({
      api_key: apiKey,
      include_adult: "false",
      language: "en-US",
      page: String(page),
      primary_release_date_lte: new Date().toISOString().slice(0, 10),
      sort_by: "popularity.desc",
      with_genres: "35,10749",
    });
    const response = await fetch(`https://api.themoviedb.org/3/discover/movie?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const movies = Array.isArray(data?.results)
      ? data.results.filter((movie: any) => typeof movie?.title === "string" && typeof movie?.release_date === "string")
      : [];
    const movie = chooseOfDay(movies, Math.floor(day / 10));
    if (!movie) return null;
    const year = Number(movie.release_date.slice(0, 4));
    return {
      title: movie.title,
      year: Number.isInteger(year) ? year : 0,
      poster: typeof movie.poster_path === "string" ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : "",
      note: cleanSummary(movie.overview) || "A romantic comedy pick from The Movie Database.",
      link: `https://www.themoviedb.org/movie/${movie.id}`,
    };
  } catch {
    return null;
  }
}

async function fetchSeries(day: number): Promise<SeriesPick | null> {
  try {
    const response = await fetch(`https://api.tvmaze.com/search/shows?q=romance`, {
      cache: "no-store",
      headers: { "User-Agent": "OurLittleWorld/1.0 (daily recommendations)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const shows = Array.isArray(data)
      ? data
          .map((result: any) => result?.show)
          .filter((show: any) => {
            const genres = Array.isArray(show?.genres) ? show.genres.map((genre: string) => genre.toLowerCase()) : [];
            return typeof show?.name === "string" && (genres.includes("comedy") || genres.includes("romance"));
          })
      : [];
    const show = chooseOfDay(shows, day);
    if (!show) return null;
    const startYear = typeof show.premiered === "string" ? show.premiered.slice(0, 4) : "";
    const endYear = typeof show.ended === "string" ? show.ended.slice(0, 4) : "";
    const years = startYear ? `${startYear}${endYear && endYear !== startYear ? `–${endYear}` : endYear ? "" : "–present"}` : "";
    return {
      title: show.name,
      years,
      poster: typeof show.image?.medium === "string" ? show.image.medium : "",
      note: cleanSummary(show.summary) || "A romance or comedy pick from the TVmaze catalog.",
      link: typeof show.url === "string" ? show.url : "https://www.tvmaze.com/",
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const requestedDate = new URL(request.url).searchParams.get("date") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const day = dayNumber(date);
  const [song, movie, series] = await Promise.all([fetchSong(day), fetchMovie(day), fetchSeries(day + 2)]);
  const warnings: string[] = [];
  if (!song) warnings.push("Song catalog could not be reached right now.");
  if (!movie) warnings.push(process.env.TMDB_API_KEY?.trim() ? "Movie catalog could not be reached right now." : "Add a free TMDB_API_KEY to enable movie picks.");
  if (!series) warnings.push("TVmaze could not provide a series pick right now.");

  if (!song && !movie && !series) {
    return NextResponse.json(
      { error: "The public catalogs could not be reached.", warnings },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { song, movie, series, warnings, source: "public-catalogs", date },
    { headers: { "Cache-Control": "no-store" } },
  );
}
