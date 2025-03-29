precision mediump float;

uniform vec2 uMeshResolution;
uniform vec2 uTextureResolution;
uniform sampler2D uTexture;

varying vec3 vPosition;
varying vec2 vUv;


// テクスチャの出力時にcssのbackground-size: cover; のような挙動を再現する関数
// uvをそのまま使わず、meshとtextureの解像度を比較して縦横どちらを余らせればmesh内にフィットするようになるかを計算し、その結果をuvに反映させます。
// 	1.	baseUv: ベースのUV座標。元のUV座標を指し、通常はテクスチャの全範囲を指す(0.～1.の範囲)の値
//	2.	meshResolution: メッシュの解像度（幅と高さ）。これはメッシュの縦横比を計算するために使う
//	3.	texResolution: テクスチャの解像度（幅と高さ）。これはテクスチャの縦横比を計算するために使う
//	4.	origin: スケーリング後のテクスチャの開始位置（オリジン）。この座標はUV空間で指定される（例えばvec2(0.5, 0.5)はテクスチャの中心を指す）。基本はvec2(0.5)を指定する
vec2 getCoveredUV(vec2 baseUv, vec2 meshResolution, vec2 texResolution, vec2 origin) {

    // ratioはメッシュとテクスチャのアスペクト比を元に計算された値
    // ratio.xとratio.yは、それぞれの軸（x, y）でのテクスチャスケーリングの比率を示す
    // (meshResolution.x / meshResolution.y) / (texResolution.x / texResolution.y)は、
    // メッシュのアスペクト比をテクスチャのアスペクト比で割ったもの。これにより、どの軸でスケーリングを行うべきかが決まる
    // min関数を使用するのは、テクスチャがメッシュの範囲を超えてしまうことを防ぎ、常に1以下になるようにするため
    vec2 ratio = vec2(
    min((meshResolution.x / meshResolution.y) / (texResolution.x / texResolution.y), 1.),
    min((meshResolution.y / meshResolution.x) / (texResolution.y / texResolution.x), 1.)
    );

    // coverUvはテクスチャがメッシュ全体をカバーするために補正されたUV座標
    //　baseUv.x * ratio.xとbaseUv.y * ratio.yで、テクスチャを適切にスケーリングする
    //　(1. - ratio.x) * origin.xと(1. - ratio.y) * origin.yで、スケーリング後のテクスチャのオリジンを設定する
    // これにより、テクスチャがどの位置から始まるかを調整できる
    vec2 coverUv = vec2(
    baseUv.x * ratio.x + (1. - ratio.x) * origin.x,
    baseUv.y * ratio.y + (1. - ratio.y) * origin.y
    );

    return coverUv;
}

void main() {
    vec2 uvTexture = getCoveredUV(vUv, uMeshResolution, uTextureResolution, vec2(.5));

    // テクスチャの色を取得
    vec4 cTex = texture2D(uTexture, uvTexture);

    // テクスチャの色を出力
    vec4 cDist = cTex;

    gl_FragColor = cDist;
}