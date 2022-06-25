import Fs from "fs";
import {BaseException, InternetException, LoginException} from "./funcs/exceptions";
import {
  askForCookies,
  askForDB,
  autoRequire,
  getCentrifyingSpaces,
  isLogined,
  linkGetterGenerator,
  readCookies,
  readDb,
  readExp,
  wClick
} from "./funcs/functions";
import {err, log, warn} from "./logger/logger";
import {clearAndRewrite} from "./logger/bot-screen";
import {ProgressBar} from "./logger/progressbar";
import {openNewBrowser} from "./modules/refresh-browser";
import opt from "./config/config.json";

(async () => {
    await autoRequire(`puppeteer`);
    await autoRequire(`string-length`);
    await autoRequire(`puppeteer-extra`);
    await autoRequire(`chalk`);
    await autoRequire(`node-fetch`);
    await autoRequire(`readline`);
    await autoRequire(`puppeteer-extra-plugin-stealth`);

    const chalk = require(`chalk`);
    const fetch = require(`node-fetch`);
    const readline = require(`readline`);

    // Настройки программы

    const printLabel = () => {
      for (let item of opt.label) {
        log(getCentrifyingSpaces(item.length) + item);
      }
    };

    const getLink = linkGetterGenerator(opt.origin);

    let s;

    let userInfo = {
      calls0: 0,
      internet0: 0
    };

    try {
      printLabel();
      log();

      // Загрузим сохраненную информацию

      const db = await readDb();
      await askForDB(db);

      const cookiesFromFile = await readCookies();
      const restoreCookies = await askForCookies(cookiesFromFile);

      // Запускаем и настраиваем браузер

      const openBrowserAndGetPage = async () => {
        const browser = await openNewBrowser(getLink(), db.headless);
        let page = await browser.newPage();
        return {browser, page};
      };
      const {page} = await openBrowserAndGetPage();

      // Логинимся

      const loginIntoTele2 = async () => {
        if (restoreCookies) {
          await page.setCookie(...cookiesFromFile);
        }

        await page.goto(getLink(), {waitUntil: `load`}).catch(() => {
          InternetException.handle();
        });

        if (!(await isLogined(page))) {
          await page.goto(getLink(), {waitUntil: `load`}).catch(() => {
            InternetException.handle();
          });

          log(`-@ Logging in`);
          await wClick(page, `span.login-action-short-text`);

          for (let erCount = 1; erCount <= 3; erCount++) {
            if (await isLogined(page)) {
              const cookies = await page.cookies();
              await Fs.writeFile(`./db/cookies.json`, JSON.stringify(cookies, null, 2), (e) => {
                if (e) {
                  throw e;
                }

                log(`-@ Cookies saved successfully`);
              });

              break;
            }

            try {
              s = `form.keycloak-login-form input[type="tel"]`;
              await wClick(page, s);
              await wClick(page, s, 500);
              await page.type(s, db.phone + ``);

              await wClick(page, `form.keycloak-login-form button[type="submit"]`);

              let pin;
              do {
                log(`-@ Code from SMS`);
                pin = await readExp(/[0-9]{6}/);
                s = `input[name="SMS"]`;

                const input = await page.$(s);
                await input.type(pin);
                await page.waitForTimeout(100);
              } while (await (async () => {
                try {
                  await page.waitForSelector(`.static-error-text`, {timeout: 5000});
                  warn(`Wrong code. Repeating`);
                  return true;
                } catch (e) {
                  return false;
                }
              })());

              if (await isLogined(page)) {
                const cookies = await page.cookies();
                await Fs.writeFile(`./db/cookies.json`, JSON.stringify(cookies, null, 2), (e) => {
                  if (e) {
                    throw e;
                  }

                  log(`-@ Cookies saved successfully`);
                });

                break;
              }

              warn(`Unknown trouble. Repeating`);
            } catch (e) {
              warn(`LOGIN: [${e.message}]. Repeating`);
            }

            if (erCount === 3) {
              LoginException.handle();
            }
          }
        }
        await isLogined(page);
      };
      await loginIntoTele2();

      // Подготовим красивую консоль

      const getBalanceConsoleText = () => `Bought: ${chalk.rgb(0, 0, 0).bgGreen(` ${
         (
          parseInt(userInfo.sold.calls, 10) + parseInt(userInfo.sold.internet, 10)
          - parseInt(userInfo.calls0, 10) - parseInt(userInfo.internet0, 10)
        )
      } `)}`;
      const getLotsList = () => `Active: ${userInfo?.active?.list?.map((item) => `[${item.volume.value} ${item.volume.uom}]`).join(` `)}`;
      const getWaitingLines = () => [`Waiting for ${db.delay} sec.`, getBalanceConsoleText(), getLotsList()];
      const getRepeatingLines = () => [`Repeating.`, getBalanceConsoleText(), getLotsList()];

      const clearAndRewriteFromInfo = (lines, progressBar) => {
        clearAndRewrite(opt.label, userInfo, lines, progressBar);
      };

      // Теле 2 хреново сделали историю лотов, приходится фиксить мне

      await page.setRequestInterception(true);
      await page.on(`request`, async (request) => {
        if (request.url().endsWith(`created`) && request.method() === `GET`) {
          const response = await (await fetch(request.url(), {
            method: request.method(),
            credentials: `include`,
            body: request.postData(),
            headers: request.headers()
          })).json();

          if (response.data) {
            userInfo.sold = {
              internet: 0,
              calls: 0,
            };
            userInfo.placed = {
              internet: 0,
              calls: 0,
            };
            userInfo.active = {
              calls: 0,
              internet: 0,
              list: []
            };
            userInfo.dBalance = 0;

            for (let item of response.data) {

              /**
               * @param item {object}
               * @param item.expirationDate {string}
               * @param item.trafficType {string}
               * @param item.cost {object}
               * */

              const expirationDate = new Date(item.expirationDate);
              const nowDate = new Date();
              if (nowDate <= expirationDate) {
                if (item.trafficType === `voice`) {
                  userInfo.placed.calls++;
                  userInfo.sold.calls += (item.status === `bought`) ? 1 : 0;
                  userInfo.active.calls += (item.status === `active`) ? 1 : 0;
                } else if (item.trafficType === `data`) {
                  userInfo.placed.internet++;
                  userInfo.sold.internet += (item.status === `bought`) ? 1 : 0;
                  userInfo.active.internet += (item.status === `active`) ? 1 : 0;
                }

                if (item.status === `bought`) {
                  userInfo.dBalance += item.cost.amount;
                }
              }
            }
            // }

            response.data = response.data.filter((item) => {
              if (item.status === `active`) {
                userInfo.active.list.push(item);
                return true;
              }

              const creationDate = new Date(item.creationDate);
              const nowDate = new Date();
              const diff = Math.ceil(Math.abs(nowDate - creationDate) / (1000 * 60 * 60 * 24));

              return (diff <= 1);
            });

          }

          /*
          * Костылим, и пытаемся получить баланс
          * */

          const balanceResponse = await (await fetch(request.url().replace(`exchange/lots/created`, `balance`), {
            method: request.method(),
            credentials: `include`,
            body: request.postData(),
            headers: request.headers()
          })).json();

          if (balanceResponse.data) {
            userInfo.balance = (balanceResponse.data.value) ? balanceResponse.data.value : userInfo.balance;
          }

          await request.respond({
            status: 200,
            contentType: `application/json`,
            body: JSON.stringify(response),
          });
        } else if (request.url().endsWith(`rests`) && request.method() === `GET`) {
          const response = await (await fetch(request.url(), {
            method: request.method(),
            credentials: `include`,
            body: request.postData(),
            headers: request.headers()
          })).json();

          if (response.data) {
            // if (!userInfo?.rests) {
            const item = response.data;

            /**
             * @param item {object}
             * @param item.tariffCost {object}
             * @param item.tariffCost.amount {string}
             * @param item.tariffPackages {object}
             * @param item.tariffPackages.internet {string}
             * @param item.tariffPackages.min {string}
             * @param restsItem {object}
             * @param restsItem.rollover {boolean}
             * @param restsItem.giftPackage {boolean}
             * @param restsItem.remain {number}
             * @param restsItem.uom {string}
             * */


            const rollover = {
              internet: 0,
              calls: 0
            };


            for (let restsItem of item.rests) {
              if (restsItem.rollover || restsItem.giftPackage) {
                switch (restsItem.uom) {
                  case `mb`:
                    rollover.internet += restsItem.remain / 1024;
                    break;
                  case `min`:
                    rollover.calls += restsItem.remain;
                    break;
                }
              }
            }

            userInfo.rests = {
              tariffCost: item.tariffCost.amount,
              internet: item.tariffPackages.internet,
              calls: item.tariffPackages.min,
              sellable: {
                internet: (parseFloat(item.tariffPackages.internet.replace(`,`, `.`)) - rollover.internet).toFixed(1),
                calls: item.tariffPackages.min - rollover.calls
              }
            };
            // }
          }

          await request.respond({
            status: 200,
            contentType: `application/json`,
            body: JSON.stringify(response),
          });
        } else if (request.url().endsWith(`balance`) && request.method() === `GET`) {
          const response = await (await fetch(request.url(), {
            method: request.method(),
            credentials: `include`,
            body: request.postData(),
            headers: request.headers()
          })).json();

          if (response.data) {
            userInfo.balance = (response.data.value) ? response.data.value : userInfo.balance;
          }

          await request.respond({
            status: 200,
            contentType: `application/json`,
            body: JSON.stringify(response),
          });
        } else {
          await request.continue();
        }
      });

      // Цикл удаление - заполнение

      const gotoWithPreloader = async (link) => {
        await page.goto(getLink(link), {waitUntil: `load`});
        try {
          await page.waitForSelector(`.preloader-icon`, {hidden: true, timeout: 30000});
        } catch (e) {
          warn(`"${link}": [Bad connection]. Repeating`);
        }
      };

      let doWhile = true;
      while (doWhile) {
        try {
          // Перейдем на страницу с лотами, чтобы перехватить запрос и получить инфу о профиле

          await gotoWithPreloader(`/stock-exchange/my`);

          if (!userInfo.calls0 && userInfo.sold.calls) {
            userInfo.calls0 = userInfo.sold.calls;
          }
          if (!userInfo.internet0 && userInfo.sold.internet) {
            userInfo.internet0 = userInfo.sold.internet;
          }

          await clearAndRewriteFromInfo(getRepeatingLines());

          // Подготовимся к ожиданию. Разделим интервал ожидания на некоторое количество промежутков

          // Перейдем на страницу с лотами, чтобы перехватить запрос и получить инфу о профиле
          await gotoWithPreloader(`/stock-exchange/my`);

          const progressBar = new ProgressBar();
          const progressMax = progressBar.progressMaxSymbols;
          const tick = db.delay * 1000 / progressMax;

          await clearAndRewriteFromInfo(getWaitingLines(), progressBar);

          // В течение каждого промежутка будем перерисовывать прогрессбар
          for (let i = 1; i <= progressMax; i++) {
            progressBar.rewriteAndInc();
            await page.waitForTimeout(tick);
          }

          // Магическими строчками что-то очистим
          readline.cursorTo(process.stdout, 0);
          readline.clearLine(process.stdout, 0);

          // Покажем, что бот не завис
          await clearAndRewriteFromInfo(getRepeatingLines());

          // Сохраним куки, вдруг поменялись
          const cookies = await page.cookies();
          await Fs.writeFile(`./db/cookies.json`, JSON.stringify(cookies, null, 2), (e) => {
            if (e) {
              throw e;
            }
          });

        } catch (e) {
          if (e.message.includes(`Navigation timeout`)) {
            warn(`ITERATION_ERROR: [${e.message}]. Repeating`);
          } else {
            throw e;
          }
        }
      }
    } catch (e) {
      if (e instanceof BaseException) {
        err(`[BaseException] ${e.message}`);
      } else {
        err(e.message);
      }
    }
  }
)();
