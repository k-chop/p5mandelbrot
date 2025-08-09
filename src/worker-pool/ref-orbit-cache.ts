import { MandelbrotParams, RefOrbitCache } from "@/types";

let latestRefOrbitCache: RefOrbitCache | null = null;

export const setRefOrbitCache = (cache: RefOrbitCache) => {
  latestRefOrbitCache = cache;
};

export const getRefOrbitCache = () => latestRefOrbitCache;

export const getRefOrbitCacheIfAvailable = (params: MandelbrotParams) => {
  if (params.mode === "normal") {
    return null;
  }

  if (latestRefOrbitCache == null) {
    return null;
  }

  // maxIterationが違う場合は使わせない
  if (latestRefOrbitCache.N !== params.N) {
    return null;
  }

  if (latestRefOrbitCache.x.eq(params.x) && latestRefOrbitCache.y.eq(params.y)) {
    // 地点が同じでより深い場所でのキャッシュは間違いなく使える
    if (latestRefOrbitCache.r.lt(params.r)) {
      return latestRefOrbitCache;
    }
    // TODO: それより深い箇所でも使えるはず...
  }

  if (latestRefOrbitCache.r.eq(params.r)) {
    // 同一拡大率の2画面分内での移動では使えることにしておく
    if (
      latestRefOrbitCache.x.minus(params.x).abs().lte(params.r.times(4)) &&
      latestRefOrbitCache.y.minus(params.y).abs().lte(params.r.times(4))
    ) {
      return latestRefOrbitCache;
    }
  }

  return null;
};
