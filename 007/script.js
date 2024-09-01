// ======================================================================
// WebGLスクール-課題007
// ======================================================================

import { WebGLUtility } from "../lib/webgl.js";
import { Vec2 } from "../lib/math.js";
import { WebGLGeometry } from "../lib/geometry.js";

window.addEventListener(
  "DOMContentLoaded",
  async () => {
    const app = new App();
    app.init();
    await app.load();
    app.setupGeometry();
    app.setupLocation();
    app.start();
  },
  false
);

/**
 * アプリケーション管理クラス
 */
class App {
  canvas; // WebGL で描画を行う canvas 要素
  gl; // WebGLRenderingContext （WebGL コンテキスト）
  program; // WebGLProgram （プログラムオブジェクト）
  attributeLocation; // attribute 変数のロケーション
  attributeStride; // attribute 変数のストライド
  uniformLocation; // uniform 変数のロケーション
  planeGeometry; // 板ポリゴンのジオメトリ情報
  planeVBO; // 板ポリゴンの頂点バッファ
  planeIBO; // 板ポリゴンのインデックスバッファ
  startTime; // レンダリング開始時のタイムスタンプ
  isRendering; // レンダリングを行うかどうかのフラグ
  texture0; // テクスチャのインスタンス
  texture1; // テクスチャのインスタンス

  constructor() {
    // this を固定するためのバインド処理
    this.resize = this.resize.bind(this);
    this.render = this.render.bind(this);
  }

  /**
   * テクスチャのフィルタを設定する @@@
   * ※現在バインドされているアクティブなテクスチャが更新される点に注意
   * @param {number} filter - 設定する値
   */
  setTextureFilter(filter) {
    const gl = this.gl;
    // 縮小フィルタは常に指定どおり
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    // 拡大フィルタはミップマップ系は使えない
    if (filter === gl.NEAREST) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
  }

  /**
   * 初期化処理を行う
   */
  init() {
    // canvas エレメントの取得と WebGL コンテキストの初期化
    this.canvas = document.getElementById("webgl-canvas");
    this.gl = WebGLUtility.createWebGLContext(this.canvas);

    // 最初に一度リサイズ処理を行っておく
    this.resize();

    // リサイズイベントの設定
    window.addEventListener("resize", this.resize, false);

    // 深度テストは初期状態で有効
    this.gl.enable(this.gl.DEPTH_TEST);
  }

  /**
   * リサイズ処理
   */
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /**
   * 各種リソースのロードを行う
   * @return {Promise}
   */
  load() {
    return new Promise(async (resolve, reject) => {
      const gl = this.gl;
      if (gl == null) {
        // もし WebGL コンテキストがない場合はエラーとして Promise を reject する
        const error = new Error("not initialized");
        reject(error);
      } else {
        // シェーダのソースコードを読み込みシェーダとプログラムオブジェクトを生成する
        const VSSource = await WebGLUtility.loadFile("./main.vert");
        const FSSource = await WebGLUtility.loadFile("./main.frag");
        const vertexShader = WebGLUtility.createShaderObject(
          gl,
          VSSource,
          gl.VERTEX_SHADER
        );
        const fragmentShader = WebGLUtility.createShaderObject(
          gl,
          FSSource,
          gl.FRAGMENT_SHADER
        );
        this.program = WebGLUtility.createProgramObject(
          gl,
          vertexShader,
          fragmentShader
        );
        // 画像を読み込み、テクスチャを初期化する
        const image0 = await WebGLUtility.loadImage("./sample.jpg");
        const image1 = await WebGLUtility.loadImage("./sample2.jpg");
        this.texture0 = WebGLUtility.createTexture(gl, image0);
        this.texture1 = WebGLUtility.createTexture(gl, image1);

        // Promsie を解決
        resolve();
      }
    });
  }

  /**
   * 頂点属性（頂点ジオメトリ）のセットアップを行う
   */
  setupGeometry() {
    // プレーンジオメトリの情報を取得
    const size = 2.0;
    const color = [1.0, 1.0, 1.0, 1.0];
    this.planeGeometry = WebGLGeometry.plane(size, size, color);

    // VBO と IBO を生成する
    this.planeVBO = [
      WebGLUtility.createVBO(this.gl, this.planeGeometry.position),
      WebGLUtility.createVBO(this.gl, this.planeGeometry.color),
      WebGLUtility.createVBO(this.gl, this.planeGeometry.texCoord),
    ];
    this.planeIBO = WebGLUtility.createIBO(this.gl, this.planeGeometry.index);
  }

  /**
   * 頂点属性のロケーションに関するセットアップを行う
   */
  setupLocation() {
    const gl = this.gl;
    // attribute location の取得
    this.attributeLocation = [
      gl.getAttribLocation(this.program, "position"),
      gl.getAttribLocation(this.program, "color"),
      gl.getAttribLocation(this.program, "texCoord"),
    ];
    // attribute のストライド
    this.attributeStride = [3, 4, 2];
    // uniform location の取得
    this.uniformLocation = {
      mvpMatrix: gl.getUniformLocation(this.program, "mvpMatrix"),
      time: gl.getUniformLocation(this.program, "time"),
      windowSize: gl.getUniformLocation(this.program, "windowSize"),
      textureSize: gl.getUniformLocation(this.program, "textureSize"),
      textureUnit0: gl.getUniformLocation(this.program, "textureUnit0"), //テクスチャユニットの指定
      textureUnit1: gl.getUniformLocation(this.program, "textureUnit1"),
    };
  }

  /**
   * レンダリングのためのセットアップを行う
   */
  setupRendering() {
    const gl = this.gl;
    // ビューポートを設定する
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    // クリアする色と深度を設定する
    gl.clearColor(0.3, 0.3, 0.3, 1.0);
    gl.clearDepth(1.0);
    // 色と深度をクリアする
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  /**
   * 描画を開始する
   */
  start() {
    const gl = this.gl;
    // テクスチャーを複数バインドする
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texture1);
    // レンダリング開始時のタイムスタンプを取得しておく
    this.startTime = Date.now();
    // レンダリングを行っているフラグを立てておく
    this.isRendering = true;
    // レンダリングの開始
    this.render();
  }

  /**
   * 描画を停止する
   */
  stop() {
    this.isRendering = false;
  }

  /**
   * レンダリングを行う
   */
  render() {
    const gl = this.gl;

    // レンダリングのフラグの状態を見て、requestAnimationFrame を呼ぶか決める
    if (this.isRendering === true) {
      requestAnimationFrame(this.render);
    }

    const nowTime = (Date.now() - this.startTime) * 0.0005;

    // レンダリングのセットアップ
    this.setupRendering();

    // モデル座標変換行列（ここでは特になにもモデル座標変換は掛けていない）
    // const m = Mat4.identity();

    // // プロジェクション座標変換行列
    // const fovy = 45; // 視野角（度数）
    // const canvasAspect = window.innerWidth / window.innerHeight; // アスペクト比
    // const near = 0.1; // ニア・クリップ面までの距離
    // const far = 10.0; // ファー・クリップ面までの距離
    // const p = Mat4.perspective(fovy, canvasAspect, near, far);

    // // ビュー座標変換行列
    // const eye = Vec3.create(0.0, 0.0, 1.0); // カメラの位置
    // const center = Vec3.create(0.0, 0.0, 0.0); // カメラの注視点
    // const upDirection = Vec3.create(0.0, 1.0, 0.0); // カメラの天面の向き
    // const v = Mat4.lookAt(eye, center, upDirection);

    // // 行列を乗算して MVP 行列を生成する（掛ける順序に注意）
    // const vp = Mat4.multiply(p, v);
    // const mvp = Mat4.multiply(vp, m);

    // サイズを定義
    let windowSize = Vec2.create(window.innerWidth, window.innerHeight);
    let textureSize = Vec2.create(1024, 1024);

    // プログラムオブジェクトを選択し uniform 変数を更新する
    gl.useProgram(this.program);

    // ロケーションを指定して、uniform 変数の値を更新する
    // gl.uniformMatrix4fv(this.uniformLocation.mvpMatrix, false, mvp);
    gl.uniform2fv(this.uniformLocation.windowSize, windowSize); //表示したいサイズ
    gl.uniform2fv(this.uniformLocation.textureSize, textureSize); // 画像のサイズ
    gl.uniform1f(this.uniformLocation.time, nowTime);
    gl.uniform1i(this.uniformLocation.textureUnit0, 0);
    gl.uniform1i(this.uniformLocation.textureUnit1, 1);

    // VBO と IBO を設定し、描画する
    WebGLUtility.enableBuffer(
      gl,
      this.planeVBO,
      this.attributeLocation,
      this.attributeStride,
      this.planeIBO
    );
    gl.drawElements(
      gl.TRIANGLES,
      this.planeGeometry.index.length,
      gl.UNSIGNED_SHORT,
      0
    );
  }
}
