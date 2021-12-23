import {EmojiString} from "./emoji";

interface Tele2Response<T> {
  meta: {
    status: string,
    message: string | null
  },
  data: T
}

export interface Tele2LotItem {
  id: string,
  seller: {
    name: string,
    emojis: Array<EmojiString>
  },
  trafficType: `data` | `voice`,
  volume: {
    value: number,
    uom: `gb` | `min`
  },
  cost: {
    amount: number,
    currency: `rub`
  },
  commission: Record<string, unknown>,
  status: `active` | `bought`,
  my: boolean,
  hash: string
}

export interface LotsResponse extends Tele2Response<Array<Tele2LotItem>> {

}