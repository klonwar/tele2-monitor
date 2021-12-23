export type EmojiString = `rich` | `devil` | `cat` | `bomb` |
  `scream` | `cool` | `tongue` | `zipped`;

export class Emoji {
  readonly emojiString: EmojiString;
  readonly emoji: string;

  constructor(emojiString: EmojiString) {
    this.emojiString = emojiString;
    this.emoji = this.getEmojiFromString(emojiString);
  }

  private getEmojiFromString = (emStr: EmojiString) => {
    switch (emStr) {
      case `bomb`:
        return `B`;
      case `devil`:
        return `D`; // 👿
      case `rich`:
        return `$`; // 💰 🤑
      case `cat`:
        return `K`;
      case `scream`:
        return `S`;
      case `cool`:
        return `C`;
      case `tongue`:
        return `T`;
      case `zipped`:
        return `Z`;
      default:
        return ` `;
    }
  }
}

