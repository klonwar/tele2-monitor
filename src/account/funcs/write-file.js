const writeFile = async (pathname, content) => {
  const fs = require(`fs`);
  const path = require(`path`);

  const dirPathname = path.dirname(pathname);

  if (!fs.existsSync(dirPathname)) {
    fs.mkdir(dirPathname, {recursive: true}, (err) => {
      console.error(err);
    });
  }

  const opened = fs.createWriteStream(pathname, {flags: `w`});

  opened.write(content);

  opened.close();

  return true;
};

export default writeFile;
