export const openNewBrowser = async (origin, headless = false) => {
  const puppeteer = require(`puppeteer-extra`);
  const stealthPlugin = require(`puppeteer-extra-plugin-stealth`);
  puppeteer.use(stealthPlugin());

  const browser = await puppeteer.launch({headless, args: [`--start-maximized`], defaultViewport: null});
  const context = browser.defaultBrowserContext();
  await context.overridePermissions(origin, []);

  return browser;
};

export const openPageInNewBrowserWithCookies = (cookies) => {

};
