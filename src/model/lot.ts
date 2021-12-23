import {Tele2LotItem} from "../utils/tele2-responses";
import {Emoji} from "../utils/emoji";

export type Indicator = `placed` | `up` | `down` | `removed` | `changed` | `none`;

export class LotItem {
  indicator: Indicator = `none`;
  id: string;
  name: string;
  emojisArray: Array<Emoji> = [];

  constructor(tele2LotItem: Tele2LotItem) {
    this.id = tele2LotItem.id;
    this.name = tele2LotItem.seller.name || `Anon`;
    for (let i = 0; i < 3; i++) {
      this.emojisArray.push(new Emoji(tele2LotItem.seller.emojis[i]));
    }
  }
}