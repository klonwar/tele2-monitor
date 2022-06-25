/* global document */

import {log} from "../logger/logger";
import {MonitorDB} from "./monitor-d-b";
import parser from "argv-parser";
import chalk from "chalk";

const Fs = require(`fs`);

export const repeatIfError = async (func, times = 1, onError, onFatal) => {
  let res;
  while (times > 0) {
    try {
      res = await func();
      return res;
    } catch (e) {
      times--;
      await onError(e);
    }
  }

  onFatal();
  return undefined;
};


export const linkGetterGenerator = (origin) => (link = ``) => {
  if (origin.endsWith(`/`)) {
    if (link.startsWith(`/`)) {
      return origin + link.substring(1, link.length);
    }

    return origin + link;
  }

  if (link.startsWith(`/`)) {
    return origin + link;
  }

  return origin + `/` + link;
};

export const isLogined = async (page, timeout = 3000) => {
  try {
    const s = `header .header-navbar-login .gtm-new-navigation-lk`;
    await page.waitFor(s, {timeout});
    return true;
  } catch (e) {
    return false;
  }
};

export const read = async () => {
  const readline = require(`readline`);

  const rl = readline.createInterface(process.stdin, process.stdout);
  return new Promise((res) => {
    rl.question(`> `, function (answer) {
      res(answer);
      rl.close();
    });

  });
};

export const readExp = async (rexp) => {
  let num = `!`;
  const regexp = new RegExp(rexp);
  while (num.match(regexp) === null) {
    num = await read();
  }

  return num;
};

export const clearScreen = () => {
  const readline = require(`readline`);
  const rows = process.stdout.rows;
  for (let i = 0; i < rows; i++) {
    readline.cursorTo(process.stdout, 0, i);
    readline.clearLine(process.stdout, 0);
  }
  readline.cursorTo(process.stdout, 0, 0);
};

export const saveDb = async (db) => {
  let out;
  const dir = `./db`;

  if (!Fs.existsSync(dir)) {
    Fs.mkdirSync(dir);
  }
  out = Fs.createWriteStream(`./db/.db`, {flags: `w`});

  out.write(`PHONE:${db.phone}\n`);
  out.write(`ITERATIONS:${db.iterations}\n`);
  out.write(`DELAY:${db.delay}\n`);
  out.write(`SOURCE:${db.source}\n`);
  out.write(`AMOUNT:${db.amount}\n`);
  out.write(`PRICE:${db.price}\n`);
  if (db.headless) {
    out.write(`HEADLESS:${db.headless}\n`);
  }

};

export const rewriteDb = async (db) => {
  log(`-@ Insert information. Press enter to insert default values`);

  log(`--@ Phone WITHOUT 8`);
  db.phone = await readExp(/[0-9]{10}/);

  log(`--@ Number of active lots (default = 1)`);
  db.iterations = await readExp(/(^[0-9]{1,2}$)|(^\s*$)/);
  if (db.iterations.match(new RegExp(/^\s*$/))) {
    db.iterations = 1;
  }

  log(`--@ Delay between attempts in seconds (default = 80)`);
  db.delay = await readExp(/(^[0-9]{1,3}$)|(^\s*$)/);
  if (db.delay.match(new RegExp(/^\s*$/))) {
    db.delay = 80;
  }

  log(`--@ Minutes? [Y/N] (default = Y)`);
  db.source = await readExp(/(^[A-Za-z]$)|(^\s*$)/);
  if (db.source.match(new RegExp(/^\s*$/))) {
    db.source = `calls`;
  } else {
    db.source = (db.source === `N` || db.source === `n`) ? `internet` : `calls`;
  }

  log(`--@ Lot amount (default = ${((db.source === `calls`) ? `50` : `3`)})`);
  db.amount = await readExp(/(^[0-9]{1,3}$)|(^\s*$)/);
  if (db.amount.match(new RegExp(/^\s*$/))) {
    db.amount = (db.source === `calls`) ? 50 : 3;
  }

  let mPrice;
  let iPrice;
  // old_m_price = Math.floor((db.amount + 1) / 2);
  mPrice = db.amount - 10 - Math.floor((db.amount - 50) / 5);
  iPrice = 15 * db.amount;

  log(`--@ Price (default = ${((db.source === `calls`) ? mPrice : iPrice)})`);
  db.price = await readExp(/(^[0-9]{1,3}$)|(^\s*$)/);
  if (db.price.match(new RegExp(/^\s*$/))) {
    db.price = (db.source === `calls`) ? mPrice : iPrice;
  }

  await saveDb(db);
  log(`-@ Information saved successfully`);
};

export const readDb = async () => {
  const db = {};
  const dir = `./db`;

  if (!Fs.existsSync(dir)) {
    Fs.mkdirSync(dir);
  }

  await Fs.openSync(`./db/.db`, `a`);
  const str = await Fs.readFileSync(`./db/.db`, {encoding: `utf8`});
  const arrStr = str.split(`\n`);
  arrStr.forEach((item) => {
    const x = item.split(`:`);
    switch (x[0]) {
      case `PHONE`:
        db.phone = x[1];
        break;
      case `PASSWORD`:
        db.password = x[1];
        break;
      case `HEADLESS`:
        db.headless = (x[1] === `true`);
        break;
      case `ITERATIONS`:
        db.iterations = x[1];
        break;
      case `DELAY`:
        db.delay = x[1];
        break;
      case `SOURCE`:
        db.source = x[1];
        break;
      case `AMOUNT`:
        db.amount = x[1];
        break;
      case `PRICE`:
        db.price = x[1];
        break;
      default:
        db.trash = x[1];
        break;
    }


  });

  return db;
};

export const rand = () => {
  return Math.floor(100 + Math.random() * 50);
};

export const rand8 = () => {
  let t = Math.floor(1 + Math.random() * 10);
  if (t > 8) {
    t = 4;
  }

  return t;
};

export const wClick = async (page, s, time = -1) => {
  if (time > 0) {
    await page.waitFor(time);
  } else {
    await page.waitFor(s);
  }
  await page.click(s);
};


export const askForDB = async (db) => {
  if (!MonitorDB.validate(db)) {
    await rewriteDb(db);
  } else {
    log(`-@ Read information from DB? [Y/N] (default = Y)`);
    let res;
    if (!process.argv.includes(`-y`)) {
      res = await readExp(/(^[A-Za-z]$)|(^\s*$)/);
    } else {
      res = `Y`;
      log(`> Y`);
    }
    if (res.match(new RegExp(/^\s*$/))) {
      res = `Y`;
    }
    if (res === `N` || res === `n`) {
      await rewriteDb(db);
    }
  }
};


export const readCookies = (s = `./db/cookies.json`) => {
  return new Promise((resolve) => {
    (async () => {
      await Fs.readFile(s, (e, data) => {
        if (e || data === null) {
          resolve(null);
        } else {
          resolve(JSON.parse(data.toString()));
        }
      });
    })();
  });
};


export const askForCookies = async (cookies) => {
  if (cookies !== null) {
    log(`-@ Restore previously saved cookies? [Y/N] (default = Y)`);
    let res;
    if (!process.argv.includes(`-y`)) {
      res = await readExp(/(^[A-Za-z]$)|(^\s*$)/);
    } else {
      res = `Y`;
      log(`> Y`);
    }

    if (res.match(new RegExp(/^\s*$/))) {
      res = `Y`;
    }
    if (res === `N` || res === `n`) {
      res = `N`;
    }

    return res === `Y`;
  } else {
    return false;
  }
};

export const autoRequire = async (module) => {
  const cp = require(`child_process`);

  try {
    require.resolve(module);
  } catch (e) {
    console.log(`> Could not resolve ${module}. Installing...`);
    cp.execSync(`npm install ${module}`);
    await setImmediate(() => {
    });
    console.log(`> "${module}" has been installed`);
  }

  try {
    return require(module);
  } catch (e) {
    console.log(`Could not include "${module}". Restart the script`);
    process.exit(1);
    return false;
  }
};

export const getPuppeteerResponse = async (request) => {
  const fetch = await autoRequire(`node-fetch`);

  const response = await fetch(request.url(), {
    body: request.postData(),
    headers: request.headers(),
    method: request.method(),
  });

  const json = await response.json();

  return {
    body: JSON.stringify(json),
    headers: JSON.stringify(response.headers),
    status: response.status
  };
};

export const hideHistory = async (request) => {
  if (request.url().endsWith(`created`)) {
    const response = await getPuppeteerResponse(request);
    let body = JSON.parse(response.body);
    const history = body.data;
    body.data = [];

    for (let i = Math.max(0, history.length - 20); i < history.length; i++) {
      body.data.push(history[i]);
    }

    response.body = JSON.stringify(body);
    request.respond(response);
  } else {
    request.continue();
  }
};

export const getMetrics = (length) => ({
  screenWidth: process.stdout.columns,
  spaces: Math.floor(((process.stdout.columns - length >= 0) ? (process.stdout.columns - length) : 0) / 2)
});

export const waitFor = async (time) => {
  await new Promise((resolve) => setTimeout(resolve, time));
};

export const getCentrifyingSpaces = (length) => {
  return ` `.repeat(getMetrics(length).spaces);
};

export const parseArgv = () => {
  const rules = {
    source: {
      type: String,
      short: `t`,
      value: (type) => {
        if (!type) {
          return;
        }

        if (![`internet`, `calls`].includes(type)) {
          const consider = type.startsWith(`c`) ? `calls` : `internet`;
          console.warn(chalk.yellow(`-X Will consider "${type}" as "${consider}"`));
          return consider;
        }

        return type;
      },
    },
    amount: {
      type: Number,
      short: `a`,
    },
    price: {
      type: Number,
      short: `p`,
    },
  };
  return parser.parse(process.argv, {
    rules
  });
};
