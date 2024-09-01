precision mediump float;

uniform float time;
uniform sampler2D textureUnit0; //テクスチャの情報を受取る
uniform sampler2D textureUnit1;
uniform vec2 windowSize;
uniform vec2 textureSize;

varying vec4 vColor;
varying vec2 vTexCoord;

void main() {
  vec2 ratio = vec2(
    min((windowSize.x / windowSize.y) / (textureSize.x / textureSize.y), 1.0),
    min((windowSize.y / windowSize.x) / (textureSize.y / textureSize.x), 1.0)
  );

  vec2 p = vec2(
    vTexCoord.x * ratio.x + (1.0 - ratio.x) * 0.5,
    vTexCoord.y * ratio.y + (1.0 - ratio.y) * 0.5
  );

  float t = smoothstep(0.0, 1.0, (sin(time) * 2.0 + p.x - p.y));
  vec4 f = mix(
    texture2D(textureUnit0, (p - 0.5) * (1.0 - t) + 0.5), 
    texture2D(textureUnit1, (p - 0.5) * t + 0.5), 
  t);
  gl_FragColor = f;


}
