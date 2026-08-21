// Small ANSI helpers. Zero dependencies by design.

const enabled =
  process.stdout.isTTY && !process.env.NO_COLOR && !process.env.CI;

function code(open, close, s) {
  return enabled ? `\x1b[${open}m${s}\x1b[${close}m` : String(s);
}

export const bold = (s) => code(1, 22, s);
export const dim = (s) => code(2, 22, s);
export const red = (s) => code(31, 39, s);
export const green = (s) => code(32, 39, s);
export const yellow = (s) => code(33, 39, s);
export const cyan = (s) => code(36, 39, s);

export function log(...args) {
  console.log(...args);
}

export function info(...args) {
  console.log(cyan("ℹ"), ...args);
}

export function success(...args) {
  console.log(green("✔"), ...args);
}

export function warn(...args) {
  console.log(yellow("⚠"), ...args);
}

export function error(...args) {
  console.error(red("✖"), ...args);
}
