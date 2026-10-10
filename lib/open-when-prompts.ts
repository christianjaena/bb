export const OPEN_WHEN_PROMPTS = {
  sad: {
    context: "They feel sad and need to feel understood, cared for, and gently reassured. Acknowledge the sadness without trying to dismiss or fix it.",
    fallbacks: [
      "I’m sorry it feels heavy right now. You don’t have to pretend you’re okay or figure everything out this minute. I’m here with you, I love you, and we can take this one small moment at a time.",
      "You don’t have to find the bright side right now. I can sit with you in this feeling, even from far away. I love you exactly as you are, on the easy days and the hard ones.",
      "If all you can do today is get through this hour, that’s enough. I’m thinking of you and wishing I could bring you something warm and stay close until things feel a little softer.",
    ],
  },
  lonely: {
    context: "They feel lonely and could use a reminder that they matter to their partner even while apart.",
    fallbacks: [
      "I wish I could sit beside you right now, but please remember you’re never forgotten or far from my heart. I’m thinking of you in all the little moments, and I’m always here when you want me.",
      "Even when the room feels quiet, you’re still part of my day. I’m carrying you with me through every little thing, and I can’t wait until we get to share the same space again.",
      "I know a message can’t fill the seat beside you, but I hope it reminds you that you matter so much to me. You’re never doing life entirely on your own; I’m right here, loving you from afar.",
    ],
  },
  "miss-you": {
    context: "They miss their long-distance partner and wish they could be together.",
    fallbacks: [
      "I miss you too, and I wish I could close the miles for a little while. Until I can, keep this close: you’re part of every ordinary day I have, and I love you from here just as much as I would beside you.",
      "I wish I could skip straight to the next hello. For now, I’m saving up all the little stories I want to tell you, and loving you through every mile between us.",
      "Some moments make me wish you were here to see the exact same thing. Then I remember we’re looking toward the same next visit, and it makes the distance feel a little less endless.",
    ],
  },
  anxious: {
    context: "They feel anxious and need calm reassurance without having their feelings dismissed or being told to simply stop worrying.",
    fallbacks: [
      "You don’t have to solve every worry all at once. Take one slow breath and let this moment be enough for now. I’m here with you, and we can face whatever comes one step at a time.",
      "Let’s only think about the next small thing, not every what-if at once. Take a sip of water, loosen your shoulders if you can, and remember you can call me. We’ll handle this together.",
      "I know your thoughts are moving fast. You don’t need to chase every one of them right now. Stay with this breath, then the next; I’m here and I love you through all of it.",
    ],
  },
  overwhelmed: {
    context: "They feel overwhelmed by too much happening at once and need gentle support and permission to pause.",
    fallbacks: [
      "You’re allowed to put everything down for a moment. You only have to take the next small step, not carry the whole day at once. I’m proud of you, and I’m right here beside you in spirit.",
      "That is a lot to hold, love. You can pause before deciding what comes next. Let’s make the next thing small: one glass of water, one breath, one moment at a time.",
      "You don’t have to be productive for me or have everything figured out. I wish I could take one thing off your plate; until then, let me remind you that you’re doing enough by being here.",
    ],
  },
  "bad-day": {
    context: "They have had a difficult day and need comfort, reassurance, and permission to rest.",
    fallbacks: [
      "You don’t have to solve everything tonight. I’m proud of you for making it through today, and I wish I could be there to make things feel a little lighter. Let yourself rest; tomorrow can wait until tomorrow.",
      "I’m sorry today asked so much of you. You made it through, and that counts. If I were there, I’d help you get comfortable and let the rest of the day be over.",
      "You can leave the unfinished things for another day. I hope you give yourself the same kindness you’d give me after a rough one. I love you, and I’m proud of you for keeping going.",
    ],
  },
  "cant-sleep": {
    context: "They cannot sleep and need a calm, gentle message for a long night.",
    fallbacks: [
      "Take one slow breath and let the day loosen its hold on you. You are safe, you are loved, and nothing needs to be figured out this minute. I’m sending you the quietest goodnight from here.",
      "The night can be long, so let’s make this minute gentle. Unclench your jaw, settle into your pillow, and imagine my hand in yours. You don’t have to answer anything until morning.",
      "If sleep takes its time, that’s okay. Resting still counts. I’m thinking of you under the same night sky, sending all my love until your mind feels quiet enough to drift.",
    ],
  },
  "need-love": {
    context: "They need reassurance that they are deeply loved and valued.",
    fallbacks: [
      "You are loved in all the small, everyday ways and in all the miles between us. I love your heart, your little habits, and the way you make my life feel more like home. You never have to earn that love.",
      "You don’t have to achieve anything or be in a certain mood to deserve my love. I love you on ordinary Tuesdays, on messy days, and in every quiet moment in between.",
      "Here’s your reminder: I choose you, I treasure you, and I’m grateful I get to love you. The distance can change where we are, but it can’t change how much you mean to me.",
    ],
  },
  "good-news": {
    context: "They have good news and want to feel celebrated by their partner. Share their excitement warmly and invite them to tell you more.",
    fallbacks: [
      "That’s wonderful, and I’m so happy for you. I love getting to celebrate the things that make you feel proud and excited. Tell me every detail when you can—I want to hear it all.",
      "Look at you! I’m grinning over here because I know how much this means to you. I wish I could celebrate in person, but I’m absolutely cheering for you from my side of the map.",
      "I love seeing good things find their way to you. You worked for this, and you deserve to enjoy it. Save me all the details—I want to celebrate every bit with you.",
    ],
  },
} as const;

export type OpenWhenFeeling = keyof typeof OPEN_WHEN_PROMPTS;
