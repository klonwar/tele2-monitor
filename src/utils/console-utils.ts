import {getCentrifyingSpaces, getMetrics} from "./functions";
import tele2Config from "../config/config";
import {LotItem} from "../model/lot";
import {Task} from "../model/task";
import chalk from "chalk";


export class ConsoleLot {
  lotItem: LotItem;

  constructor(lotItem: LotItem) {
    this.lotItem = lotItem;
  }

  private getSmallId = () => {
    return this.lotItem.id.substring(this.lotItem.id.length - 3);
  }

  private getSmallIndicator = (): string => {
    switch (this.lotItem.indicator) {
      case `down`:
        return `↓`;
      case `up`:
        return `↑`;
      case `removed`:
        return `-`;
      case `placed`:
        return `+`;
      case `changed`:
        return ` `;
      case `none`:
        return ` `;
    }
  }

  getInfo = (): Array<string> => [
    this.getSmallIndicator(),
    this.getSmallId(),
    this.lotItem.name,
  ]

}

export class TaskScreen {
  task: Task;

  constructor(task: Task) {
    this.task = task;
  }

  private static printLabel(): void {
    for (const item of tele2Config.label) {
      console.log(getCentrifyingSpaces(item.length) + item);
    }
  }

  private printInfo(): void {
    const settingsLine = `[${this.task.db.amount} ${(this.task.db.source === `internet`) ? `gb` : `min`}]  [${this.task.db.price} p]`;
    console.log();
    console.log(getCentrifyingSpaces(settingsLine.length) + settingsLine);

    const line1 = `[Pl: ${this.task.analytics.global.placed.toFixed(3)}] [Re: ${this.task.analytics.global.removed.toFixed(3)}] [T: ${this.task.analytics.local.fetchTime.toFixed(3)}s]`;
    console.log(getCentrifyingSpaces(line1.length) + line1);

    const strCurrent = this.task.analytics.streak.current;
    const strMax = this.task.analytics.streak.max;

    const line2 = `Place Streak: ${strCurrent} / ${strMax}`;
    console.log(getCentrifyingSpaces(line2.length) +
      ((strCurrent > strMax && strMax !== 0)
          ? chalk.rgb(0, 0, 0).bgGreenBright(line2)
          : (strCurrent === strMax && strMax !== 0)
            ? chalk.rgb(0, 0, 0).bgYellowBright(line2)
            : line2
      )
    );

    console.log();
  }


  private printTable(): void {
    const {screenWidth} = getMetrics();
    const printLine = () => console.log(`+${`-`.repeat(screenWidth - 2)}+`);

    let columnWidth: Array<number> = [];
    const lines: Array<Array<string>> = [];

    for (let i = 0; i < this.task.lots.length; i++) {
      const item = this.task.lots[i];
      const info = (new ConsoleLot(item)).getInfo();

      if (columnWidth.length === 0) {
        columnWidth = info.map((item) => item.length);
      } else {
        for (let j = 0; j < info.length; j++) {
          columnWidth[j] = Math.max(columnWidth[j], info[j].length);
        }
      }

      lines.push(info);
    }


    printLine();

    for (let i = 0; i < lines.length; i++) {
      let str = ``;
      lines[i].forEach((item, index) => {
        str += `${item.padEnd(columnWidth[index])} | `;
      });
      str = str.substring(0, str.length - 2);
      str = ` ` + str;
      str += ` `.repeat(screenWidth - str.length - 2);
      str = `|${str}|`;
      if (this.task.lots?.[i].indicator === `placed`) {
        str = chalk.rgb(0, 0, 0).bgGreenBright(str);
      } else if (this.task.lots[i].indicator === `removed`) {
        str = chalk.rgb(0, 0, 0).bgRedBright(str);
      } else if (this.task.lots[i].indicator === `changed`) {
        str = chalk.rgb(0, 0, 0).bgYellowBright(str);
      }

      console.log(str);
      printLine();
    }


  }

  print = (): void => {
    this.clear();
    // TaskScreen.printLabel();
    this.printInfo();
    this.printTable();
  };

  clear = (): void => {
    const readline = require(`readline`);
    const rows = process.stdout.rows;
    for (let i = 0; i < rows; i++) {
      readline.cursorTo(process.stdout, 0, i);
      readline.clearLine(process.stdout, 0);
    }
    readline.cursorTo(process.stdout, 0, 0);
  };
}