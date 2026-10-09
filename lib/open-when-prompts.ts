export const OPEN_WHEN_PROMPTS = {
  sad: {
    context: "They feel sad and need to feel understood, cared for, and gently reassured. Acknowledge the sadness without trying to dismiss or fix it.",
    fallback: "I’m sorry it feels heavy right now. You don’t have to pretend you’re okay or figure everything out this minute. I’m here with you, I love you, and we can take this one small moment at a time.",
  },
  lonely: {
    context: "They feel lonely and could use a reminder that they matter to their partner even while apart.",
    fallback: "I wish I could sit beside you right now, but please remember you’re never forgotten or far from my heart. I’m thinking of you in all the little moments, and I’m always here when you want me.",
  },
  "miss-you": {
    context: "They miss their long-distance partner and wish they could be together.",
    fallback: "I miss you too, and I wish I could close the miles for a little while. Until I can, keep this close: you’re part of every ordinary day I have, and I love you from here just as much as I would beside you.",
  },
  anxious: {
    context: "They feel anxious and need calm reassurance without having their feelings dismissed or being told to simply stop worrying.",
    fallback: "You don’t have to solve every worry all at once. Take one slow breath and let this moment be enough for now. I’m here with you, and we can face whatever comes one step at a time.",
  },
  overwhelmed: {
    context: "They feel overwhelmed by too much happening at once and need gentle support and permission to pause.",
    fallback: "You’re allowed to put everything down for a moment. You only have to take the next small step, not carry the whole day at once. I’m proud of you, and I’m right here beside you in spirit.",
  },
  "bad-day": {
    context: "They have had a difficult day and need comfort, reassurance, and permission to rest.",
    fallback: "You don’t have to solve everything tonight. I’m proud of you for making it through today, and I wish I could be there to make things feel a little lighter. Let yourself rest; tomorrow can wait until tomorrow.",
  },
  "cant-sleep": {
    context: "They cannot sleep and need a calm, gentle message for a long night.",
    fallback: "Take one slow breath and let the day loosen its hold on you. You are safe, you are loved, and nothing needs to be figured out this minute. I’m sending you the quietest goodnight from here.",
  },
  "need-love": {
    context: "They need reassurance that they are deeply loved and valued.",
    fallback: "You are loved in all the small, everyday ways and in all the miles between us. I love your heart, your little habits, and the way you make my life feel more like home. You never have to earn that love.",
  },
  "good-news": {
    context: "They have good news and want to feel celebrated by their partner. Share their excitement warmly and invite them to tell you more.",
    fallback: "That’s wonderful, and I’m so happy for you. I love getting to celebrate the things that make you feel proud and excited. Tell me every detail when you can—I want to hear it all.",
  },
} as const;

export type OpenWhenFeeling = keyof typeof OPEN_WHEN_PROMPTS;
