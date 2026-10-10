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

  const allowedHost = posterHosts.has(imageUrl.hostname) || /^is\d+-ssl\.mzstatic\.com$/.test(imageUrl.hostname) || imageUrl.hostname.endsWith(".nflxso.net");
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

type StreamingService = "Netflix" | "Prime Video" | "Disney+" | "Hulu" | "Apple TV+";

type MoviePick = {
  title: string;
  year: number;
  poster: string;
  note: string;
  link: string;
  provider: StreamingService;
  rating?: number;
  ratingCount?: number;
};

type SeriesPick = {
  title: string;
  years: string;
  poster: string;
  note: string;
  link: string;
  language: string;
  provider: StreamingService;
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

function streamingSearch(service: StreamingService, title: string) {
  const query = encodeURIComponent(title);
  const searchUrls: Record<StreamingService, string> = {
    "Netflix": `https://www.netflix.com/search?q=${query}`,
    "Prime Video": `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${query}`,
    "Disney+": `https://www.disneyplus.com/search?q=${query}`,
    "Hulu": `https://www.hulu.com/search?q=${query}`,
    "Apple TV+": `https://tv.apple.com/search?term=${query}`,
  };
  return searchUrls[service];
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
    const normalize = (value: string) => value.toLocaleLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (typeof data?.trackName === "string" && normalize(data.trackName) !== normalize(track.trackName)) return null;
    if (typeof data?.artistName === "string" && normalize(data.artistName) !== normalize(track.artistName)) return null;
    const lyrics = typeof data?.plainLyrics === "string"
      ? data.plainLyrics
      : typeof data?.syncedLyrics === "string"
        ? data.syncedLyrics.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]\s*/g, "\n")
        : "";
    const candidates = lyrics.split(/\r?\n/)
      .map((line: string) => line.replace(/^\s*\[[^\]]+\]\s*/, "").trim())
      .filter((line: string) => line && !/^\(?\s*(?:verse|chorus|bridge|intro|outro|instrumental|refrain)(?:\s+\d+)?\s*\)?$/i.test(line))
      .filter((line: string) => /[\p{L}]/u.test(line) && line.split(/\s+/).length >= 4);
    if (!candidates.length) return null;
    // Lyric APIs sometimes split a sentence across lines. Skip dangling endings
    // instead of presenting a fragment as if it were a complete thought.
    const danglingEndings = new Set(["na", "ng", "mong", "kang", "nating", "ating", "iyong", "aking", "aking", "ang", "at", "sa", "si", "ni", "ay", "kung", "dahil", "para", "pero", "o", "the", "a", "an", "to", "of", "with", "and", "but", "if", "when", "that", "my", "your", "our"]);
    const completeLines = candidates.filter((line: string) => {
      const end = line.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+$/gu, "").split(/\s+/).at(-1) ?? "";
      return !danglingEndings.has(end);
    });
    if (!completeLines.length) return null;
    const highlight = completeLines.find((line: string) => /[.!?;,:]$/.test(line) && line.split(/\s+/).length <= 12)
      ?? completeLines.find((line: string) => line.split(/\s+/).length <= 12)
      ?? completeLines.find((line: string) => /[.!?;,:]$/.test(line));
    if (!highlight) return null;
    const words = highlight.split(/\s+/);
    const excerpt = words.length <= 12 ? highlight : `${words.slice(0, 11).join(" ")}…`;

    return {
      highlight: excerpt,
      link: `https://lrclib.net/search/${encodeURIComponent(`${track.trackName} ${track.artistName}`)}`,
    };
  } catch {
    return null;
  }
}

async function fetchWikipediaPoster(title: string, year?: number) {
  const pageTitles = year ? [`${title} (${year} film)`, title] : [title];
  for (const pageTitle of pageTitles) {
    try {
      const params = new URLSearchParams({
        action: "query",
        format: "json",
        prop: "pageimages",
        piprop: "thumbnail",
        pithumbsize: "500",
        pilicense: "any",
        titles: pageTitle,
      });
      const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
        cache: "no-store",
        headers: { "User-Agent": "OurLittleWorld/1.0 (movie poster lookup)" },
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) continue;
      const data = await response.json();
      const pages = Object.values(data?.query?.pages ?? {}) as Array<{ thumbnail?: { source?: string } }>;
      const poster = pages.find((page) => typeof page.thumbnail?.source === "string")?.thumbnail?.source;
      if (poster) return poster;
    } catch {
      // Try the simpler page title before falling back to generated artwork.
    }
  }
  return "";
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

async function fetchAppleMoviePoster(title: string) {
  try {
    const params = new URLSearchParams({ term: title, media: "movie", entity: "movie", limit: "15", country: "ph", explicit: "No" });
    const response = await fetch(`https://itunes.apple.com/search?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) return "";
    const data = await response.json();
    const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const match = Array.isArray(data?.results)
      ? data.results.find((item: any) => typeof item?.trackName === "string" && normalize(item.trackName) === normalize(title))
      : null;
    return typeof match?.artworkUrl100 === "string" ? match.artworkUrl100.replace(/\d+x\d+bb\./, "600x900bb.") : "";
  } catch {
    return "";
  }
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
  // Keep a reviewed catalog because storefront search APIs do not expose reliable
  // original-language and streaming-provider metadata across all five services.
  const movies: Array<MoviePick & { language: "Filipino" | "English" | "Japanese" | "Korean" }> = [
    { title: "Doll House", year: 2022, language: "Filipino", provider: "Netflix", poster: "https://occ-0-3012-33.1.nflxso.net/dnm/api/v6/S4oi7EPZbv2UEPaukW54OORa0S8/AAAABS1xypmieL5Wm53VhMg90xtc3hxC8gWO2165UzGABARS61psTykbweStjbDZu3Xw4U3jz98SvIbii97STNCyYl8--LmuQ64Y.png?r=5ff", note: "A Filipino rock singer tries to rebuild the bond he never had with his daughter.", link: streamingSearch("Netflix", "Doll House") },
    { title: "Keys to the Heart", year: 2023, language: "Filipino", provider: "Netflix", poster: "", note: "An estranged boxer reconnects with his family and a musical younger brother.", link: streamingSearch("Netflix", "Keys to the Heart") },
    { title: "The Adam Project", year: 2022, language: "English", provider: "Netflix", poster: "", note: "A time-traveling pilot teams up with his younger self on a family-sized adventure.", link: streamingSearch("Netflix", "The Adam Project") },
    { title: "Enola Holmes", year: 2020, language: "English", provider: "Netflix", poster: "", note: "Sherlock Holmes's sharp-witted younger sister sets out to solve a mystery of her own.", link: streamingSearch("Netflix", "Enola Holmes") },
    { title: "Zom 100: Bucket List of the Dead", year: 2023, language: "Japanese", provider: "Netflix", poster: "", note: "A burned-out office worker finds an unexpected bucket-list adventure during a zombie outbreak.", link: streamingSearch("Netflix", "Zom 100: Bucket List of the Dead") },
    { title: "City Hunter", year: 2024, language: "Japanese", provider: "Netflix", poster: "", note: "A skilled but carefree private detective takes on a dangerous case in Tokyo.", link: streamingSearch("Netflix", "City Hunter") },
    { title: "Ballerina", year: 2023, language: "Korean", provider: "Netflix", poster: "", note: "A former bodyguard sets out to fulfill her late friend's final wish.", link: streamingSearch("Netflix", "Ballerina") },
    { title: "20th Century Girl", year: 2022, language: "Korean", provider: "Netflix", poster: "", note: "A teenager keeps a close eye on her friend's crush and finds a love story of her own.", link: streamingSearch("Netflix", "20th Century Girl") },
    { title: "The Idea of You", year: 2024, language: "English", provider: "Prime Video", poster: "", note: "A single mother finds an unexpected connection with a young musician on tour.", link: streamingSearch("Prime Video", "The Idea of You") },
    { title: "The Tomorrow War", year: 2021, language: "English", provider: "Prime Video", poster: "", note: "A teacher is drafted into a future war against an alien invasion.", link: streamingSearch("Prime Video", "The Tomorrow War") },
    { title: "Soul", year: 2020, language: "English", provider: "Disney+", poster: "", note: "A music teacher takes an unexpected journey that changes how he sees life.", link: streamingSearch("Disney+", "Soul") },
    { title: "Raya and the Last Dragon", year: 2021, language: "English", provider: "Disney+", poster: "", note: "A lone warrior searches for the last dragon to reunite a divided land.", link: streamingSearch("Disney+", "Raya and the Last Dragon") },
    { title: "Prey", year: 2022, language: "English", provider: "Hulu", poster: "", note: "A Comanche warrior faces a highly advanced alien hunter on the Great Plains.", link: streamingSearch("Hulu", "Prey") },
    { title: "Palm Springs", year: 2020, language: "English", provider: "Hulu", poster: "", note: "Two wedding guests get stuck reliving the same day and grow closer along the way.", link: streamingSearch("Hulu", "Palm Springs") },
    { title: "CODA", year: 2021, language: "English", provider: "Apple TV+", poster: "", note: "The only hearing member of her family discovers her own gift for singing.", link: streamingSearch("Apple TV+", "CODA") },
    { title: "Tetris", year: 2023, language: "English", provider: "Apple TV+", poster: "", note: "A game designer risks everything to bring Tetris to the world.", link: streamingSearch("Apple TV+", "Tetris") },
  ];
  const movie = chooseOfDay(movies.filter((item) => ["Filipino", "English", "Japanese", "Korean"].includes(item.language)), day);
  if (!movie) return null;
  const poster = movie.poster || await fetchAppleMoviePoster(movie.title) || await fetchWikipediaPoster(movie.title, movie.year) || createPosterArtwork(movie.title);
  return { ...movie, poster };

}

const notableSeries: SeriesPick[] = [
  { title: "Replacing Chef Chico", years: "2023", poster: "", note: "A sous-chef fights to save her Filipino fine-dining restaurant after its head chef falls into a coma.", link: streamingSearch("Netflix", "Replacing Chef Chico"), language: "Filipino", provider: "Netflix" },
  { title: "Trese", years: "2021", poster: "", note: "A detective protects Manila from supernatural forces drawn from Filipino folklore.", link: streamingSearch("Netflix", "Trese"), language: "Filipino", provider: "Netflix" },
  { title: "Wednesday", years: "2022-present", poster: "", note: "Wednesday Addams investigates a mystery at Nevermore Academy.", link: streamingSearch("Netflix", "Wednesday"), language: "English", provider: "Netflix" },
  { title: "The Queen's Gambit", years: "2020", poster: "", note: "A gifted chess player pursues mastery while finding her place in the world.", link: streamingSearch("Netflix", "The Queen's Gambit"), language: "English", provider: "Netflix" },
  { title: "The Summer I Turned Pretty", years: "2022-present", poster: "", note: "A young woman navigates first love, heartbreak, and summers that change everything.", link: streamingSearch("Prime Video", "The Summer I Turned Pretty"), language: "English", provider: "Prime Video" },
  { title: "Fallout", years: "2024-present", poster: "", note: "Centuries after the apocalypse, a vault dweller ventures into a strange and dangerous world.", link: streamingSearch("Prime Video", "Fallout"), language: "English", provider: "Prime Video" },
  { title: "Moving", years: "2023", poster: "", note: "Young people with hidden superpowers and their parents face a dangerous conspiracy.", link: streamingSearch("Disney+", "Moving"), language: "Korean", provider: "Disney+" },
  { title: "Gannibal", years: "2022-present", poster: "", note: "A village police officer uncovers unsettling secrets in a remote Japanese community.", link: streamingSearch("Disney+", "Gannibal"), language: "Japanese", provider: "Disney+" },
  { title: "The Bear", years: "2022-present", poster: "", note: "A fine-dining chef returns home to run his family's neighborhood sandwich shop.", link: streamingSearch("Hulu", "The Bear"), language: "English", provider: "Hulu" },
  { title: "Only Murders in the Building", years: "2021-present", poster: "", note: "Three true-crime fans start a podcast while investigating a murder in their building.", link: streamingSearch("Hulu", "Only Murders in the Building"), language: "English", provider: "Hulu" },
  { title: "Ted Lasso", years: "2020-present", poster: "", note: "An optimistic American football coach takes charge of an English soccer team.", link: streamingSearch("Apple TV+", "Ted Lasso"), language: "English", provider: "Apple TV+" },
  { title: "Severance", years: "2022-present", poster: "", note: "Office workers undergo a procedure that separates their work and personal memories.", link: streamingSearch("Apple TV+", "Severance"), language: "English", provider: "Apple TV+" },
];

async function fetchCuratedSeries(day: number): Promise<SeriesPick | null> {
  const pick = chooseOfDay(notableSeries, day);
  return pick ? { ...pick, poster: await fetchWikipediaPoster(pick.title) } : null;
}

async function fetchSeries(day: number): Promise<SeriesPick | null> {
  return fetchCuratedSeries(day);
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

  if (!song && !movie && !series) {
    return NextResponse.json(
      { error: "The public catalogs could not be reached.", warnings },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { song, movie, series, warnings, source: "playlist-and-curated-streaming-catalog", date },
    { headers: { "Cache-Control": "no-store" } },
  );
}
