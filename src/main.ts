import {askForDB, readDb, waitFor} from "./utils/functions";
import {MonitorDB} from "./utils/monitor-d-b";
import {Task} from "./model/task";
import {TaskScreen} from "./utils/console-utils";
import {ProgressBar} from "./logger/progressbar";

const DELAY = 1000;

(async () => {
  const db = await readDb();
  await askForDB(db);

  if (MonitorDB.validate(db)) {
    const url = `https://voronezh.tele2.ru/api/exchange/lots?trafficType=${
      (db.source === `internet`) ? `data` : `voice`
    }&volume=${db.amount}&cost=${db.price}&offset=0&limit=20`;

    const task = new Task({url, db});
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