import { getCentrifyingSpaces, getMetrics } from "./functions";
import tele2Config from "../config/config";
import { LotItem } from "../model/lot";
import { Task } from "../model/task";
import chalk from "chalk";
import { printAccountLine } from "../account/logger/bot-screen";

const getAccountRows = (userInfo) => {
  if (userInfo.sold && userInfo.rests) {
    const pfDelta = userInfo.dBalance - userInfo.rests.tariffCost - userInfo.rests.lotUplift;
    const pfString = `${((pfDelta >= 0)) ? chalk.green(`+ ` + Math.abs(pfDelta) + ` р.`) : chalk.red(`- ` + Math.abs(pfDelta) + ` р.`)}`;

    return [
      `CURRENT PERIOD DYNAMICS:`, [
        `Calls bought: ${chalk.green(userInfo.sold.calls)} lot${(userInfo.sold.calls !== 1) ? `s` : ``} / ${userInfo.placed.calls} placed`,
        `Internet bought: ${chalk.green(userInfo.sold.internet)} lot${(userInfo.sold.internet !== 1) ? `s` : ``} / ${userInfo.placed.internet} placed`,
        `Income: ${chalk.green(`+ ${userInfo.dBalance} р.`)}`,
        `Lot uplift: ${chalk.red(`- ${userInfo.rests.lotUplift} р.`)}`,
      ], `ACCOUNT INFO:`, [
        `Balance: ${userInfo.balance} p.`,
        `Calls: ${userInfo.rests.calls} МИН (sellable ${userInfo.rests.sellable.calls} МИН)`,
        `Internet: ${userInfo.rests.internet} (sellable ${userInfo.rests.sellable.internet} ГБ)`,
        `Tariff cost: ${userInfo.rests.tariffCost} р.`,
      ], `Profit: ${pfString}`,
    ];
  } else {
    return [
      `NO INFO`
    ];
  }
};

export class ConsoleLot {
  lotItem: LotItem;

  constructor(lotItem: LotItem) {
    this.lotItem = lotItem;
  }

  private getSmallId = () => {
    return this.lotItem.id.substring(this.lotItem.id.length - 3);
  };

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
  };

  getInfo = (): Array<string> => [
    this.getSmallIndicator(),
    this.getSmallId(),
    this.lotItem.name,
  ];

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


  private async printTable(showAccount: boolean): Promise<void> {
    const { screenWidth } = getMetrics();
    const printLine = (offset = 0) => {
      console.log(`+${`-`.repeat(screenWidth - 2 - offset)}+`);
    };

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

    let accRows;
    let accRow = 0;
    let accLine = 0;
    let maxConsumedWidth = 0;
    let onNoMoreRowsReached = false;

    if (showAccount) {
      accRows = getAccountRows(this.task.userInfo);
    }

    const onNoMoreRows = (firstCallback, secondCallback) => {
      if (!onNoMoreRowsReached) {
        firstCallback();
      } else {
        secondCallback();
      }
      onNoMoreRowsReached = true;
    };

    const onNoMoreLines = async (callback, noMoreRowsCallback1, noMoreRowsCallback2) => {
      accRow++;
      accLine = 0;

      const consumedWidth = await printAccountLine(accRow, accLine, accRows);
      maxConsumedWidth = Math.max(maxConsumedWidth, consumedWidth);

      if (consumedWidth === -1) {
        onNoMoreRows(noMoreRowsCallback1, noMoreRowsCallback2);
      } else {
        accLine++;
        callback();
      }
    };

    const printAccountLineBorder = async () => {
      const consumedWidth = await printAccountLine(accRow, accLine, accRows);
      maxConsumedWidth = Math.max(maxConsumedWidth, consumedWidth);

      if (consumedWidth === -1) {
        onNoMoreRows(() => {
          process.stdout.write(`+` + `-`.repeat(maxConsumedWidth - 2) + `+`);
          printLine(maxConsumedWidth);
        }, () => {
          process.stdout.write(` `.repeat(maxConsumedWidth));
          printLine(maxConsumedWidth);
        });
      } else if (consumedWidth === null) {
        await onNoMoreLines(() => {
          printLine(maxConsumedWidth);
        }, () => {
          process.stdout.write(`+` + `-`.repeat(maxConsumedWidth - 2) + `+`);
          printLine(maxConsumedWidth);
        }, () => {
          process.stdout.write(` `.repeat(maxConsumedWidth));
          printLine(maxConsumedWidth);
        });
      } else {
        printLine(consumedWidth);
        accLine++;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      if (showAccount) {
        await printAccountLineBorder();
      } else {
        printLine();
      }
      let str = ``;
      if (showAccount) {
        const offset = await printAccountLine(accRow, accLine, accRows);
        maxConsumedWidth = Math.max(maxConsumedWidth, offset);
        accLine++;

        if (offset === null) {
          await onNoMoreLines(() => {
            //process.stdout.write(` `.repeat(maxConsumedWidth));
          }, () => {
            process.stdout.write(`+` + `-`.repeat(maxConsumedWidth - 2) + `+`);
          }, () => {
            process.stdout.write(` `.repeat(maxConsumedWidth));
          });
        } else if (offset === -1) {
          onNoMoreRows(() => {
            process.stdout.write(`+` + `-`.repeat(maxConsumedWidth - 2) + `+`);
          }, () => {
            process.stdout.write(` `.repeat(maxConsumedWidth));
          });
        }
      }
      lines[i].forEach((item, index) => {
        str += `${item.padEnd(columnWidth[index])} | `;
      });
      str = str.substring(0, str.length - 2);
      str = ` ` + str;
      str += ` `.repeat(screenWidth - str.length - 2 - maxConsumedWidth);
      str = `|${str}|`;
      if (this.task.lots?.[i].indicator === `placed`) {
        str = chalk.rgb(0, 0, 0).bgGreenBright(str);
      } else if (this.task.lots[i].indicator === `removed`) {
        str = chalk.rgb(0, 0, 0).bgRedBright(str);
      } else if (this.task.lots[i].indicator === `changed`) {
        str = chalk.rgb(0, 0, 0).bgYellowBright(str);
      }

      console.log(str);

    }

    if (showAccount) {
      await printAccountLineBorder();
    } else {
      printLine();
    }
  }

  print = async (showAccount = false): Promise<void> => {
    this.clear();
    // TaskScreen.printLabel();
    this.printInfo();
    await this.printTable(showAccount);
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