<h1 align="center">
  p5mandelbrot
</h1>

<h2 align="center">
Web-based Interactive Mandelbrot Set Viewer by p5.js
</h2>

<p align="center">
  <a href="/README.md">English</a>・
  <a href="/README-ja.md">日本語</a>
</p>

## 試す

👉 https://p5mandelbrot.pages.dev

## これは何？

ブラウザで動く、比較的高速で深いところまで見れるマンデルブロ集合ビューアです

## 機能

- Web Workerによる並列描画
- [摂動法による計算](https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set#Perturbation_theory_and_series_approximation)で`r: 1e-300`の深さまで描画可能
  - double(f64)では`r: 1e-14`が限界
- 気になった場所を保存できるリスト (localStorageに保存)
- 現在地点の共有URLの出力
- png画像出力
- パレットの簡易な編集機能 (長さとオフセットのみ)
- パレットのオフセットアニメーション

## 画像

![Image](images/image-ui.png)

### 画像をクリックするとアプリ内で同じ位置を開きます

<a href="https://p5mandelbrot.pages.dev/?x=-1.408537418404429933891979284359521316094543408325989730656147003173828125&y=0.136038566617522636749464336108637068090132515862933360040187835693359375&r=1.734723476e-12&N=5000&mode=normal"><img src="images/image-01.png" style="width: 30%" /></a>
<a href="https://p5mandelbrot.pages.dev/?x=-1.7559339846757610520112821074311119999581199155444780855307285766891106284048365406071425999838816544967887239181436598300933837890625&y=0.0125420521990597271099630814102646881890357249440922065205266505268413123742156160406088297276871329279267229139804840087890625&r=2.7284841053187847137451171875e-104&N=30000&mode=perturbation"><img src="images/image-02.png" style="width: 30%" /></a>
<a href="https://p5mandelbrot.pages.dev/?x=-1.251843459600960704323409470494702510826289653778076171875&y=0.019463266482732336442220467031466234266757965087890625&r=1.6e-17&N=30000&mode=perturbation"><img src="images/image-03.png" style="width: 30%" /></a>
<a href="https://p5mandelbrot.pages.dev/?x=-1.628862884979677636095426449959859010842630371832025956260625433903197532513022790394177640723727041808972443346150109097014368877151730362996551339014455132166441761137760639778197842397723624417672891906866059458750971904&y=0.001502065389380933389120025595611444917053151899160138645056523772189121430288877889320457274596161102973726449569385093906231155533425802369952240475756150306868105118194095501857879511907077405637510153197543170567569408&r=2.9014219670751072339297340078956627449111563682086819976447985485406258855936e-144&N=50000&mode=perturbation"><img src="images/image-04.png" style="width: 30%" /></a>
<a href="https://p5mandelbrot.pages.dev/?x=-1.861365555952135552586660013379369047470390796661376953125&y=0.000028265573582910495980496665579266846179962158203125&r=4.365574568510055891238152980804443359375e-26&N=30000&mode=perturbation"><img src="images/image-05.png" style="width: 30%" /></a>
<a href="https://p5mandelbrot.pages.dev/?x=-1.4737005779713358460189585187591009718930686375&y=0.002106996309056143098197297745830459740712861328125&r=8.599633919999999140036608e-34&N=10000&mode=perturbation"><img src="images/image-06.png" style="width: 30%" /></a>
<a href="https://p5mandelbrot.pages.dev/?x=-1.253623671350592885069962059583729171138925214522570651314506952205190496561029232421038637190103358312063778146112&y=0.384433130460394032965584386020135394015721485925260253579596937774361812162708655348198123304566763320453406760192&r=1.422222222222221966222222222222235875555555555555328e-78&N=20000&mode=perturbation"><img src="images/image-07.png" style="width: 30%" /></a>
<a href="https://p5mandelbrot.pages.dev/?x=-0.154651046065681195954069941801887201628711016770178879409663862799280825481728359145282185228162588570422562476538480274292563032960742199245042782604021968599916142953125&y=1.03100188829820970323326467188711829495132557266331701985253329251213479775239159430498134546903588137283684308536662011649305216369937916843074130608298500223630127600068918472926015625&r=5.3204107681274320423270480957110502838802026324219011370879898137240923369698515678052837041596125229354571714470966238022953777435430290328156862194211775396373427173601757743581527073984375e-9&N=10000&mode=normal"><img src="images/image-08.png" style="width: 30%" /></a>
<a href="https://p5mandelbrot.pages.dev/?x=0.43867716701945882602883664862501598909023888524432039618467429667318497624865659405032524270010214699394553651131508387532212999456591199208978687957125014042398155699119444136018932331221337685378802970556178547128893299379628775830714099109172821044921875&y=0.3573437772356753619126484864541585787148755277893692806219767292158831659783866755646463856621056415233043515572311943751280676245714383999614164483550085107467604247216921322126659502138891290826712655491362559388727657519245679668454547226428985595703125&r=3.3554432e-41&N=40000&mode=perturbation"><img src="images/image-09.png" style="width: 30%" /></a>