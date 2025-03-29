attribute vec3 position;
attribute vec2 uv;

uniform float uScrollDiff;

uniform float uCureStrength;
uniform float uCurveMax;
uniform float uCurveMin;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;

varying vec2 vUv;

void main() {

    //　uvの値をfragmentに渡す
    vUv = uv;

    vec3 pos = position;

    // スクロールに基づいてカーブの強さを計算する
    // uCureStrengthはカーブの強さを決める値
    // uCurveMin~からuCurveMaxの範囲に制限する
    float curveStrength = clamp( uScrollDiff * uCureStrength, uCurveMin, uCurveMax );

    // 頂点のy座標を、カーブ強度に基づいて調整
    // geometryのオリジナルのサイズをx1,y1にした場合は、postion.xの値は-.5~.5の範囲になる
    // -a ~ aの範囲のcosを取ると、曲線的に-1~1の範囲の値が返るので、x上の位置によって曲線の強さが変わる
    float curve = cos(position.x) * curveStrength;

    // カーブを適用
    pos.y += curve;
    // カーブで足し込んだ分を元の位置から引く
    pos.y -= curveStrength;

    // three.jsではprojectionMatrixとmodelViewMatrixは別々
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
}