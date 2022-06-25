import { clearScreen } from "../funcs/functions";
import stringLength from "string-length";

const log = (...rest) => process.stdout.write(rest.join());

export const printAccountLine = async (rowNumber, lineNumber, rows) => {
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

  let row = rows[rowNumber];
  lineNumber -= 1;

  if (!row) {
    return -1;
  }

  if (typeof row === `string`) {
    row = [row];
  }

  if (lineNumber === -1) {
    log(borderString);
    return stringLength(borderString);
  } else if (lineNumber >= row.length) {
    return null;
  } else {
    const str = `| ` + fixLength(row[lineNumber], maxWidth) + ` |`;
    log(str);
    return stringLength(str);
  }
};

export const clearAndRewrite = async (label, userInfo, textAfterTable, progressBar) => {
  clearScreen();

  for (let item of textAfterTable) {
    log(`-@ ${item}`);
  }

  if (progressBar) {
    progressBar.writeProgress();
  }
};

