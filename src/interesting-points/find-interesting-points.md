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
3. 各候補に4つの因子からスコアを計算
  ↓
4. スコア上位K件を返す
```

## スコア式

```
score = boundaryProximity × (1 + minibrotScore × MINIBROT_WEIGHT) × localEntropy × gradientMagnitude
```

- `MINIBROT_WEIGHT = 5`（ミニブロット近傍へのブースト倍率）
- ミニブロットがない場合は `(1 + 0) = 1` で他の因子のみで評価される

4つの因子はそれぞれ異なる「面白さ」の側面を捉える。

### boundaryProximity（集合境界への近さ）

`calcBoundaryProximity(buffer, x, y, width, height, maxIteration, searchRadius)`

- ピーク座標から周囲 `searchRadius`px（デフォルト16）内で最も近い `iteration === N` のピクセルを探す
- チェビシェフ距離で外側に1pxずつ広げるスパイラルサーチ。見つかり次第 early return
- 見つかった場合: `1 / (1 + distance)`
- 見つからない場合: `1 / (1 + searchRadius)`（フォールバック）

**なぜ必要か:** `iteration === N` は集合の内部（黒い領域）。その境界付近は無限に複雑な構造があるため、拡大すると必ず面白い。境界から遠い点は単調な色の繰り返しになりがち。

### minibrotScore（ミニブロットの孤立度）

`calcMinibrotScore(buffer, x, y, width, height, maxIteration, searchRadius)`

- ピーク座標の周囲 `searchRadius` 内のN点の数と全ピクセル数をカウント
- N点が0個なら0（ミニブロットなし、ブーストなし）
- N点があれば `1 - (nCount / totalPixels)` を返す
- 範囲: 0〜1（N点が少ないほど1に近い）

**なぜ必要か:** ミニブロットは集合の小さな「島」で、拡大するとマンデルブロ集合の完全なコピーが現れる。N点の密度が低い（孤立した小クラスタ）ほどミニブロットである可能性が高い。一方、大きな連続境界の近くではN点の密度が高く、拡大しても似たパターンの繰り返しになりやすい。

### localEntropy（局所的な複雑さ）

`calcLocalEntropy(buffer, bx, by, blockSize, width, height, maxIteration)`

- ブロック内の有効ピクセル（`iteration !== 0` かつ `iteration !== N`）を走査
- `ユニークなiteration値の数 / 有効ピクセル数` で正規化
- 範囲: 0（有効ピクセルなし）〜 1.0（全ピクセルが異なる値）

**なぜ必要か:** iteration値が多様＝色が多様＝視覚的に複雑な構造がある。渦巻きやフラクタル模様が集中している領域はエントロピーが高い。

### gradientMagnitude（勾配の大きさ）

`calcGradientMagnitude(buffer, x, y, width, height, maxIteration)`

- ピーク座標の周囲8方向の隣接ピクセルとのiteration差を計算
- `sqrt(Σ(center - neighbor)²)`（8方向のRMS的な値）
- 境界外・`0`・`N` の隣接ピクセルは `center` と同値として扱う（端でも安定）

**なぜ必要か:** 勾配が大きい＝iteration値が急激に変化している＝集合の境界の「輪郭」に当たる。単調な領域は勾配が小さい。

## ブロックピーク選出

`findBlockPeak(buffer, bx, by, blockSize, width, height, maxIteration, minIteration)`

- ブロック内で最大iteration値を持つピクセルを1つ返す
- 除外条件:
  - `iteration === N`（集合内部。拡大しても黒）
  - `iteration === 0`（未計算）
  - `iteration < minIteration`（デフォルト10。ノイズ除去）

## デフォルトパラメータ

| パラメータ        | デフォルト値 | 説明                                         |
| ----------------- | ------------ | -------------------------------------------- |
| `blockSize`       | 32           | グリッドブロックサイズ（px）                 |
| `topK`            | 5            | 返す最大ポイント数                           |
| `minIteration`    | 10           | ピーク候補の最低iteration閾値                |
| `searchRadius`    | 16           | 境界近接性・ミニブロット検出の探索半径（px） |
| `MINIBROT_WEIGHT` | 5            | ミニブロットスコアのブースト倍率（定数）     |

## パフォーマンス特性

- 1920×1080、blockSize=32 → 約2000ブロック
- findBlockPeak: 各ブロック最大1024px走査
- calcBoundaryProximity: ピーク候補のみ。最悪ケースでsearchRadius²だが、early returnで通常は数px
- calcMinibrotScore: ピーク候補のみ。searchRadius=16で最大33×33=1089ピクセル走査
- calcLocalEntropy: findBlockPeakと同じブロックを走査（Set使用）
- バッチ計算完了時に1回だけ実行。描画ループには影響しない

## 既知の課題

- 画面全体が集合の境界付近にある場面（深いズーム時）では、boundaryProximityがどのポイントでも高くなり差がつきにくい
- minibrotScoreは密度ベースのヒューリスティクスであり、連結成分解析のような厳密なミニブロット判定ではない
