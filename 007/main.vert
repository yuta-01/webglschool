attribute vec3 position;
attribute vec4 color;
attribute vec2 texCoord;
uniform mat4 mvpMatrix;
varying vec4 vColor;
varying vec2 vTexCoord;

void main() {
  
  // 色情報とテクスチャ座標をvarying変数に渡す
  vColor = color;
  vTexCoord = texCoord;

  gl_Position = vec4(position, 1.0);

  // MVP 行列と頂点座標を乗算してから出力する @@@
  // gl_Position = mvpMatrix * vec4(position, 1.0);
}


