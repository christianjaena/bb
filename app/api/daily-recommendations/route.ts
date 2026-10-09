import { NextResponse } from "next/server";

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
  trackViewUrl: string;
};

type MoviePick = {
  title: string;
  year: number;
  poster: string;
  note: string;
  link: string;
  source: string;
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
      highlight: firstLine.slice(0, 90).trimEnd(),
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
    const params = new URLSearchParams({ term: "romantic love", entity: "song", limit: "50", country: "ph", explicit: "No" });
    const response = await fetch(`https://itunes.apple.com/search?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    const results = (data as { results?: unknown } | null)?.results;
    const tracks: AppleTrack[] = Array.isArray(results)
      ? (results as unknown[]).filter((track): track is AppleTrack => Boolean(
          track && typeof track === "object" &&
          typeof (track as AppleTrack).trackName === "string" &&
          typeof (track as AppleTrack).artistName === "string" &&
          typeof (track as AppleTrack).trackViewUrl === "string",
        ))
      : [];
    const track = chooseOfDay(tracks, day);
    if (!track) return null;
    const album = typeof track.collectionName === "string" ? track.collectionName : "";
    const lyrics = await fetchLyricsHighlight(track);
    return {
      title: track.trackName,
      artist: track.artistName,
      album,
      cover: typeof track.artworkUrl100 === "string" ? track.artworkUrl100.replace("100x100", "342x342") : "",
      previewUrl: "",
      link: track.trackViewUrl,
      excerpt: album ? `From the album ${album}.` : `A daily pick from the Apple music catalog.`,
      lyricHighlight: lyrics?.highlight,
      lyricsLink: lyrics?.link,
    };
  } catch {
    return null;
  }
}

async function fetchMovie(day: number): Promise<MoviePick | null> {
  const searches = [
    { country: "ph", term: "romantic comedy" },
    { country: "ph", term: "romance" },
    { country: "us", term: "romantic comedy" },
    { country: "us", term: "romance" },
  ];

  const [searchResults, sampleMovies] = await Promise.all([
    Promise.all(searches.map(async (search) => {
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
          ? data.results.filter((movie: any) => typeof movie?.trackName === "string" && typeof movie?.trackViewUrl === "string")
          : [];
      } catch (error) {
        console.warn(`[Daily recommendations] Apple movie search (${search.country}/${search.term}) failed.`, error);
        return [];
      }
    })),
    fetch("https://api.sampleapis.com/movies/comedy", {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    })
      .then(async (response) => response.ok ? await response.json() : [])
      .catch((error) => {
        console.warn("[Daily recommendations] SampleAPIs movie catalog failed.", error);
        return [];
      }),
  ]);

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
    };
  }

  const sampleList = Array.isArray(sampleMovies)
    ? sampleMovies.filter((item: any) => item && typeof item.title === "string")
    : [];
  const sampleMovie = chooseOfDay(sampleList, day);
  if (sampleMovie) {
    const yearValue = sampleMovie.year ?? sampleMovie.releaseYear ?? sampleMovie.releaseDate;
    const parsedYear = typeof yearValue === "string" ? Number(yearValue.slice(0, 4)) : Number(yearValue);
    const imdbId = typeof sampleMovie.imdbId === "string" ? sampleMovie.imdbId : "";
    const poster = [sampleMovie.posterURL, sampleMovie.posterUrl, sampleMovie.poster_url, sampleMovie.poster, sampleMovie.image]
      .find((value: unknown) => typeof value === "string" && value.startsWith("http")) as string | undefined;
    return {
      title: sampleMovie.title,
      year: Number.isInteger(parsedYear) ? parsedYear : 0,
      poster: poster?.replace(/^http:/, "https:") || await fetchWikipediaPoster(sampleMovie.title) || createPosterArtwork(sampleMovie.title),
      note: cleanSummary(sampleMovie.synopsis || sampleMovie.description || sampleMovie.plot) || "A daily comedy pick from the public movie catalog.",
      link: imdbId ? `https://www.imdb.com/title/${imdbId}/` : `https://www.imdb.com/find/?q=${encodeURIComponent(sampleMovie.title)}`,
      source: "SampleAPIs",
    };
  }

  const offlineMovies: MoviePick[] = [
    { title: "Set It Up", year: 2018, poster: "", note: "A bright, easy watch with clever schemes and lovely chemistry.", link: "https://itunes.apple.com/search?term=Set%20It%20Up&entity=movie&country=us", source: "Our daily picks" },
    { title: "10 Things I Hate About You", year: 1999, poster: "", note: "A funny, warm high-school romance with plenty of heart.", link: "https://itunes.apple.com/search?term=10%20Things%20I%20Hate%20About%20You&entity=movie&country=us", source: "Our daily picks" },
    { title: "The Big Sick", year: 2017, poster: "", note: "A heartfelt romantic comedy about family, timing, and showing up.", link: "https://itunes.apple.com/search?term=The%20Big%20Sick&entity=movie&country=us", source: "Our daily picks" },
    { title: "While You Were Sleeping", year: 1995, poster: "", note: "A cozy romantic comedy built around an unexpected connection.", link: "https://itunes.apple.com/search?term=While%20You%20Were%20Sleeping&entity=movie&country=us", source: "Our daily picks" },
    { title: "Crazy Rich Asians", year: 2018, poster: "", note: "A colorful romance about love, family, and finding your place.", link: "https://itunes.apple.com/search?term=Crazy%20Rich%20Asians&entity=movie&country=us", source: "Our daily picks" },
    { title: "The Holiday", year: 2006, poster: "", note: "A comforting story about fresh starts and unexpected love.", link: "https://itunes.apple.com/search?term=The%20Holiday&entity=movie&country=us", source: "Our daily picks" },
  ];
  const offlineMovie = chooseOfDay(offlineMovies, day);
  if (!offlineMovie) return null;
  return { ...offlineMovie, poster: await fetchWikipediaPoster(offlineMovie.title) || createPosterArtwork(offlineMovie.title) };

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
    const years = startYear ? `${startYear}${endYear && endYear !== startYear ? `-${endYear}` : endYear ? "" : "-present"}` : "";
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
  if (movie?.source === "Our daily picks") warnings.push("Movie catalogs were unavailable; showing a rotating pick instead.");
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
