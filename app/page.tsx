
"use client";

import { useEffect, useState } from "react";
import { RELATIONSHIP_CONFIG } from "@/lib/data";
import { createShareableUrl } from "@/lib/share";

const navItems = [
  ["us", "❤️", "Us"],
  ["letters", "💌", "Letters"],
  ["play", "🎲", "Play"],
] as const;

type Tab = (typeof navItems)[number][0];

type Activity = {
  id: string;
  kind: string;
  emoji: string;
  message: string;
  url: string;
};

type DailySong = {
  title: string;
  artist: string;
  album: string;
  cover: string;
  link: string;
  excerpt: string;
  previewUrl?: string;
  lyricHighlight?: string;
  lyricsLink?: string;
};

type DailyRecommendations = {
  song: DailySong | null;
  movie: { title: string; year: number; poster: string; note: string; link: string; source?: string } | null;
  series: { title: string; years: string; poster: string; note: string; link: string } | null;
  warnings?: string[];
};

function hasDailyPicks(value: DailyRecommendations | null | undefined): value is DailyRecommendations {
  return Boolean(value && (value.song?.title || value.movie?.title || value.series?.title));
}

const OFFLINE_RECOMMENDATIONS: DailyRecommendations = {
  song: {
    title: "Can't Help Falling in Love",
    artist: "Elvis Presley",
    album: "",
    cover: "",
    link: "https://music.apple.com/us/search?term=Can%27t%20Help%20Falling%20in%20Love%20Elvis%20Presley",
    excerpt: "A soft classic for your next kitchen slow dance.",
  },
  movie: { title: "Set It Up", year: 2018, poster: "", note: "A bright, easy watch with clever schemes and lovely chemistry.", link: "https://itunes.apple.com/search?term=Set%20It%20Up&entity=movie&country=ph" },
  series: { title: "Dash & Lily", years: "2020", poster: "", note: "A playful romance told through notes, dares, and holiday magic.", link: "https://www.tvmaze.com/search?q=Dash+%26+Lily" },
};

type GamePrompts = {
  wouldYouRather: string;
  whoMoreLikely: string;
  truth: string;
  dare: string;
};

function isGamePrompts(value: unknown): value is GamePrompts {
  if (!value || typeof value !== "object") return false;
  const prompts = value as Partial<GamePrompts>;
  return [prompts.wouldYouRather, prompts.whoMoreLikely, prompts.truth, prompts.dare]
    .every((question) => typeof question === "string");
}

function LoadingMessage({ children }: { children: string }) {
  return (
    <div className="fetching-state" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

function posterFallback(title: string) {
  const safeTitle = title.replace(/[&<>"']/g, (character) => {
    if (character === "&") return "&amp;";
    if (character === "<") return "&lt;";
    if (character === ">") return "&gt;";
    if (character === '"') return "&quot;";
    return "&apos;";
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#7894b2"/><stop offset=".55" stop-color="#dca68f"/><stop offset="1" stop-color="#59465e"/></linearGradient><radialGradient id="light"><stop stop-color="#fff1d4" stop-opacity=".85"/><stop offset="1" stop-color="#fff1d4" stop-opacity="0"/></radialGradient></defs><rect width="400" height="600" fill="url(#bg)"/><circle cx="280" cy="170" r="190" fill="url(#light)"/><path d="M0 410 Q120 330 220 425 T440 390 V620 H0Z" fill="#292c40" fill-opacity=".5"/><text x="200" y="90" text-anchor="middle" fill="#fffaf4" font-family="Georgia,serif" font-size="15" letter-spacing="5">TONIGHT'S PICK</text><foreignObject x="30" y="430" width="340" height="110"><div xmlns="http://www.w3.org/1999/xhtml" style="height:100%;display:flex;align-items:center;justify-content:center;text-align:center;color:#fffaf4;font-family:Georgia,serif;font-size:30px;font-weight:bold;line-height:1.15">${safeTitle}</div></foreignObject></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function posterSource(url: string, title: string) {
  if (url.startsWith("data:image/")) return url;
  return `/api/daily-recommendations?poster=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
}

function formatTime(zone: string, date: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(date);
}

function localHour(zone: string, date: Date) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", hourCycle: "h23" }).format(date));
}

function timeEmoji(hour: number) {
  if (hour < 5 || hour >= 22) return "🌙";
  if (hour < 7) return "🌅";
  if (hour < 12) return "☀️";
  if (hour < 17) return "🌤️";
  if (hour < 20) return "🌇";
  return "🌙";
}

function dayPart(hour: number) {
  return hour >= 6 && hour < 18 ? "Daytime" : "Night-time";
}

function weatherEmoji(code: number) {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67 || (code >= 80 && code <= 82)) return "🌧️";
  if (code <= 77 || code === 85 || code === 86) return "❄️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}

function weatherDescription(code: number) {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67 || (code >= 80 && code <= 82)) return "Rain";
  if (code <= 77 || code === 85 || code === 86) return "Snow";
  if (code >= 95) return "Thunderstorm";
  return "Conditions";
}

function distanceKm() {
  const manila = { lat: 14.5995, lon: 120.9842 };
  const auckland = { lat: -36.8509, lon: 174.7645 };
  const r = 6371;
  const dLat = ((auckland.lat - manila.lat) * Math.PI) / 180;
  const dLon = ((auckland.lon - manila.lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((manila.lat * Math.PI) / 180) *
      Math.cos((auckland.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return Math.round(r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function timezoneOffsetMinutes(timeZone: string, date: Date) {
  const offset = new Intl.DateTimeFormat("en", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value;
  const match = offset?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;

  const sign = match[1] === "+" ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

function relationshipDuration(startDate: string, now: Date) {
  const startedAt = new Date(`${startDate}T00:00:00+08:00`).getTime();
  const totalSeconds = Math.max(0, Math.floor((now.getTime() - startedAt) / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
}

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("us");
  const [dailyCaption, setDailyCaption] = useState("");
  const [dailyRecommendations, setDailyRecommendations] = useState<DailyRecommendations | null>(null);
  const [recommendationStatus, setRecommendationStatus] = useState("Creating today's recommendations…");
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [recommendationFallback, setRecommendationFallback] = useState(false);
  const [gamePrompts, setGamePrompts] = useState<GamePrompts | null>(null);
  const [gamePromptsDate, setGamePromptsDate] = useState("");
  const [gameLoading, setGameLoading] = useState(false);
  const [gameError, setGameError] = useState(false);
  const [weather, setWeather] = useState<{ manila: { temperature: number; code: number }; auckland: { temperature: number; code: number } } | null>(null);
  const [weatherUnavailable, setWeatherUnavailable] = useState(false);
  const [clockNow, setClockNow] = useState(() => new Date(0));
  const togetherFor = relationshipDuration(RELATIONSHIP_CONFIG.startDate, clockNow);
  const [title, setTitle] = useState("");
  const [sender, setSender] = useState("bb");
  const [body, setBody] = useState("");
  const [letterUrl, setLetterUrl] = useState("");
  const [letterStatus, setLetterStatus] = useState("");
  const [savingLetter, setSavingLetter] = useState(false);
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({});
  const kmApart = distanceKm();
  const hoursAway = Math.abs(timezoneOffsetMinutes("Asia/Manila", clockNow) - timezoneOffsetMinutes("Pacific/Auckland", clockNow)) / 60;

  useEffect(() => {
    setClockNow(new Date());
    const clockTimer = window.setInterval(() => setClockNow(new Date()), 1_000);
    let active = true;
    let loadedRecommendationDate = todayKey();

    const loadRecommendations = async (date: string) => {
      const cacheKey = `daily-public-recommendations-v8-${date}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as DailyRecommendations;
          if (hasDailyPicks(parsed)) {
            if (active) {
              setDailyRecommendations(parsed);
              setRecommendationStatus(parsed.warnings?.join(" ") ?? "");
              setRecommendationsLoading(false);
              setRecommendationFallback(Boolean(parsed.warnings?.length));
            }
            return;
          }
        }
      } catch {
        // Fetch a fresh set when the daily cache cannot be read.
      }

      if (active) {
        setDailyRecommendations(null);
        setRecommendationStatus("Creating today's recommendations…");
        setRecommendationsLoading(true);
        setRecommendationFallback(false);
      }

      try {
        const response = await fetch(`/api/daily-recommendations?date=${encodeURIComponent(date)}`, { cache: "no-store" });
        if (!response.ok) {
          const failure = await response.json().catch(() => null);
          throw new Error(failure?.detail || failure?.reason || "Daily recommendations could not be generated");
        }
        const recommendations = await response.json() as DailyRecommendations;
        if (!hasDailyPicks(recommendations)) {
          throw new Error("Daily recommendations were incomplete");
        }
        if (!active) return;
        setDailyRecommendations(recommendations);
        setRecommendationStatus(recommendations.warnings?.join(" ") ?? "");
        setRecommendationsLoading(false);
        setRecommendationFallback(Boolean(recommendations.warnings?.length));
        try {
          localStorage.setItem(cacheKey, JSON.stringify(recommendations));
        } catch {
          // Keep the generated recommendations in memory for this visit.
        }
      } catch (error) {
        if (!active) return;
        const failureReason = error instanceof Error ? error.message : "network_error";
        let previousPicks: DailyRecommendations | null = null;
        let previousDate = "";
        try {
          for (const key of Object.keys(localStorage)) {
            const cachedDate = key.startsWith("daily-public-recommendations-v8-") ? key.slice("daily-public-recommendations-v8-".length) : "";
            if (cachedDate && cachedDate < date && cachedDate > previousDate) {
              const cached = JSON.parse(localStorage.getItem(key) || "null") as DailyRecommendations | null;
              if (hasDailyPicks(cached)) {
                previousPicks = cached;
                previousDate = cachedDate;
              }
            }
          }
        } catch {
          // Continue with the inline error if the browser cache is unavailable.
        }
        if (previousPicks) {
          setDailyRecommendations(previousPicks);
          setRecommendationStatus(`Could not fetch today's picks (${failureReason}); showing the most recently saved set.`);
          setRecommendationFallback(true);
        } else {
          setDailyRecommendations(OFFLINE_RECOMMENDATIONS);
          setRecommendationStatus(`Today's picks could not be fetched (${failureReason}); showing a small offline set.`);
          setRecommendationFallback(true);
        }
        setRecommendationsLoading(false);
      }
    };

    void loadRecommendations(loadedRecommendationDate);
    const recommendationDayTimer = window.setInterval(() => {
      const currentDate = todayKey();
      if (currentDate !== loadedRecommendationDate) {
        loadedRecommendationDate = currentDate;
        void loadRecommendations(currentDate);
      }
    }, 60_000);

    void (async () => {
      const cacheKey = `daily-caption-${todayKey()}`;
      try {
        const cachedCaption = localStorage.getItem(cacheKey);
        if (cachedCaption) {
          setDailyCaption(cachedCaption);
          return;
        }
      } catch {
        // Continue to the caption endpoint when local storage is unavailable.
      }

      try {
        const response = await fetch("/api/daily-caption", { cache: "no-store" });
        if (!response.ok) throw new Error("Caption request failed");
        const data = await response.json();
        const caption = typeof data.caption === "string" ? data.caption : "Saving you a seat for our next call.";
        setDailyCaption(caption);
        try {
          localStorage.setItem(cacheKey, caption);
        } catch {
          // Keep the caption in memory for this visit.
        }
      } catch {
        setDailyCaption("Saving you a seat for our next call.");
      }
    })();

    fetch("/api/weather")
      .then((response) => {
        if (!response.ok) throw new Error("Weather request failed");
        return response.json();
      })
      .then((data) => setWeather(data))
      .catch(() => setWeatherUnavailable(true));

    return () => {
      active = false;
      window.clearInterval(clockTimer);
      window.clearInterval(recommendationDayTimer);
    };
  }, []);

  useEffect(() => {
    if (tab !== "play") return;
    const date = todayKey();
    if (gamePrompts && gamePromptsDate === date) return;

    let active = true;
    const cacheKey = `daily-games-api-v1-${date}`;
    setGameLoading(true);
    setGameError(false);

    void (async () => {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          const cachedPrompts = parsed?.prompts ?? parsed;
          if (isGamePrompts(cachedPrompts)) {
            setGamePrompts(cachedPrompts);
            setGamePromptsDate(date);
            setGameError(parsed?.source === "unavailable");
            setGameLoading(false);
            return;
          }
        }
      } catch {
        // Fetch a fresh set if today's cached game prompts are unavailable.
      }

      try {
        const response = await fetch(`/api/daily-games?date=${encodeURIComponent(date)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Fresh game prompts could not be fetched");
        const data = await response.json();
        if (!isGamePrompts(data?.prompts)) throw new Error("Fresh game prompts were incomplete");
        if (!active) return;
        setGamePrompts(data.prompts);
        setGamePromptsDate(date);
        setGameError(data.source === "unavailable");
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ prompts: data.prompts, source: data.source }));
        } catch {
          // Keep today's questions in memory for this visit.
        }
      } catch {
        if (!active) return;
        setGamePrompts({
          wouldYouRather: "",
          whoMoreLikely: "",
          truth: "",
          dare: "",
        });
        setGamePromptsDate(date);
        setGameError(true);
      } finally {
        if (active) setGameLoading(false);
      }
    })();

    return () => { active = false; };
  }, [tab, gamePrompts, gamePromptsDate]);

  const question = gamePrompts?.wouldYouRather ?? "";
  const [optionA = question, optionB = "Pick the other option."] = question.split(", or ");
  const likelyPrompt = gamePrompts?.whoMoreLikely ?? "";
  const truthPrompt = gamePrompts?.truth ?? "";
  const darePrompt = gamePrompts?.dare ?? "";

  const createLetter = async () => {
    if (!body.trim()) {
      setLetterStatus("Write a few words for your letter first.");
      return;
    }

    setSavingLetter(true);
    try {
      setLetterStatus("Making your handwritten note into a shareable letter…");
      const payload = {
        id: crypto.randomUUID(),
        title: title.trim() || "A little letter",
        sender: sender.trim() || "bb",
        body: body.trim(),
        createdAt: new Date().toISOString(),
      };
      const url = createShareableUrl(payload, "letter");
      setLetterUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setLetterStatus("Link copied. This letter only lives in the link.");
      } catch {
        setLetterStatus("Letter ready. Open it or copy the link; it isn't saved here.");
      }
    } catch {
      setLetterStatus("Couldn't make the share link just now. Please try again.");
    } finally {
      setSavingLetter(false);
    }
  };

  const copyLetterLink = async () => {
    try {
      await navigator.clipboard.writeText(letterUrl);
      setLetterStatus("Link copied. This letter only lives in the link.");
    } catch {
      setLetterStatus("Couldn't copy it. Open the letter and copy its address.");
    }
  };

  const selectGameChoice = (type: string, choice: string) => {
    setSelectedChoices((previous) => ({ ...previous, [type]: choice }));
  };

  const choiceButton = (type: string, choice: string, label = choice) => (
    <button
      key={choice}
      className={`btn choice-button ${selectedChoices[type] === choice ? "selected" : ""}`}
      aria-pressed={selectedChoices[type] === choice}
      onClick={() => selectGameChoice(type, choice)}
    >
      {label}
    </button>
  );

  const nav = (
    <div className="mobile-nav">
      {navItems.map(([id, icon, label]) => (
        <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
          <span>{icon}</span>
          <br />
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="max-page topbar-inner">
          <button className="brand" onClick={() => setTab("us")}>
            <span className="brand-heart brand-heart-blue" aria-hidden="true">♥</span>
            <span className="brand-name">bb</span>
            <span className="brand-heart brand-heart-orange" aria-hidden="true">♥</span>
          </button>
          <nav className="nav">
            {navItems.map(([id, icon, label]) => (
              <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
                {icon} {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-page">
        {tab === "us" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                  <div className="eyebrow hero-cities">
                    <img className="country-flag" src="https://flagcdn.com/w40/ph.png" alt="Philippines" width="20" height="15" /> Manila ·
                    <img className="country-flag" src="https://flagcdn.com/w40/nz.png" alt="New Zealand" width="20" height="15" /> Auckland
                  </div>
                <h1>
                  <em>Ellen.</em>
                  <br />
                  <span className="hero-name-blue">Christian.</span>
                </h1>
                <p>
                  Kamusta. Kia Ora.
                </p>
              </div>

              <div
                className="hero-photo"
                style={{
                  backgroundImage:
                    'linear-gradient(180deg, rgba(22,20,18,0.08), rgba(22,20,18,0.46)), url("/hero-romance.avif")',
                }}
              >
                <div className="hero-photo-caption">
                  <small>From here to there</small>
                  <strong>{dailyCaption || "Saving you a seat for our next call."}</strong>
                </div>
              </div>
            </section>

            <section className="section connection-section" aria-label="Our distance, time together, local clocks and weather">
                <div className="card connection-dashboard">
                  <div className="city-time-grid">
                    <div className="city-time">
                      <span className="place"><span className="dot" /><span className="time-emoji" aria-label="Manila local time">{timeEmoji(localHour("Asia/Manila", clockNow))}</span> <img className="country-flag" src="https://flagcdn.com/w40/ph.png" alt="Philippines" width="20" height="15" /> Manila</span>
                      <strong>{formatTime("Asia/Manila", clockNow)}</strong>
                      <span className="city-daypart">{dayPart(localHour("Asia/Manila", clockNow))}</span>
                      {weather?.manila ? (
                        <span className="weather-readout" aria-label={`${weatherDescription(weather.manila.code)}, ${Math.round(weather.manila.temperature)} degrees Celsius`}>
                          {weatherEmoji(weather.manila.code)} {weatherDescription(weather.manila.code)} · {Math.round(weather.manila.temperature)}°
                        </span>
                      ) : <span className="weather-readout">{weatherUnavailable ? "Weather unavailable" : "Checking the sky…"}</span>}
                    </div>
                    <div className="city-time">
                      <span className="place"><span className="dot dot-sage" /><span className="time-emoji" aria-label="Auckland local time">{timeEmoji(localHour("Pacific/Auckland", clockNow))}</span> <img className="country-flag" src="https://flagcdn.com/w40/nz.png" alt="New Zealand" width="20" height="15" /> Auckland</span>
                      <strong>{formatTime("Pacific/Auckland", clockNow)}</strong>
                      <span className="city-daypart">{dayPart(localHour("Pacific/Auckland", clockNow))}</span>
                      {weather?.auckland ? (
                        <span className="weather-readout" aria-label={`${weatherDescription(weather.auckland.code)}, ${Math.round(weather.auckland.temperature)} degrees Celsius`}>
                          {weatherEmoji(weather.auckland.code)} {weatherDescription(weather.auckland.code)} · {Math.round(weather.auckland.temperature)}°
                        </span>
                      ) : <span className="weather-readout">{weatherUnavailable ? "Weather unavailable" : "Checking the sky…"}</span>}
                    </div>
                  </div>
                
                  <div className="connection-divider" />
                  <div className="connection-stats">
                    <div className="relationship-stat relationship-duration">
                      <div className="together-timer" aria-label={`${togetherFor.days} days, ${togetherFor.hours} hours, ${togetherFor.minutes} minutes, and ${togetherFor.seconds} seconds together`}>
                        <span className="timer-unit"><strong>{togetherFor.days.toLocaleString()}</strong><small>days</small></span>
                        <span className="timer-unit"><strong>{String(togetherFor.hours).padStart(2, "0")}</strong><small>hours</small></span>
                        <span className="timer-unit"><strong>{String(togetherFor.minutes).padStart(2, "0")}</strong><small>minutes</small></span>
                        <span className="timer-unit"><strong>{String(togetherFor.seconds).padStart(2, "0")}</strong><small>seconds</small></span>
                      </div>
                      <div className="stat-label">together since May 15, 2026</div>
                    </div>
                    <div className="relationship-stat relationship-km">
                      <div className="stat-num"><span className="stat-world" aria-hidden="true">🌍</span> {kmApart.toLocaleString()}</div>
                      <div className="stat-label">km apart</div>
                    </div>
                  </div>
                </div>
            </section>

            <section className="section recommendations" aria-label="Songs and shows for us">
              <div className="recommendation-heading">
                <h2>Daily Recommendations</h2>
              </div>
              {dailyRecommendations ? (
                <>
                {recommendationFallback ? <p className="recommendation-fallback" role="status">{recommendationStatus}</p> : null}
                <div className="recommendation-grid">
                  <article className="recommendation-card">
                    {dailyRecommendations.song ? (
                      <>
                        <div className="recommendation-art recommendation-art-song">
                          <div className="recommendation-art-placeholder" aria-hidden="true">♫</div>
                          {dailyRecommendations.song.cover ? (
                            <img
                              className="recommendation-cover"
                              src={posterSource(dailyRecommendations.song.cover, dailyRecommendations.song.title)}
                              alt={`${dailyRecommendations.song.album || dailyRecommendations.song.title} album cover`}
                              loading="lazy"
                              onError={(event) => { event.currentTarget.style.display = "none"; }}
                            />
                          ) : null}
                          <span>Our song today</span>
                        </div>
                        <div className="recommendation-details">
                          <span className="recommendation-type">Song</span>
                          <div className="recommendation-copy">
                            <h3>{dailyRecommendations.song.title}</h3>
                            <p>{dailyRecommendations.song.artist}</p>
                          </div>
                          <div className="recommendation-highlight">
                            <p>{dailyRecommendations.song.lyricHighlight ? `“${dailyRecommendations.song.lyricHighlight}”` : dailyRecommendations.song.excerpt}</p>
                            {dailyRecommendations.song.lyricsLink ? <a href={dailyRecommendations.song.lyricsLink} target="_blank" rel="noreferrer">Lyrics ↗</a> : null}
                          </div>
                          <a className="recommendation-link" href={dailyRecommendations.song.link} target="_blank" rel="noreferrer">Listen on Apple Music ↗</a>
                        </div>
                      </>
                    ) : <div className="recommendation-missing"><span className="recommendation-type">Song catalog</span><p>The song catalog could not be reached right now.</p></div>}
                  </article>
                  <article className="recommendation-card">
                    {dailyRecommendations.movie ? (
                      <>
                        <div className="recommendation-art recommendation-art-movie">
                          <img
                            className="recommendation-cover"
                            src={dailyRecommendations.movie.poster ? posterSource(dailyRecommendations.movie.poster, dailyRecommendations.movie.title) : posterFallback(dailyRecommendations.movie.title)}
                            alt={`${dailyRecommendations.movie.title} poster`}
                            loading="lazy"
                            onError={(event) => {
                              if (!event.currentTarget.src.startsWith("data:image/svg+xml")) {
                                event.currentTarget.src = posterFallback(dailyRecommendations.movie?.title ?? "Tonight's pick");
                              }
                            }}
                          />
                          <span>Tonight’s movie</span>
                        </div>
                        <div className="recommendation-details">
                          <span className="recommendation-type">Movie</span>
                          <div className="recommendation-copy">
                            <h3>{dailyRecommendations.movie.title} {dailyRecommendations.movie.year > 0 ? <span>({dailyRecommendations.movie.year})</span> : null}</h3>
                            <p>{dailyRecommendations.movie.note}</p>
                          </div>
                          <a className="recommendation-link" href={dailyRecommendations.movie.link} target="_blank" rel="noreferrer">View movie details ↗</a>
                        </div>
                      </>
                    ) : (
                      <div className="recommendation-missing">
                        <span className="recommendation-type">Movie catalog</span>
                        <p>Apple returned no movie picks right now. Please try again later.</p>
                      </div>
                    )}
                  </article>
                  <article className="recommendation-card">
                    {dailyRecommendations.series ? (
                      <>
                        <div className="recommendation-art recommendation-art-series">
                          {dailyRecommendations.series.poster ? <img className="recommendation-cover" src={posterSource(dailyRecommendations.series.poster, dailyRecommendations.series.title)} alt={`${dailyRecommendations.series.title} poster`} loading="lazy" /> : null}
                          <span>Our next series</span>
                        </div>
                        <div className="recommendation-details">
                          <span className="recommendation-type">Series</span>
                          <div className="recommendation-copy">
                            <h3>{dailyRecommendations.series.title} {dailyRecommendations.series.years ? <span>({dailyRecommendations.series.years})</span> : null}</h3>
                            <p>{dailyRecommendations.series.note}</p>
                          </div>
                          <a className="recommendation-link" href={dailyRecommendations.series.link} target="_blank" rel="noreferrer">Series details ↗</a>
                        </div>
                      </>
                    ) : (
                      <div className="recommendation-missing">
                        <span className="recommendation-type">Series catalog</span>
                        <p>TVmaze could not provide a series pick right now.</p>
                      </div>
                    )}
                  </article>
                </div>
                </>
              ) : (
                <div className="recommendation-unavailable" role="status">
                  {recommendationsLoading ? <LoadingMessage>{recommendationStatus}</LoadingMessage> : <p>{recommendationStatus}</p>}
                </div>
              )}
            </section>

            <section className="section">
              <div className="card love-note-card">
                  <div className="love-note-line">
                    <span className="brand-heart-blue" aria-hidden="true">♥</span>
                    <p>I love you every day.</p>
                    <span className="brand-heart-orange" aria-hidden="true">♥</span>
                  </div>
              </div>
            </section>

          </>
        )}

        {tab === "letters" && (
          <section className="page">
            <div className="eyebrow">Little Letters</div>
            <h1 className="page-title">A note for you.</h1>
            <p className="page-subtitle">A few words, a whole story, or a small lunch update.</p>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="field">
                <label htmlFor="letter-title">Title</label>
                <input id="letter-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="For my favourite person" />
              </div>
              <div className="field">
                <label htmlFor="letter-sender">From</label>
                <input id="letter-sender" value={sender} onChange={(e) => setSender(e.target.value)} placeholder="bb" />
              </div>
              <div className="field">
                <label htmlFor="letter-details">Your letter</label>
                <textarea id="letter-details" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your own note here…" />
              </div>
              <button className="btn primary" onClick={() => void createLetter()} disabled={savingLetter}>
                {savingLetter ? "Making your letter…" : "Create my letter"}
              </button>
              {letterStatus ? <p className="letter-status" role="status">{letterStatus}</p> : null}
              {letterUrl ? (
                <div className="letter-actions">
                  <a className="btn" href={letterUrl}>Open letter</a>
                  <button className="btn" onClick={() => void copyLetterLink()}>Copy link</button>
                </div>
              ) : null}
            </div>

          </section>
        )}

        {tab === "play" && (
          <section className="page play-page">
            <div className="eyebrow">Play</div>
            <h1 className="page-title">Let's see who wins.</h1>
            <p className="page-subtitle">Friendly competition. Absolutely no scorekeeping.</p>

            {gameLoading ? <LoadingMessage>Gathering today’s questions…</LoadingMessage> : (
            <>
            {gameError ? <p className="game-fallback" role="status">Daily questions couldn’t be reached. Please try again later.</p> : null}
            <div className="game-grid">
              {question ? <div className="card game-card">
                <span className="tag">Would You Rather</span>
                <h3>Pick a small dilemma.</h3>
                <div className="choice-row">
                  {choiceButton("Would You Rather", optionA)}
                  {choiceButton("Would You Rather", optionB)}
                </div>
                {selectedChoices["Would You Rather"] ? <p className="game-feedback">A fine choice. We can discuss the merits later.</p> : null}
              </div> : null}

              {likelyPrompt ? <div className="card game-card">
                <span className="tag">Who’s More Likely?</span>
                <h3>{likelyPrompt}</h3>
                <div className="choice-row">
                  {choiceButton("Who’s More Likely", "You")}
                  {choiceButton("Who’s More Likely", "Me")}
                </div>
                {selectedChoices["Who’s More Likely"] ? <p className="game-feedback">We'll hear the other side on the next call.</p> : null}
              </div> : null}

              {truthPrompt ? <div className="card game-card">
                <span className="tag">Truth</span>
                <h3>{truthPrompt}</h3>
              </div> : null}

              {darePrompt ? <div className="card game-card">
                <span className="tag">Dare</span>
                <h3>{darePrompt}</h3>
              </div> : null}
            </div>
            </>
            )}
          </section>
        )}

      </main>

      <footer className="footer" aria-label="A little tulip garden">
          <div className="city-bridge" aria-label={`${hoursAway} hours apart`}>
            <span className="city-bridge-line" />
            <span className="city-bridge-flower" aria-hidden="true">🌷</span>
            <span className="city-bridge-flower" aria-hidden="true">🌷</span>
            <span className="city-bridge-flower" aria-hidden="true">🌷</span>
            <span className="city-bridge-line" />
          </div>
      </footer>
      {nav}
    </div>
  );
}
