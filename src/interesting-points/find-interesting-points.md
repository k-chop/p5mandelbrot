# Interesting Points 検出アルゴリズム

マンデルブロ集合の描画結果（iteration buffer）から、拡大すると面白そうなポイントを自動検出する。

## 全体の流れ

```
iterationBuffer (Uint32Array, width×height)
  ↓
1. グリッド分割 (blockSize×blockSize)
  ↓
2. 各ブロックからピーク候補を1つ選出 (findBlockPeak)
  ↓
3. 各候補に2つの因子からスコアを計算
  ↓
4. スコア上位K件を返す
```

## スコア式

```
score = localEntropy × gradientMagnitude
```

2つの因子はそれぞれ異なるスケールで「拡大したら複雑な構造が隠れていそうか」を測る。
どちらも iteration 値の変化のみに基づいており、maxIteration（N点）の有無に依存しない。

### localEntropy（局所的な複雑さ）

`calcLocalEntropy(buffer, bx, by, blockSize, width, height, maxIteration)`

- ブロック内の有効ピクセル（`iteration !== 0` かつ `iteration !== N`）を走査
- `ユニークなiteration値の数 / 有効ピクセル数` で正規化
- 範囲: 0（有効ピクセルなし）〜 1.0（全ピクセルが異なる値）

**なぜ必要か:** iteration値が多様＝色が多様＝視覚的に複雑な構造がある。渦巻きやフラクタル模様が集中している領域はエントロピーが高い。ブロック全体のマクロな複雑さを測る。

### gradientMagnitude（勾配の大きさ）

`calcGradientMagnitude(buffer, x, y, width, height, maxIteration)`

- ピーク座標の周囲8方向の隣接ピクセルとのiteration差を計算
- `sqrt(Σ(center - neighbor)²)`（8方向のRMS的な値）
- 境界外・`0`・`N` の隣接ピクセルは `center` と同値として扱う（端でも安定）

**なぜ必要か:** 勾配が大きい＝iteration値が急激に変化している＝拡大するとさらに複雑な構造が現れる可能性が高い。ピーク1点のミクロな変化の激しさを測る。

## ブロックピーク選出

`findBlockPeak(buffer, bx, by, blockSize, width, height, maxIteration, minIteration)`

- ブロック内で最大iteration値を持つピクセルを1つ返す
- 除外条件:
  - `iteration === N`（集合内部。拡大しても黒）
  - `iteration === 0`（未計算）
  - `iteration < minIteration`（デフォルト10。ノイズ除去）

## デフォルトパラメータ

| パラメータ     | デフォルト値 | 説明                          |
| -------------- | ------------ | ----------------------------- |
| `blockSize`    | 32           | グリッドブロックサイズ（px）  |
| `topK`         | 5            | 返す最大ポイント数            |
| `minIteration` | 10           | ピーク候補の最低iteration閾値 |

## パフォーマンス特性

- 1920×1080、blockSize=32 → 約2000ブロック
- findBlockPeak: 各ブロック最大1024px走査
- calcGradientMagnitude: ピーク候補のみ。周囲8ピクセルの比較
- calcLocalEntropy: findBlockPeakと同じブロックを走査（Set使用）
- バッチ計算完了時に1回だけ実行。描画ループには影響しない
