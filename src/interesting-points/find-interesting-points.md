# Interesting Points 検出アルゴリズム

マンデルブロ集合の描画結果（iteration buffer）から、拡大すると面白そうなポイントを自動検出する。

## 全体の流れ

### マルチスケール検出（デフォルト）

```
iterationBuffer (Uint32Array, width×height)
  ↓
1. 各スケール(64, 32, 16)でグリッド分割 (findCandidatesAtScale)
  ↓
2. 各ブロックからピーク候補を1つ選出 (findBlockPeak)
  ↓
3. 各候補に entropy × gradient でスコアを計算
  ↓
4. 各スケールの候補を topK×3 に絞り込み
  ↓
5. 近接クラスタリング + マルチスケールブースト (mergeCandidatesAcrossScales)
  ↓
6. スコア上位K件を返す
```

### 単一スケール検出（blockSize指定時、後方互換）

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

### 基本スコア

```
score = localEntropy × gradientMagnitude
```

2つの因子はそれぞれ異なるスケールで「拡大したら複雑な構造が隠れていそうか」を測る。
どちらも iteration 値の変化のみに基づいており、maxIteration（N点）の有無に依存しない。

### マルチスケールブースト

```
finalScore = maxScore × (1 + 0.5 × (uniqueScaleCount - 1))
```

複数スケールで検出された候補はブーストされる。3スケール全てで出現した場合、スコアが2倍になる。
これにより「拡大しても複雑さが消えにくい場所」が優先される。

### localEntropy（局所的な複雑さ）

`calcLocalEntropy(buffer, bx, by, blockSize, width, height, maxIteration)`

- ブロック内の有効ピクセル（`iteration !== 0` かつ `iteration !== N`）を走査
- 各iteration値の出現回数を集計し、Shannon entropyを計算: `H = −Σ (count_i / total) × log₂(count_i / total)`
- `H / log₂(validCount)` で正規化して 0〜1 の範囲に収める
- 有効ピクセルが1以下の場合は 0 を返す
- 範囲: 0（全ピクセル同じ値 or 有効ピクセルなし）〜 1.0（全ピクセルが異なる値）

**なぜ必要か:** ユニーク値の比率だけでは「15個が同じ値、1個だけ違う」と「8個ずつ均等に2値」が同スコアになってしまう。Shannon entropyは値の分布の偏りまで反映し、真に多様な領域を高く評価する。渦巻きやフラクタル模様が集中している領域はエントロピーが高い。

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

## マルチスケール近接クラスタリング

`mergeCandidatesAcrossScales` が行う処理:

1. 全スケールの候補をスコア降順ソート
2. 上位から処理: 既存クラスタ中心から `proximityThreshold` 以内なら合流、なければ新クラスタ
3. クラスタ内で最高スコアの候補の座標・iterationを採用
4. `finalScore = maxScore × (1 + 0.5 × (uniqueScaleCount - 1))` を算出

| 定数                   | 値                | 根拠                 |
| ---------------------- | ----------------- | -------------------- |
| proximityThreshold     | `max(scales) / 2` | 最大ブロック半径     |
| multiScaleBoost        | `0.5`             | 3スケール全出現で2倍 |
| スケールあたり候補上限 | `topK × 3`        | マージ前の計算量制御 |

## デフォルトパラメータ

| パラメータ     | デフォルト値   | 説明                                         |
| -------------- | -------------- | -------------------------------------------- |
| `scales`       | `[64, 32, 16]` | マルチスケール検出のブロックサイズ配列       |
| `blockSize`    | 32             | 単一スケール時のブロックサイズ（scales優先） |
| `topK`         | 5              | 返す最大ポイント数                           |
| `minIteration` | 10             | ピーク候補の最低iteration閾値                |

**スケール選択ロジック:**

- `scales` 指定あり → マルチスケール
- `scales` なし、`blockSize` あり → 単一スケール（後方互換）
- 両方なし → デフォルトでマルチスケール `[64, 32, 16]`

## パフォーマンス特性

- 1920×1080、デフォルト3スケール → 約2000+500+130 = 約2630ブロック
- findBlockPeak: 各ブロック最大 blockSize² px走査
- calcGradientMagnitude: ピーク候補のみ。周囲8ピクセルの比較
- calcLocalEntropy: findBlockPeakと同じブロックを走査（Map使用）
- mergeCandidatesAcrossScales: topK×3 の候補に対する O(n×k) のクラスタリング
- バッチ計算完了時に1回だけ実行。描画ループには影響しない
