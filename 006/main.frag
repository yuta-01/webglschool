precision mediump float;
uniform float time;
uniform mat4 normalMatrix; // 法線変換行列
varying vec3 vNormal;
varying vec4 vColor;
// ライトベクトル
const vec3 light = vec3(1.0, 1.0, 1.0);

void main() {
  //ライトを動かしてみる
  vec3 light = vec3(cos(time), 1.0, sin(time));

  // 法線を行列変換する
  vec3 n = (normalMatrix * vec4(vNormal, 0.0)).xyz;
  // vertから受け取った法線ベクトルの正規化
  vec3 nNormal = normalize(n);
  // ライトベクトルを正規化
  vec3 nLight = normalize(light);

  // 法線ベクトルとライトベクトルの内積を計算する
  float d = dot(nNormal, nLight);

  // 内積を色に反映
   vec4 color = vec4(vColor.rgb * d, vColor.a);
  gl_FragColor = color;
}

