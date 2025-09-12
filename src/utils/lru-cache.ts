/**
 * Copilotが生成したLRUCache class
 *
 * getのたびに消してsetし直すのか・・・
 */
export class LRUCache<K, V> {
  private map = new Map<K, V>();
  constructor(private readonly maxEntries: number) {}

  get(key: K): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    // 最近使ったものとして末尾に移動
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.maxEntries) {
      // 先頭(最も古い)を削除
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
  }

  clear(): void {
    this.map.clear();
  }
}
