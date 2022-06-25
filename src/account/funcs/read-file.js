const readFile = async (pathname, handler = (str) => str) => {
  const fs = require(`fs`);
  const path = require(`path`);

  const dirPathname = path.dirname(pathname);

  if (!fs.existsSync(dirPathname)) {
    fs.mkdir(dirPathname, {recursive: true}, (err) => {
      console.error(err);
    });
  }

  const opened = await fs.openSync(pathname, `r`);
  const str = await fs.readFileSync(pathname, {encoding: `utf8`});
  const res = await handler(str);

  fs.closeSync(opened);

  return res || undefined;
};

export default readFile;
