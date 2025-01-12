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
