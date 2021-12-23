import {autoRequire, clearScreen, getCentrifyingSpaces} from "../funcs/functions";
import {log} from "./logger";

export const printTable = async (...rows) => {
  await autoRequire(`string-length`);
  const stringLength = require(`string-length`);

  const fixLength = (str, length, symbol = ` `) => {
    while (stringLength(str) < length) {
      str += symbol;
    }
    return str;
  };

  let maxWidth = 0;

  for (let row of rows) {
    if (typeof row === `string`) {
      row = [row];
    }

    for (let str of row) {
      maxWidth = Math.max(maxWidth, stringLength(str));
    }
  }

  let borderString = `+` + fixLength(``, maxWidth + 2, `-`) + `+`;
  let spaces = getCentrifyingSpaces(maxWidth + 4);

  for (let row of rows) {
    log(spaces + borderString);
    if (typeof row === `string`) {
      row = [row];
    }

    for (let str of row) {
      log(spaces + `| ` + fixLength(str, maxWidth) + ` |`);
    }
  }
  log(spaces + borderString);
};

export const clearAndRewrite = async (label, userInfo, textAfterTable, progressBar) => {
  await autoRequire(`chalk`);
  await autoRequire(`readline`);
  const chalk = require(`chalk`);
  const readline = require(`readline`);
  clearScreen();

  for (let item of label) {
    log(getCentrifyingSpaces(item.length) + item);
  }

  if (userInfo.sold && userInfo.rests) {
    let pfDelta = userInfo.dBalance - userInfo.rests.tariffCost;
    let pfString = `${((pfDelta >= 0)) ? chalk.green(`+ ` + Math.abs(pfDelta) + ` р.`) : chalk.red(`- ` + Math.abs(pfDelta) + ` р.`)}`;

    await printTable(`CURRENT PERIOD DYNAMICS:`, [
      `Calls bought: ${chalk.green(userInfo.sold.calls)} lot${(userInfo.sold.calls !== 1) ? `s` : ``} / ${userInfo.placed.calls} placed`,
      `Internet bought: ${chalk.green(userInfo.sold.internet)} lot${(userInfo.sold.internet !== 1) ? `s` : ``} / ${userInfo.placed.internet} placed`,
      `Balance change: ${chalk.green(`+ ${userInfo.dBalance} р.`)}`
    ], `ACCOUNT INFO:`, [
      `Balance: ${userInfo.balance} p.`,
      `Calls: ${userInfo.rests.calls} МИН (rollover ${userInfo.rests.rollover.calls} МИН)`,
      `Internet: ${userInfo.rests.internet} (rollover ${userInfo.rests.rollover.internet} ГБ)`,
      `Tariff cost: ${userInfo.rests.tariffCost} р.`,
    ], `Profit: ${pfString}`);
  } else {
    await printTable([
      `NO INFO`
    ]);
  }

  for (let item of textAfterTable) {
    log(`-@ ${item}`);
  }

  if (progressBar) {
    progressBar.writeProgress();
  }
};

