import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const posterHosts = new Set(["m.media-amazon.com", "static.tvmaze.com", "upload.wikimedia.org", "thumb.wikimedia.org"]);

async function proxyPoster(rawUrl: string, title = "", allowFallback = true): Promise<Response> {
  const fallbackToWikipedia = async (): Promise<Response | null> => {
    if (!allowFallback || !title) return null;
    const wikiPoster = await fetchWikipediaPoster(title);
    return wikiPoster && wikiPoster !== rawUrl ? proxyPoster(wikiPoster, "", false) : null;
  };

  let imageUrl: URL;
  try {
    imageUrl = new URL(rawUrl);
  } catch {
    return await fallbackToWikipedia() ?? NextResponse.json({ error: "Invalid poster URL." }, { status: 400 });
  }

  const allowedHost = posterHosts.has(imageUrl.hostname) || /^is\d+-ssl\.mzstatic\.com$/.test(imageUrl.hostname);
  if (imageUrl.protocol !== "https:" || !allowedHost) {
    return await fallbackToWikipedia() ?? NextResponse.json({ error: "Poster host is not allowed." }, { status: 403 });
  }

  try {
    const response = await fetch(imageUrl, {
      cache: "force-cache",
      redirect: "error",
      headers: { "User-Agent": "OurLittleWorld/1.0 (poster image)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return await fallbackToWikipedia() ?? new Response(null, { status: response.status });

    const contentType = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
    if (!contentType.startsWith("image/") || contentType === "image/svg+xml") {
      return await fallbackToWikipedia() ?? NextResponse.json({ error: "The source did not return a supported image." }, { status: 415 });
    }

    const image = await response.arrayBuffer();
    if (image.byteLength > 5_000_000) return await fallbackToWikipedia() ?? NextResponse.json({ error: "Poster image is too large." }, { status: 413 });
    return new Response(image, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(image.byteLength),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.warn("[Daily recommendations] Poster image proxy failed.", error);
    return await fallbackToWikipedia() ?? NextResponse.json({ error: "Could not fetch the poster image." }, { status: 502 });
  }
}

type SongPick = {
  title: string;
  artist: string;
  album: string;
  cover: string;
  previewUrl: string;
  link: string;
  excerpt: string;
  lyricHighlight?: string;
  lyricsLink?: string;
};

type AppleTrack = {
  trackName: string;
  artistName: string;
  collectionName?: string;
  trackTimeMillis?: number;
  artworkUrl100?: string;
  trackViewUrl?: string;
};

type MoviePick = {
  title: string;
  year: number;
  poster: string;
  note: string;
  link: string;
  source: string;
  rating?: number;
  ratingCount?: number;
};

type SeriesPick = {
  title: string;
  years: string;
  poster: string;
  note: string;
  link: string;
  rating?: number;
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
  const summary = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const maxLength = 360;
  if (summary.length <= maxLength) return summary;
  return `${summary.slice(0, maxLength).replace(/\s+\S*$/, "").trimEnd()}…`;
}

async function fetchLyricsHighlight(track: AppleTrack) {
  try {
    const params = new URLSearchParams({
      track_name: track.trackName,
      artist_name: track.artistName,
    });
    if (typeof track.collectionName === "string") params.set("album_name", track.collectionName);
    if (typeof track.trackTimeMillis === "number") params.set("duration", String(Math.round(track.trackTimeMillis / 1000)));

    const response = await fetch(`https://lrclib.net/api/get?${params}`, {
      cache: "no-store",
      headers: { "User-Agent": "OurLittleWorld/1.0 (daily song highlight)" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const lyrics = typeof data?.plainLyrics === "string"
      ? data.plainLyrics
      : typeof data?.syncedLyrics === "string"
        ? data.syncedLyrics.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]\s*/g, "\n")
        : "";
    const firstLine = lyrics.split(/\r?\n/).map((line: string) => line.trim()).find(Boolean);
    if (!firstLine) return null;

    return {
      highlight: firstLine.split(/\s+/).slice(0, 10).join(" "),
      link: `https://lrclib.net/search/${encodeURIComponent(`${track.trackName} ${track.artistName}`)}`,
    };
  } catch {
    return null;
  }
}

async function fetchWikipediaPoster(title: string) {
  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      prop: "pageimages",
      piprop: "thumbnail",
      pithumbsize: "500",
      pilicense: "any",
      titles: title,
    });
    const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      cache: "no-store",
      headers: { "User-Agent": "OurLittleWorld/1.0 (movie poster lookup)" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return "";
    const data = await response.json();
    const pages = Object.values(data?.query?.pages ?? {}) as Array<{ thumbnail?: { source?: string } }>;
    return pages.find((page) => typeof page.thumbnail?.source === "string")?.thumbnail?.source ?? "";
  } catch {
    return "";
  }
}

function createPosterArtwork(title: string) {
  const safeTitle = title.replace(/[&<>"']/g, (character) => {
    if (character === "&") return "&amp;";
    if (character === "<") return "&lt;";
    if (character === ">") return "&gt;";
    if (character === '"') return "&quot;";
    return "&apos;";
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"><defs><linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#8da9bf"/><stop offset=".52" stop-color="#e7b59d"/><stop offset="1" stop-color="#684e62"/></linearGradient><radialGradient id="glow"><stop stop-color="#fff4d9" stop-opacity=".9"/><stop offset="1" stop-color="#fff4d9" stop-opacity="0"/></radialGradient></defs><rect width="400" height="600" fill="url(#paper)"/><circle cx="300" cy="180" r="190" fill="url(#glow)"/><path d="M0 430 Q115 330 235 440 T470 415 V620 H0Z" fill="#393849" fill-opacity=".42"/><text x="200" y="90" text-anchor="middle" fill="#fffaf4" font-family="Georgia,serif" font-size="15" letter-spacing="5">TONIGHT'S PICK</text><text x="200" y="485" text-anchor="middle" fill="#fffaf4" font-family="Georgia,serif" font-size="30" font-weight="bold">${safeTitle}</text><path d="M155 525h90" stroke="#fffaf4" stroke-opacity=".75"/><text x="200" y="555" text-anchor="middle" fill="#fffaf4" font-family="Arial,sans-serif" font-size="12" letter-spacing="3">A LITTLE LOVE STORY</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

async function fetchSong(day: number): Promise<SongPick | null> {
  try {
    const playlistPath = path.join(process.cwd(), "public", "playlist.txt");
    const playlistText = await readFile(playlistPath, "utf8");
    const tracks = [...new Map(playlistText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(" - ");
        if (separator < 1 || separator >= line.length - 3) return null;
        return { artistName: line.slice(0, separator).trim(), trackName: line.slice(separator + 3).trim() };
      })
      .filter((track): track is { artistName: string; trackName: string } => Boolean(track?.artistName && track.trackName))
      .map((track) => [`${track.artistName}\u0000${track.trackName}`.toLocaleLowerCase(), track] as const))].map(([, track]) => track);
    const track = chooseOfDay(tracks, day);
    if (!track) return null;
    const searchParams = new URLSearchParams({
      term: `${track.artistName} ${track.trackName}`,
      entity: "song",
      limit: "10",
      country: "ph",
      explicit: "No",
    });
    const catalogResponse = await fetch(`https://itunes.apple.com/search?${searchParams}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }).catch(() => null);
    const catalogData = catalogResponse?.ok ? await catalogResponse.json().catch(() => null) : null;
    const catalogTracks: AppleTrack[] = Array.isArray(catalogData?.results)
      ? catalogData.results.filter((item: any) => typeof item?.trackName === "string" && typeof item?.artistName === "string")
      : [];
    const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const catalogTrack = catalogTracks.find((item) =>
      normalize(item.trackName) === normalize(track.trackName) && normalize(item.artistName) === normalize(track.artistName),
    ) ?? catalogTracks[0];
    const lyricTrack: AppleTrack = catalogTrack ?? { trackName: track.trackName, artistName: track.artistName };
    const lyrics = await fetchLyricsHighlight(lyricTrack);
    const query = new URLSearchParams({ q: `${track.trackName} ${track.artistName}` });
    return {
      title: track.trackName,
      artist: track.artistName,
      album: catalogTrack?.collectionName ?? "",
      cover: catalogTrack?.artworkUrl100?.replace("100x100", "600x600") ?? "",
      previewUrl: "",
      link: `https://music.youtube.com/search?${query}`,
      excerpt: "A daily pick from your playlist.",
      lyricHighlight: lyrics?.highlight,
      lyricsLink: lyrics?.link ?? `https://lrclib.net/search/${encodeURIComponent(`${track.trackName} ${track.artistName}`)}`,
    };
  } catch {
    return null;
  }
}

async function fetchMovie(day: number): Promise<MoviePick | null> {
  const searches = [
    { country: "ph", term: "action movie" },
    { country: "ph", term: "drama movie" },
    { country: "ph", term: "science fiction movie" },
    { country: "ph", term: "animation movie" },
    { country: "ph", term: "thriller movie" },
  ];

  const searchResults = await Promise.all(searches.map(async (search) => {
      try {
        const params = new URLSearchParams({
          term: search.term,
          media: "movie",
          entity: "movie",
          limit: "50",
          country: search.country,
          explicit: "No",
        });
        const response = await fetch(`https://itunes.apple.com/search?${params}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) {
          console.warn(`[Daily recommendations] Apple movie search (${search.country}/${search.term}) returned ${response.status}.`);
          return [];
        }
        const data = await response.json();
        return Array.isArray(data?.results)
          ? data.results.filter((movie: any) =>
              typeof movie?.trackName === "string" &&
              typeof movie?.trackViewUrl === "string" &&
              typeof movie?.averageUserRating === "number" && movie.averageUserRating >= 4.2 &&
              typeof movie?.userRatingCount === "number" && movie.userRatingCount >= 500,
            )
          : [];
      } catch (error) {
        console.warn(`[Daily recommendations] Apple movie search (${search.country}/${search.term}) failed.`, error);
        return [];
      }
    }));

  const movies = [...new Map(searchResults.flat().map((movie: any) => [movie.trackViewUrl, movie])).values()];
  const movie = chooseOfDay(movies, day);
  if (movie) {
    const releaseYear = typeof movie.releaseDate === "string" ? Number(movie.releaseDate.slice(0, 4)) : 0;
    return {
      title: movie.trackName,
      year: Number.isInteger(releaseYear) ? releaseYear : 0,
      poster: typeof movie.artworkUrl100 === "string"
        ? movie.artworkUrl100.replace("100x100", "342x342")
        : await fetchWikipediaPoster(movie.trackName) || createPosterArtwork(movie.trackName),
      note: cleanSummary(movie.longDescription || movie.shortDescription) || `A movie pick from the Apple catalog${movie.primaryGenreName ? ` in ${movie.primaryGenreName.toLowerCase()}` : ""}.`,
      link: movie.trackViewUrl,
      source: "Apple catalog",
      rating: movie.averageUserRating,
      ratingCount: movie.userRatingCount,
    };
  }

  const offlineMovies: MoviePick[] = [
    { title: "The Shawshank Redemption", year: 1994, poster: "", note: "A moving story of friendship and hope inside a prison.", link: "https://www.imdb.com/find/?q=The%20Shawshank%20Redemption", source: "Curated picks" },
    { title: "The Dark Knight", year: 2008, poster: "", note: "A gripping crime thriller that raises the stakes for Gotham and Batman.", link: "https://www.imdb.com/find/?q=The%20Dark%20Knight", source: "Curated picks" },
    { title: "The Lord of the Rings: The Fellowship of the Ring", year: 2001, poster: "", note: "An acclaimed fantasy adventure begins an epic journey across Middle-earth.", link: "https://www.imdb.com/find/?q=The%20Lord%20of%20the%20Rings%20The%20Fellowship%20of%20the%20Ring", source: "Curated picks" },
    { title: "Inception", year: 2010, poster: "", note: "A clever, high-stakes science fiction heist inside a world of dreams.", link: "https://www.imdb.com/find/?q=Inception", source: "Curated picks" },
    { title: "Interstellar", year: 2014, poster: "", note: "A sweeping space adventure about exploration, family, and time.", link: "https://www.imdb.com/find/?q=Interstellar", source: "Curated picks" },
    { title: "Spirited Away", year: 2001, poster: "", note: "A richly imagined animated fantasy from Studio Ghibli.", link: "https://www.imdb.com/find/?q=Spirited%20Away", source: "Curated picks" },
    { title: "Coco", year: 2017, poster: "", note: "A colorful Pixar adventure about music, family, and remembrance.", link: "https://www.imdb.com/find/?q=Coco%202017", source: "Curated picks" },
    { title: "Parasite", year: 2019, poster: "", note: "A tense, darkly funny thriller about two families and a widening divide.", link: "https://www.imdb.com/find/?q=Parasite%202019", source: "Curated picks" },
    { title: "The Grand Budapest Hotel", year: 2014, poster: "", note: "A stylish comedy adventure full of eccentric characters and capers.", link: "https://www.imdb.com/find/?q=The%20Grand%20Budapest%20Hotel", source: "Curated picks" },
    { title: "Spider-Man: Into the Spider-Verse", year: 2018, poster: "", note: "An inventive, acclaimed animated superhero adventure.", link: "https://www.imdb.com/find/?q=Spider-Man%20Into%20the%20Spider-Verse", source: "Curated picks" },
  ];
  const offlineMovie = chooseOfDay(offlineMovies, day);
  if (!offlineMovie) return null;
  return { ...offlineMovie, poster: await fetchWikipediaPoster(offlineMovie.title) || createPosterArtwork(offlineMovie.title) };

}

const notableSeries: SeriesPick[] = [
  { title: "Breaking Bad", years: "2008-2013", poster: "", note: "A chemistry teacher's transformation into a drug kingpin becomes a gripping crime drama.", link: "https://www.tvmaze.com/search?q=Breaking%20Bad" },
  { title: "Sherlock", years: "2010-2017", poster: "", note: "A fast, clever modern take on the famous detective stories.", link: "https://www.tvmaze.com/search?q=Sherlock" },
  { title: "The Office", years: "2005-2013", poster: "", note: "An acclaimed workplace comedy with a warm ensemble cast.", link: "https://www.tvmaze.com/search?q=The%20Office" },
  { title: "Chernobyl", years: "2019", poster: "", note: "A widely praised historical drama about the 1986 nuclear disaster.", link: "https://www.tvmaze.com/search?q=Chernobyl" },
  { title: "Stranger Things", years: "2016-2025", poster: "", note: "A hugely popular science fiction mystery with a close-knit group of friends.", link: "https://www.tvmaze.com/search?q=Stranger%20Things" },
  { title: "Game of Thrones", years: "2011-2019", poster: "", note: "A globally popular fantasy drama of rival families and shifting power.", link: "https://www.tvmaze.com/search?q=Game%20of%20Thrones" },
  { title: "The Queen's Gambit", years: "2020", poster: "", note: "A stylish, acclaimed drama about a gifted chess player finding her way.", link: "https://www.tvmaze.com/search?q=The%20Queen%27s%20Gambit" },
  { title: "Friends", years: "1994-2004", poster: "", note: "A landmark, widely loved sitcom about six friends in New York.", link: "https://www.tvmaze.com/search?q=Friends" },
];

async function fetchCuratedSeries(day: number): Promise<SeriesPick | null> {
  const pick = chooseOfDay(notableSeries, day);
  return pick ? { ...pick, poster: await fetchWikipediaPoster(pick.title) } : null;
}

async function fetchSeries(day: number): Promise<SeriesPick | null> {
  try {
    const response = await fetch(`https://api.tvmaze.com/shows?page=${day % 100}`, {
      cache: "no-store",
      headers: { "User-Agent": "OurLittleWorld/1.0 (daily recommendations)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return fetchCuratedSeries(day);
    const data = await response.json();
    const shows = Array.isArray(data)
      ? data
          .filter((show: any) => typeof show?.name === "string" && typeof show?.rating?.average === "number" && show.rating.average >= 7.5 && typeof show?.weight === "number" && show.weight >= 40)
      : [];
    const show = chooseOfDay(shows, day);
    if (!show) return fetchCuratedSeries(day);
    const startYear = typeof show.premiered === "string" ? show.premiered.slice(0, 4) : "";
    const endYear = typeof show.ended === "string" ? show.ended.slice(0, 4) : "";
    const years = startYear ? `${startYear}${endYear && endYear !== startYear ? `-${endYear}` : endYear ? "" : "-present"}` : "";
    return {
      title: show.name,
      years,
      poster: typeof show.image?.medium === "string" ? show.image.medium : "",
      note: cleanSummary(show.summary) || (Array.isArray(show.genres) && show.genres.length ? `A ${show.genres.join(", ").toLowerCase()} series.` : "A series pick from the TVmaze catalog."),
      link: typeof show.url === "string" ? show.url : "https://www.tvmaze.com/",
      rating: show.rating.average,
    };
  } catch {
    return fetchCuratedSeries(day);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const posterUrl = url.searchParams.get("poster");
  if (posterUrl) return proxyPoster(posterUrl, url.searchParams.get("title") ?? "");

  const requestedDate = url.searchParams.get("date") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const day = dayNumber(date);
  const [song, movie, series] = await Promise.all([fetchSong(day), fetchMovie(day), fetchSeries(day + 2)]);
  const warnings: string[] = [];
  if (!song) warnings.push("Song catalog could not be reached right now.");
  if (!series) warnings.push("TVmaze could not provide a series pick right now.");

  if (!song && !movie && !series) {
    return NextResponse.json(
      { error: "The public catalogs could not be reached.", warnings },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { song, movie, series, warnings, source: "playlist-and-public-catalogs", date },
    { headers: { "Cache-Control": "no-store" } },
  );
}
