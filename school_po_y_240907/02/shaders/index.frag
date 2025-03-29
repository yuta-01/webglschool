precision mediump float;

uniform float uTextureTransitionProgress;
uniform float uTextureOnScaleProgress;

uniform vec2 uMeshResolution;
uniform vec2 uTextureResolution;
uniform vec2 uTextureResolutionOn;

uniform sampler2D uTexture;
uniform sampler2D uTextureOn;

varying vec3 vPosition;
varying vec2 vUv;


// 関数を作成する

// uvのスケーリングを行う関数
// 	1.	uv: 入力のUV座標。通常、テクスチャの範囲を指定するために0.〜1.の範囲の値
//	2.	ratio: スケーリング比率を示す2Dベクトル。ratio.xとratio.yが1より大きければ拡大、小さければ縮小を意味する
//	3.	origin: スケーリングの基準となる原点。uv空間内のどの点をスケーリングの中心とするかを指定する。通常は、vec2(0.5, 0.5)のように中央を基準とする
vec2 scaleUV(vec2 uv, vec2 ratio, vec2 origin){
    uv -= origin;
    uv /= ratio;
    uv += origin;
    return uv;
}

// テクスチャの出力時にcssのbackground-size: cover; のような挙動を再現する関数
vec2 getCoveredUV(vec2 baseUv, vec2 meshResolution, vec2 texResolution, vec2 origin) {
    vec2 ratio = vec2(
    min((meshResolution.x / meshResolution.y) / (texResolution.x / texResolution.y), 1.),
    min((meshResolution.y / meshResolution.x) / (texResolution.y / texResolution.x), 1.)
    );

    vec2 coverUv = vec2(
    baseUv.x * ratio.x + (1. - ratio.x) * origin.x,
    baseUv.y * ratio.y + (1. - ratio.y) * origin.y
    );

    return coverUv;
}

// 定数（外部から数値をコントロールする場合はuniform変数にした方がいい）
const float GRADATION_WITDH = 0.1;// gradation

void main() {
    ////////////// テクスチャの設定 //////////////
    vec2 uvTexture = getCoveredUV(vUv, uMeshResolution, uTextureResolution, vec2(.5));
    vec4 cTex = texture2D(uTexture, uvTexture);

    vec2 uvTextureOn = getCoveredUV(vUv, uMeshResolution, uTextureResolutionOn, vec2(.5));
    uvTextureOn = scaleUV(uvTextureOn, vec2(1.2 - uTextureOnScaleProgress * .2), vec2(.5));
    vec4 cTexOn = texture2D(uTextureOn, uvTextureOn);


    ////////////// 1. cross fade //////////////
    float crossFade = uTextureTransitionProgress;// （本来、変数の代入は必要ないがわかりやすいように）

    // mixについて => mix(a, b, x);
    // 	1.	a: 補間の開始値（あるいは始点）
    //	2.	b: 補間の終了値（あるいは終点）
    //	3.	x: 補間係数。この値は0から1の範囲で指定し、補間の割合を決定する
    //      x = 0の場合、出力は完全にxになり、x = 1の場合、出力は完全にbになる
    //      xが0と1の間にあるとき、aとbの間の線形補間が行われる

    // crossFade で切り替え
    vec4 cMix1 =  mix(
    cTex, // 補間の開始値 マウスホバー前のテクスチャ
    cTexOn, // 補間の終了値 マウスホバー時のテクスチャ
    crossFade// 補間係数 0 ~ 1
    );


    ////////////// 2. mask  //////////////
    // maskの方向を設定
    float maskDirectionX = vUv.x;// 0. ~ 1.　を返す
    float maskDirectionY = vUv.y;// 0. ~ 1.　を返す
    float maskDirectionXY = (maskDirectionX + maskDirectionY) / 2.;// 0. ~ 1.を返す
    // maskの方向を設定
    float finalMaskDirection = maskDirectionXY;// maskDirectionX or maskDirectionY or maskDirectionXY

    ////// 2_1. edge mask //////
    // stepについて => step(edge, x);
    // 	1.	edge: しきい値。この値とxを比較して、xがedge以上であれば1を、そうでなければ0を返す
    //	2.	x: 入力値。edgeと比較される値
    float mask = step(finalMaskDirection, uTextureTransitionProgress);

    // mask で切り替え
    vec4 cMix2_1 =  mix(cTex, cTexOn, mask);

    ////// 2_2. gradation mask //////
    // smoothstepについて => smoothstep(edge0, edge1, x);
    // 	1.	edge0: 補間の開始点（範囲の下限）、xがこの値より小さい場合、smoothstepの出力は0になる
    //	2.	edge1: 補間の終了点（範囲の上限）、xがこの値より大きい場合、smoothstepの出力は1になる
    //	3.	x: 現在の入力値。この値がedge0とedge1の間にある場合、smoothstep関数は0から1の間で滑らかに補間された値を返す
    float progress = uTextureTransitionProgress * (1. + GRADATION_WITDH);
    float gradationMask = smoothstep(finalMaskDirection, finalMaskDirection + GRADATION_WITDH, progress);

    // gradation mask で切り替え
    vec4 cMix2_2 =  mix(cTex, cTexOn, gradationMask);


    ////////////// last 出力処理 //////////////
    vec4 cDist = cMix1;// cMix1 or cMix2_1 or cMix2_2

    gl_FragColor = cDist;
}