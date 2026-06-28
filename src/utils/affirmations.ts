const AFFIRMATIONS = [
  'Way to go! 🎉',
  "Keep it up — you're on a roll! 🚀",
  'Excellent progress! 👏',
  "That's what I'm talking about! 🔥",
  'Crushing it! ⚡',
  'Outstanding work! ⭐',
  'Momentum is building! 💪',
  'Nailed it! Moving right along! 🎯',
  'Progress unlocked! 🏆',
  'Look at you go! 🌟',
  'One step closer to done! 🏁',
  "Yes! That's how it's done! 🙌",
  'Killing it today! 💥',
  'Making it happen! 🚀',
  'Another one bites the dust! 🎸',
  'Efficiency level: expert! 🧠',
  'Keep that momentum rolling! 🎱',
  'Boom! Next stage unlocked! 🎮',
  'High five! ✋',
  'The team is going to love this! 🤝',
  "DPK done — what's next? 💡",
  "You're making this look easy! 🌈",
  "That's a wrap on that stage! 🎬",
  'Progress is addictive, isn\'t it? 😄',
  'On track and on fire! 🔥',
  'Smooth operator! 🎵',
  'Forward and upward! ⬆️',
  "That's a W! 🏅",
  "Can't stop, won't stop! 🎶",
  'Building that pipeline! 🔧',
  'Dreams becoming reality! ✨',
  'Moving mountains one DPK at a time! ⛰️',
  'Excellence in motion! 💫',
  "That's the spirit! 🎊",
  'Locked in! 🔐',
  'You just levelled up! 🎮',
  'The finish line is closer than you think! 🏃',
  'Green is the colour of progress! 💚',
  'Steady progress beats sporadic bursts! 🌊',
  'Another day, another milestone! 📅',
  'The team is watching and impressed! 👀',
  'That card just got a promotion! 📈',
  'Tick it off! ✅',
  "You're unstoppable! ⚡",
  'Absolutely smashing it! 🎳',
  "One more down, let's go! 🎿",
  "The board doesn't lie — great work! 📊",
  'Small steps make big journeys! 🗺️',
  "That's what progress looks like! 💎",
  'Stage cleared! 🕹️',
];

const usedIndices: number[] = [];

export function getRandomAffirmation(): string {
  if (usedIndices.length >= AFFIRMATIONS.length) usedIndices.length = 0;
  const available = AFFIRMATIONS.map((_, i) => i).filter(i => !usedIndices.includes(i));
  const idx = available[Math.floor(Math.random() * available.length)];
  usedIndices.push(idx);
  return AFFIRMATIONS[idx];
}
