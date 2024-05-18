// ======================================================================
// WebGLスクール-課題001
// ======================================================================

import * as THREE from "../lib/three.module.js";
import { OrbitControls } from "../lib/OrbitControls.js";

window.addEventListener(
  "DOMContentLoaded",
  () => {
    const wrapper = document.querySelector("#webgl");
    const app = new ThreeApp(wrapper);
    app.render();
  },
  false
);

class ThreeApp {
  /**
   * カメラ定義のための定数
   */
  static CAMERA_PARAM = {
    // fovy は Field of View Y のことで、縦方向の視野角を意味する
    fovy: 60,
    // 描画する空間のアスペクト比（縦横比）
    aspect: window.innerWidth / window.innerHeight,
    // 描画する空間のニアクリップ面（最近面）
    near: 0.1,
    // 描画する空間のファークリップ面（最遠面）
    far: 80.0,
    // カメラの座標
    position: new THREE.Vector3(8.0, 10.0, 12.0),
    // カメラの注視点
    lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
  };
  /**
   * レンダラー定義のための定数
   */
  static RENDERER_PARAM = {
    clearColor: 0x000000, // 画面をクリアする色
    width: window.innerWidth, // レンダラーに設定する幅
    height: window.innerHeight, // レンダラーに設定する高さ
  };
  /**
   * 点光源定義のための定数
   */
  static SPOT_LIGHT_PARAM = {
    color: 0xffffff,
    intensity: 70.0,
    distance: 27,
    angle: 0.3,
    penumbra: 0.3,
    decay: 1,
    position: new THREE.Vector3(12.0, 20.0, 5.0),
  };
  /**
   * アンビエントライト定義のための定数
   */
  static AMBIENT_LIGHT_PARAM = {
    color: 0xffffff, // 光の色
    intensity: 0.2, // 光の強度
  };
  /**
   * マテリアル定義のための定数
   */
  static MATERIAL_PARAM = {
    color: 0xffffff, // マテリアルの基本色
  };

  renderer; // レンダラ
  scene; // シーン
  camera; // カメラ
  spotLight; // 点光源
  ambientLight; // 環境光（アンビエントライト）
  material; // マテリアル
  torusArray; // トーラスメッシュの配列
  controls; // オービットコントロール
  axesHelper; // 軸ヘルパー
  spotLightHelper; // スポットライト(点光源)ヘルパー
  boxSize = 1; // ボックスのサイズ
  blockHight = 3; // ブロックの稼働範囲

  /**
   * コンストラクタ
   * @constructor
   * @param {HTMLElement} wrapper - canvas 要素を append する親要素
   */
  constructor(wrapper) {
    // レンダラー
    const color = new THREE.Color(ThreeApp.RENDERER_PARAM.clearColor);
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setClearColor(color);
    this.renderer.setSize(
      ThreeApp.RENDERER_PARAM.width,
      ThreeApp.RENDERER_PARAM.height
    );
    wrapper.appendChild(this.renderer.domElement);

    // シーン
    this.scene = new THREE.Scene();

    // カメラ
    this.camera = new THREE.PerspectiveCamera(
      ThreeApp.CAMERA_PARAM.fovy,
      ThreeApp.CAMERA_PARAM.aspect,
      ThreeApp.CAMERA_PARAM.near,
      ThreeApp.CAMERA_PARAM.far
    );
    this.camera.position.copy(ThreeApp.CAMERA_PARAM.position);
    this.camera.lookAt(ThreeApp.CAMERA_PARAM.lookAt);

    // スポットライト
    this.spotLight = new THREE.SpotLight(
      ThreeApp.SPOT_LIGHT_PARAM.color,
      ThreeApp.SPOT_LIGHT_PARAM.intensity,
      ThreeApp.SPOT_LIGHT_PARAM.distance,
      ThreeApp.SPOT_LIGHT_PARAM.angle,
      ThreeApp.SPOT_LIGHT_PARAM.penumbra,
      ThreeApp.SPOT_LIGHT_PARAM.decay
    );
    this.spotLight.position.copy(ThreeApp.SPOT_LIGHT_PARAM.position);
    this.scene.add(this.spotLight);

    // アンビエントライト（環境光）
    this.ambientLight = new THREE.AmbientLight(
      ThreeApp.AMBIENT_LIGHT_PARAM.color,
      ThreeApp.AMBIENT_LIGHT_PARAM.intensity
    );
    this.scene.add(this.ambientLight);

    // マテリアル
    this.material = new THREE.MeshToonMaterial(ThreeApp.MATERIAL_PARAM);

    // 共通のジオメトリ、マテリアルから、複数のメッシュインスタンスを作成する
    const torusCount = 10;
    this.BoxGeometry = new THREE.BoxGeometry(this.boxSize);

    this.torusArray = [];
    for (let i = 0; i < torusCount; ++i) {
      for (let j = 0; j < torusCount; ++j) {
        // トーラスメッシュのインスタンスを生成
        const torus = new THREE.Mesh(this.BoxGeometry, this.material);
        torus.position.x =
          (i - torusCount / 2) * this.boxSize + this.boxSize / 2;
        torus.position.z =
          (j - torusCount / 2) * this.boxSize + this.boxSize / 2;
        //Y軸はパーリンノイズ
        torus.position.y = perlin.get(i * 0.15, j * 0.15) * this.blockHight;
        // シーンに追加する
        this.scene.add(torus);
        // 配列に入れておく
        this.torusArray.push(torus);
      }
    }

    // // 軸ヘルパー
    // const axesBarLength = 5.0;
    // this.axesHelper = new THREE.AxesHelper(axesBarLength);
    // this.scene.add(this.axesHelper);

    // // スポットライトヘルパー
    // this.spotLightHelper = new THREE.SpotLightHelper(this.spotLight);
    // this.scene.add(this.spotLightHelper);

    // コントロール
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // this のバインド
    this.render = this.render.bind(this);

    // ウィンドウのリサイズを検出できるようにする
    window.addEventListener(
      "resize",
      () => {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
      },
      false
    );
  }

  motionUpdate() {
    this.torusArray.forEach((torus) => {
      //初回のY軸向きを正方向に設定
      if (torus.direction === undefined) {
        torus.direction = 1;
      }
      torus.position.y += 0.04 * torus.direction;
      // Y軸の向きを変える
      if (
        torus.position.y >= this.blockHight ||
        torus.position.y <= -this.blockHight
      ) {
        torus.direction *= -1;

        // リセット
        if (torus.position.y >= this.blockHight) {
          torus.position.y = this.blockHight;
        }
      }
    });
  }

  spotLightUpdate() {
    // スポットライトの色を時間経過で変化させる
    this.spotLight.color.r = (Math.cos(Date.now() * 0.001) / 2 + 0.5) / 2;
    this.spotLight.color.b = Math.sin(Date.now() * 0.001) / 2 + 0.5;
  }

  /**
   * 描画処理
   */
  render() {
    // 恒常ループの設定
    requestAnimationFrame(this.render);

    this.motionUpdate();
    this.spotLightUpdate();

    // コントロールを更新
    this.controls.update();

    // レンダラーで描画
    this.renderer.render(this.scene, this.camera);
  }
}
