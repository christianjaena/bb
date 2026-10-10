import { NextResponse } from "next/server";
import { generateGeminiText } from "@/lib/gemini";

export const dynamic = "force-dynamic";

const tagalogJokes = [
  "Bakit laging kalmado ang calculator? Kasi marunong siyang magbilang hanggang sampu bago magalit.",
  "Anong paboritong ulam ng computer? Adobo-ware.",
  "Bakit hindi naliligaw ang lapis? Kasi lagi siyang may point.",
  "Anong sabi ng kape sa umaga? Tara, gising na tayo—ako na bahala sa pampagising!",
  "Bakit masipag ang orasan? Kasi bawat segundo, may ginagawa.",
  "Bakit laging handa ang payong? Ayaw niyang mabigla sa mga patak ng balita.",
  "Anong tawag sa tinapay na mahilig maglakbay? Pan de lakad.",
  "Bakit nagdala ng kumot ang cellphone? Para may screen cover habang natutulog.",
  "Anong paboritong subject ng kalendaryo? Dates.",
  "Bakit hindi nag-aaway ang mga kutsara? Ayaw nilang lumalim ang sandok.",
  "Anong sabi ng unan sa pagod na tao? Sige, dito ka na mag-headline.",
  "Bakit mahusay magtago ang asin? Kasi lagi siyang nasa likod ng seasoning.",
  "Anong tawag sa pusang mahilig sa musika? Meow-sician.",
  "Bakit laging may dalang lapis ang puno? Baka kailangan niyang mag-draw ng sanga.",
  "Anong sabi ng sapatos sa medyas? Magkapareha talaga tayo, kahit minsan nawawala ka.",
  "Bakit hindi nagmamadali ang kaldero? Alam niyang darating din ang kumukulong punto.",
  "Anong paboritong laro ng tinapay? Hide and wheat.",
  "Bakit masaya ang bintana? Bukas siya sa lahat ng posibilidad.",
  "Anong sabi ng ilaw sa switch? Ikaw talaga ang nagpapasaya sa araw ko.",
  "Bakit mahusay makinig ang tasa? Kasi lagi siyang may handle sa usapan.",
  "Bakit hindi kinakabahan ang halaman sa exam? May sarili siyang reviewer: dahon-dahon.",
  "Anong paboritong kanta ng electric fan? Ikaw ang hangin sa buhay ko.",
  "Bakit laging magkasama ang tinidor at kutsara? Nasa iisang set sila ng priorities.",
  "Anong sabi ng medyas sa labada? Sana magkita ulit tayo pagkatapos ng ikot.",
  "Bakit mahusay magplano ang kalapati? May coo-ordinates siya.",
];

export async function GET() {
  const generated = await generateGeminiText(
    "Sumulat ng isang maikli at nakakatawang biro sa natural na Filipino/Tagalog para sa magkasintahang magkalayo. Dapat madaling maintindihan, magaan, walang bastos na tema, at hindi salin-salin mula sa Ingles. Isang biro lang; ibalik ang mismong biro at wala nang paliwanag.",
  );
  const cleaned = generated?.replace(/[\r\n]+/g, " ").replace(/^['\"]|['\"]$/g, "").trim();
  const usedAi = Boolean(cleaned && cleaned.length <= 240 && /[\p{L}]/u.test(cleaned));
  const joke = usedAi ? cleaned : tagalogJokes[Math.floor(Math.random() * tagalogJokes.length)];
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

  return NextResponse.json(
    { joke, date, source: usedAi ? "ai" : "local" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
