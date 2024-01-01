import { LotsResponse } from "../utils/tele2-responses";
import fetch from "node-fetch";
import { LotItem } from "./lot";
import { MonitorDBInterface } from "../utils/monitor-d-b";
import { Analytics } from "./analytics";
import {
  askForCookies,
  isLogined,
  linkGetterGenerator,
  readCookies,
  readExp,
  wClick
} from "../account/funcs/functions";
import { openNewBrowser } from "../account/modules/refresh-browser";
import opt from "../account/config/config.json";
import { Browser, Page } from "puppeteer";
import { InternetException, LoginException } from "../account/funcs/exceptions";
import Fs from "fs";
import { log, warn } from "../logger/logger";

export class Task {
  readonly url: string;
  readonly db: MonitorDBInterface;
  readonly showAccount: boolean;

  userInfo: any = {
    calls0: 0,
    internet0: 0
  };

  private bigLotsList: Array<LotItem> = [];
  private removedLots: Array<{ lot: LotItem, index: number }> = [];
  private prevLots: Array<LotItem> = [];

  private browser: Browser;
  private page: Page;

  lots: Array<LotItem> = [];

  constructor({ url, db, showAccount }: { url: string, db: MonitorDBInterface, showAccount?: boolean }) {
    this.url = url;
    this.db = db;
    this.showAccount = showAccount;
  }

  readonly analytics = new Analytics();

  init = async (): Promise<void> => {
    if (this.showAccount) {
      await this.initAccountFetcher();
    }
  };

  update = async (): Promise<void> => {
    let resp: LotsResponse;

    this.prevLots = this.lots;
    this.analytics.resetLocal();

    this.analytics.startRecordingFetchTime();
    try {
      const fetchResp = await fetch(this.url, {
        timeout: 10000,
      });
      resp = await fetchResp.json();
    } catch (e) {
      warn(`-! Request takes > 10s`);
      return;
    }

    this.analytics.stopRecordingFetchTime();

    const newLotsList: Array<LotItem> = resp.data.map((item) => new LotItem(item));

    this.updateDifference(newLotsList);
    this.compileLists();
  };

  private initAccountFetcher = async (): Promise<void> => {
    const cookiesFromFile = await readCookies();
    const restoreCookies = await askForCookies(cookiesFromFile);

    await this.openBrowserAndGetPage();
    await this.loginIntoTele2(restoreCookies, cookiesFromFile);

    await this.initInterceptors();

    this.updateUserInfoInBackground();
    setInterval(() => {
      this.updateUserInfoInBackground();
    }, 10000);
  };

  private async initInterceptors(): Promise<void> {
    const client = await this.page.target().createCDPSession();
    await client.send(`Network.enable`);
    await client.send(`Network.setBypassServiceWorker`, { bypass: true });

    await this.page.setRequestInterception(true);
    await this.page.on(`request`, async (request) => {
      if (request.url().endsWith(`created`) && request.method() === `GET`) {
        const response = await (await fetch(request.url(), {
          method: request.method(),
          body: request.postData(),
          headers: request.headers()
        })).json();

        if (response.data) {
          this.userInfo.sold = {
            internet: 0,
            calls: 0,
          };
          this.userInfo.placed = {
            internet: 0,
            calls: 0,
          };
          this.userInfo.active = {
            calls: 0,
            internet: 0,
            list: []
          };
          this.userInfo.dBalance = 0;

          for (const item of response.data) {

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
                this.userInfo.placed.calls++;
                this.userInfo.sold.calls += (item.status === `bought`) ? 1 : 0;
                this.userInfo.active.calls += (item.status === `active`) ? 1 : 0;
              } else if (item.trafficType === `data`) {
                this.userInfo.placed.internet++;
                this.userInfo.sold.internet += (item.status === `bought`) ? 1 : 0;
                this.userInfo.active.internet += (item.status === `active`) ? 1 : 0;
              }

              if (item.status === `bought`) {
                this.userInfo.dBalance += item.cost.amount;
              }
            }
          }
          // }

          response.data = response.data.filter((item) => {
            if (item.status === `active`) {
              this.userInfo.active.list.push(item);
              return true;
            }

            const creationDate = new Date(item.creationDate);
            const nowDate = new Date();
            const diff = Math.ceil(Math.abs(nowDate.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24));

            return (diff <= 1);
          });

        }

        /*
        * Костылим, и пытаемся получить баланс
        * */

        const balanceResponse = await (await fetch(request.url().replace(`exchange/lots/created`, `balance`), {
          method: request.method(),
          body: request.postData(),
          headers: request.headers()
        })).json();

        if (balanceResponse.data) {
          this.userInfo.balance = (balanceResponse.data.value) ? balanceResponse.data.value : this.userInfo.balance;
        }

        await request.respond({
          status: 200,
          contentType: `application/json`,
          body: JSON.stringify(response),
        });
      } else if (request.url().endsWith(`rests`) && request.method() === `GET`) {
        const response = await (await fetch(request.url(), {
          method: request.method(),
          body: request.postData(),
          headers: request.headers()
        })).json();

        if (response.data) {
          // if (!this.userInfo?.rests) {
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


          for (const restsItem of item.rests) {
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

          this.userInfo.rests = {
            tariffCost: item.tariffCost.amount,
            internet: item.tariffPackages.internet,
            calls: item.tariffPackages.min,
            sellable: {
              internet: (parseFloat(item.tariffPackages.internet.replace(`,`, `.`)) - rollover.internet).toFixed(1),
              calls: item.tariffPackages.min - rollover.calls
            },
            lotUplift: this.userInfo.rests?.lotUplift || 0,
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
          body: request.postData(),
          headers: request.headers()
        })).json();

        if (response.data) {
          this.userInfo.balance = (response.data.value) ? response.data.value : this.userInfo.balance;
        }

        await request.respond({
          status: 200,
          contentType: `application/json`,
          body: JSON.stringify(response),
        });
      } else if (request.url().includes(`charges`) && request.method() === `GET`) {
        const response = await (await fetch(request.url(), {
          method: request.method(),
          body: request.postData(),
          headers: request.headers()
        })).json();

        this.userInfo.rests.lotUplift = response
          ?.data?.filter((item) => item.type === `CONTENT`)?.[0]
          ?.subGroups?.filter((item) => item.name === `Разовые операции`)?.[0]
          ?.consumingServices?.filter((item) => item.billingServiceId === 0)?.[0]
          ?.amount?.amount || 0;

        await request.respond({
          status: 200,
          contentType: `application/json`,
          body: JSON.stringify(response),
        });
      } else {
        await request.continue();
      }
    });
  }

  private loginIntoTele2 = async (restoreCookies, cookiesFromFile) => {
    let s;

    if (restoreCookies) {
      await this.page.setCookie(...cookiesFromFile);
    }

    await this.page.goto(this.getLink(), { waitUntil: `load` }).catch(() => {
      InternetException.handle();
    });

    if (!(await isLogined(this.page))) {
      await this.page.goto(this.getLink(), { waitUntil: `load` }).catch(() => {
        InternetException.handle();
      });

      log(`-@ Logging in`);
      await this.page.waitForTimeout(1000);
      await wClick(this.page, `span.login-action-short-text`);

      for (let erCount = 1; erCount <= 3; erCount++) {
        if (await isLogined(this.page)) {
          const cookies = await this.page.cookies();
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
          await wClick(this.page, s);
          await wClick(this.page, s, 500);
          await this.page.type(s, this.db.phone + ``);

          await wClick(this.page, `form.keycloak-login-form button[type="submit"]`);

          let pin;
          do {
            log(`-@ Code from SMS`);
            pin = await readExp(/[0-9]{6}/);
            s = `input[name="SMS"]`;

            const input = await this.page.$(s);
            await input.type(pin);
            await this.page.waitForTimeout(100);
          } while (await (async () => {
            try {
              await this.page.waitForSelector(`.static-error-text`, { timeout: 5000 });
              warn(`Wrong code. Repeating`);
              return true;
            } catch (e) {
              return false;
            }
          })());

          if (await isLogined(this.page)) {
            const cookies = await this.page.cookies();
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
    await isLogined(this.page);
  };

  private gotoWithPreloader = async (link) => {
    await this.page.goto(this.getLink(link), { waitUntil: `load` });
    try {
      await this.page.waitForSelector(`.preloader-icon`, { hidden: true, timeout: 30000 });
    } catch (e) {
      // warn(`"${link}": [Bad connection]. Repeating`);
    }
  };

  private updateUserInfoInBackground = async (): Promise<void> => {
    try {
      // Перейдем на страницу с лотами, чтобы перехватить запрос и получить инфу о профиле

      await this.gotoWithPreloader(`/stock-exchange/my`);

      if (!this.userInfo.calls0 && this.userInfo.sold.calls) {
        this.userInfo.calls0 = this.userInfo.sold.calls;
      }
      if (!this.userInfo.internet0 && this.userInfo.sold.internet) {
        this.userInfo.internet0 = this.userInfo.sold.internet;
      }

      // Перейдем на страницу с лотами, чтобы перехватить запрос и получить инфу о профиле
      await this.gotoWithPreloader(`/stock-exchange/my`);
      await this.gotoWithPreloader(`/lk/expenses`);

      // Сохраним куки, вдруг поменялись
      const cookies = await this.page.cookies();
      await Fs.writeFile(`./db/cookies.json`, JSON.stringify(cookies, null, 2), (e) => {
        if (e) {
          throw e;
        }
      });

    } catch (e) {
      warn(`Cannot update user info: [${e.message}]`);
    }
  };

  private openBrowserAndGetPage = async () => {
    const browser = await openNewBrowser(this.getLink(), this.db.headless);
    this.browser = browser;
    this.page = await browser.newPage();

  };

  private getLink = linkGetterGenerator(opt.origin);

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
  };

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
        removedItems.push({ lot: oldItem, index: oldIndex });
      }
    }

    this.bigLotsList = [...newLotsList];
    this.removedLots = [...removedItems];
  };
}
