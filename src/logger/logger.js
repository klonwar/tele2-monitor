const jsonfy = (s) => (typeof s === `object`) ? JSON.stringify(s) : s;

export const log = (s = ``) => {
  console.log(jsonfy(s));
};
export const warn = (s = ``) => {
  const chalk = require(`chalk`);
  console.log(chalk.yellow(`-x ${jsonfy(s)}`));
};
export const err = (s = ``) => {
  const chalk = require(`chalk`);
  console.log(chalk.red(`-X ${jsonfy(s)}`));
};
export const succ = (s = ``) => {
  const chalk = require(`chalk`);
  console.log(chalk.green(`-V ${jsonfy(s)}`));
};
export const inf = (s = ``) => {
  const chalk = require(`chalk`);
  console.log(chalk.blue(jsonfy(s)));
};
export const fillSucc = (s = ``) => {
  const chalk = require(`chalk`);
  console.log(chalk.bgGreen.hex(`#000000`)(`-V ${jsonfy(s)} `));
};
