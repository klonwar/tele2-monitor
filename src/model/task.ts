import {LotsResponse} from "../utils/tele2-responses";
import fetch from "node-fetch";
import {LotItem} from "./lot";
import {MonitorDBInterface} from "../utils/monitor-d-b";
import {Analytics} from "./analytics";

export class Task {
  readonly url: string;
  readonly db: MonitorDBInterface;
  readonly userInfo = {"calls0":0,"internet0":0,"sold":{"internet":0,"calls":0},"placed":{"internet":0,"calls":0},"active":{"calls":0,"internet":0,"list":[]},"dBalance":0,"balance":6982.56,"rests":{"tariffCost":150,"internet":"65,03 ГБ","calls":"6667","sellable":{"internet":"30.0","calls":700}}};

  private bigLotsList: Array<LotItem> = [];
  private removedLots: Array<{ lot: LotItem, index: number }> = [];
  private prevLots: Array<LotItem> = [];
  lots: Array<LotItem> = [];

  constructor({url, db}: { url: string, db: MonitorDBInterface }) {
    this.url = url;
    this.db = db;
  }

  readonly analytics = new Analytics();

  update = async (): Promise<void> => {
    this.prevLots = this.lots;
    this.analytics.resetLocal();

    this.analytics.startRecordingFetchTime();
    const resp: LotsResponse = await (await fetch(this.url)).json();
    this.analytics.stopRecordingFetchTime();

    const newLotsList: Array<LotItem> = resp.data.map((item) => new LotItem(item));

    this.updateDifference(newLotsList);
    this.compileLists();
  }

  private compileLists = () => {
    this.lots = [];

    let offset = this.analytics.local.placed;
    this.bigLotsList.forEach((item, index) => {
      const removedOnThisIndex = this.removedLots.filter((item) => item.index === index + offset);
      if (removedOnThisIndex.length !== 0) {
        this.lots.push(removedOnThisIndex[0].lot);
        offset++;
      }
      if (item.indicator === `none`) {
        if (offset < this.analytics.local.placed) {
          // item.indicator = `down`;
        } else if (offset > this.analytics.local.placed) {
          item.indicator = `up`;
        }
      }
      this.lots.push(item);
    });

    this.lots = this.lots.slice(0, 10);
    if (this.prevLots.length === 0) {
      this.lots.map((item) => item.indicator = `none`);
    }
    this.lots.map((item) => {
      if (item.indicator === `removed`)
        this.analytics.incRemoved();
    });
  }

  private updateDifference = (newLotsList: Array<LotItem>): void => {
    // Нужно затем, что новые появляются только сверху, а все остальное - ошибка
    // ... наверно
    let isNew = true;
    for (let newIndex = 0; newIndex < newLotsList.length; newIndex++) {
      const newItem = newLotsList[newIndex];

      const oldItemPredicate = (oldItem) => oldItem.id === newItem.id;
      const oldIndex = this.bigLotsList.findIndex(oldItemPredicate);
      const oldItem = this.bigLotsList.find(oldItemPredicate);

      if (this.prevLots.length !== 0) {
        if (oldIndex === -1) {
          if (isNew) {
            newItem.indicator = `placed`;
            this.analytics.incPlaced();
          }
        } else {
          isNew = false;
          if (oldItem.name !== newItem.name) {
            newItem.indicator = `changed`;
          }
        }
      }
    }

    const removedItems = [];
    for (let oldIndex = 0; oldIndex < this.bigLotsList.length; oldIndex++) {
      const oldItem = this.bigLotsList[oldIndex];
      const newIndex = newLotsList.findIndex((newItem) => oldItem.id === newItem.id);

      if (newIndex === -1) {
        oldItem.indicator = `removed`;
        removedItems.push({lot: oldItem, index: oldIndex});
      }
    }

    this.bigLotsList = [...newLotsList];
    this.removedLots = [...removedItems];
  }
}