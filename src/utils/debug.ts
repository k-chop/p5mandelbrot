// デバッグ時に使う関数

const watchMap = new Map<string, string>();

/**
 * デバッグ用：値に変化があったときだけログに出力する
 */
export const debugWatch = (name: string, str: string, context?: unknown) => {
  const prev = watchMap.get(name);
  if (prev !== str) {
    if (context == null) {
      console.debug(`[changed: ${name}] ${str}`);
    } else {
      console.debug(`[changed: ${name}] ${str}`, context);
    }
    // alert(`[changed: ${name}] ${str} (prev: ${prev})`);
    watchMap.set(name, str);
  }
};

const logMap = new Map<string, number>();

/**
 * デバッグ用：指定した間隔でログを出力する
 */
export const logInterval = (
  name: string,
  value: unknown,
  interval: number = 1000,
) => {
  const prev = logMap.get(name);
  const now = Date.now();

  if (prev == null || now - prev > interval) {
    console.debug(`[${name}]`, value);
    logMap.set(name, now);
  }
};

// let willStop = -1;
// export const checkpoint = () => {
//   if (willStop > 0) {
//     willStop--;
//   } else if (willStop === 0) {
//     const iter = getIterationCache();
//     debugger;
//     willStop = -1;
//   }
// };
// export const nextStop = (count: number) => {
//   willStop = count;
// };
