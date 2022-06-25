import { askForDB, parseArgv, readDb, waitFor } from "./utils/functions";
import { MonitorDB, MonitorDBInterface } from "./utils/monitor-d-b";
import { Task } from "./model/task";
import { TaskScreen } from "./utils/console-utils";
import { ProgressBar } from "./logger/progressbar";
import chalk from "chalk";

const DELAY = 1000;

(async () => {
  let db: MonitorDB;
  const argv = parseArgv();
  const argvDB = {
    source: argv.parsed.source,
    amount: argv.parsed.amount,
    price: argv.parsed.price,
  };

  if (MonitorDB.validate(argvDB)) {
    db = argvDB;
  } else {
    console.log(chalk.red(`-! Not all arguments are provided, will read from the db`));
    db = await readDb() as MonitorDB;
    await askForDB(db);
  }

  if (MonitorDB.validate(db)) {
    const url = `https://voronezh.tele2.ru/api/exchange/lots?trafficType=${
      (db.source === `internet`) ? `data` : `voice`
    }&volume=${db.amount}&cost=${db.price}&offset=0&limit=20`;

    const task = new Task({ url, db });
    const screen = new TaskScreen(task);

    const doWhile = true;
    while (doWhile) {
      await task.update();

      screen.print();

      const progressBar = new ProgressBar();
      const progressMax = progressBar.progressMaxSymbols;
      const tick = DELAY / progressMax;
      progressBar.writeProgress();

      for (let i = 1; i <= progressMax + 1; i++) {
        progressBar.rewriteAndInc();
        await waitFor(tick);
      }
    }

  } else {
    throw new Error(
      `Wrong DB file`
    );
  }
})();