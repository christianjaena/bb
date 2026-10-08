import { NextResponse } from "next/server";

type Coordinates = {
  latitude: number;
  longitude: number;
  timezone: string;
};

const CITIES: Record<string, Coordinates> = {
  manila: { latitude: 14.5995, longitude: 120.9842, timezone: "Asia/Manila" },
  auckland: { latitude: -36.8509, longitude: 174.7645, timezone: "Pacific/Auckland" },
};

async function readCurrentWeather({ latitude, longitude, timezone }: Coordinates) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,weather_code",
    timezone,
  }).toString();

  const response = await fetch(url, { next: { revalidate: 900 } });
  if (!response.ok) throw new Error("Weather service unavailable");

  const data = await response.json();
  return {
    temperature: data.current.temperature_2m as number,
    code: data.current.weather_code as number,
  };
}

export async function GET() {
  try {
    const [manila, auckland] = await Promise.all([
      readCurrentWeather(CITIES.manila),
      readCurrentWeather(CITIES.auckland),
    ]);

    return NextResponse.json({ manila, auckland });
  } catch {
    return NextResponse.json({ error: "Weather is unavailable right now." }, { status: 502 });
  }
}