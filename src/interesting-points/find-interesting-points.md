# Interesting Points 検出アルゴリズム

マンデルブロ集合の描画結果（iteration buffer）から、拡大すると面白そうなポイントを自動検出する。

## 全体の流れ

### 回転対称性検出（デフォルト）

```
iterationBuffer (Uint32Array, width×height)
  ↓
1. stride=8 でdense gridスキャン (findSymmetryCandidates)
  ↓
2. 各点で回転対称性スコアを計算 (calcRotationalSymmetry)
  ↓
3. 近接クラスタリング (mergeProximityCandidates, threshold=16)
  ↓
4. スコア上位K件を返す
```

### entropy-gradient マルチスケール検出（scales指定時）

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

## スコアリング方式の選択ロジック

- `blockSize` 指定 → entropy-gradient
- `scales` 指定 → entropy-gradient + マルチスケール
- `scoring: 'entropy-gradient'` → 明示的にentropy-gradient（デフォルトscales使用）
- `scoring: 'symmetry'` または指定なし → 回転対称性

## スコア式

### 回転対称性スコア（デフォルト）

`calcRotationalSymmetry(buffer, cx, cy, width, height, maxIteration)`

1. 半径 `[4, 8, 16, 32]` でループ
2. 各半径 r で円周上に `max(16, round(2πr / 2))` 個のサンプル点を取得（2px間隔相当）
3. 各回転次数 n (2..8) について:
   - `v[k]` と `v[(k + S/n) % S]` のペアでPearson相関を計算
   - 無効ピクセル（0, maxIteration, 境界外）はスキップ
   - 有効ペアが `S/n/2` 未満ならスコア0
4. 全 n の最大Pearson相関 → その半径の `bestCorrelation`
5. 全半径の `bestCorrelation` を平均 → `symmetryScore`
6. 構造量: 全有効サンプルの標準偏差 / maxIteration → `structureAmount`
7. **最終スコア = symmetryScore × structureAmount**

flat regionは分散0でPearson相関が未定義→0になるため、自然にスコア0になる。

**なぜ必要か:** マンデルブロ集合の構造的に面白いポイントはn回回転対称（n=2: ミニブロコピー, n=3〜8: 多腕渦巻き）の中心であることが多い。iteration値の空間パターンとして回転対称性を直接測定することで、「色帯がたくさん通る場所」ではなく構造の中心を捉える。

### entropy-gradient スコア

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

### gradientMagnitude（勾配の大きさ）

`calcGradientMagnitude(buffer, x, y, width, height, maxIteration)`

- ピーク座標の周囲8方向の隣接ピクセルとのiteration差を計算
- `sqrt(Σ(center - neighbor)²)`（8方向のRMS的な値）
- 境界外・`0`・`N` の隣接ピクセルは `center` と同値として扱う（端でも安定）

## 近接クラスタリング

### mergeProximityCandidates（symmetryモード用）

スコア降順でgreedy clusteringし、各クラスタの最高スコア候補を採用。スケールブーストなし。

### mergeCandidatesAcrossScales（entropy-gradientマルチスケール用）

1. 全スケールの候補をスコア降順ソート
2. 上位から処理: 既存クラスタ中心から `proximityThreshold` 以内なら合流、なければ新クラスタ
3. クラスタ内で最高スコアの候補の座標・iterationを採用
4. `finalScore = maxScore × (1 + 0.5 × (uniqueScaleCount - 1))` を算出

## デフォルトパラメータ

| パラメータ     | デフォルト値   | 説明                                           |
| -------------- | -------------- | ---------------------------------------------- |
| `scoring`      | `'symmetry'`   | スコアリング方式                               |
| `scales`       | `[64, 32, 16]` | entropy-gradientマルチスケールのブロックサイズ |
| `topK`         | 5              | 返す最大ポイント数                             |
| `minIteration` | 10             | ピーク候補の最低iteration閾値                  |

## パフォーマンス特性

### symmetryモード（デフォルト）

- stride=8, 1920×1080 → ~32,400候補点
- 各候補: 4半径 × ~30サンプル × 7回転次数 ≈ 840サンプルアクセス
- 合計: ~27M 配列アクセス（Uint32Arrayなので高速）
- 推定: 50-200ms

### entropy-gradientモード

- 1920×1080、デフォルト3スケール → 約2000+500+130 = 約2630ブロック
- findBlockPeak: 各ブロック最大 blockSize² px走査
- calcGradientMagnitude: ピーク候補のみ。周囲8ピクセルの比較
- calcLocalEntropy: findBlockPeakと同じブロックを走査（Map使用）
- mergeCandidatesAcrossScales: topK×3 の候補に対する O(n×k) のクラスタリング

いずれもバッチ計算完了時に1回だけ実行。描画ループには影響しない。
