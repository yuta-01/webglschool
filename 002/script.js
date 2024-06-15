// ======================================================================
// WebGLスクール-課題002
// ======================================================================

import * as THREE from "../lib/three.module.js";
import { OrbitControls } from "../lib/OrbitControls.js";
// ポストプロセス用のファイル群を追加 @@@
import { EffectComposer } from "../lib/EffectComposer.js";
import { RenderPass } from "../lib/RenderPass.js";
import { UnrealBloomPass } from "../lib/UnrealBloomPass.js";

window.addEventListener(
  "DOMContentLoaded",
  async () => {
    const wrapper = document.querySelector("#webgl");
    const app = new ThreeApp(wrapper);
    app.render();
  },
  false
);

// 扇風機を生成するクラス
class FanGenerator {
  headGroup; // ヘッドグループ
  fanCurveGroup; // ファンのカーブグループ
  fanGroup; // ファングループ
  bodyGroup; // 扇風機全体のグループ
  fanGeometry; // ファンのジオメトリ
  fanArray; // ファンの配列
  axisGeometry; //回転軸
  neckGeometry; //首
  baseGeometry; //台座

  constructor(scene) {
    this.scene = scene;
    // マテリアル
    this.material = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM);
    this.fanMaterial = new THREE.MeshPhongMaterial(ThreeApp.FAN_MATERIAL_PARAM);

    // ボディグループ
    this.bodyGroup = new THREE.Group();
    this.scene.add(this.bodyGroup);

    // ヘッドグループ
    this.headGroup = new THREE.Group();

    // ファングループ
    this.fanGroup = new THREE.Group();
    this.fanGroup.position.y = 3;
    this.fanGroup.position.z = 0.5;

    // ファン
    const fanShape = new THREE.Shape();
    const fX = 0,
      fY = 0;
    fanShape.moveTo(fX - 0.8, fY - 0.8);
    fanShape.bezierCurveTo(fX, fY, fX, fY, fX + 0.8, fY);
    fanShape.bezierCurveTo(fX + 0.8, fY, fX + 0.8, fY - 0.8, fX, fY - 0.8);
    const fanCount = 5;
    const transformScale = 1;
    this.fanGeometry = new THREE.ShapeGeometry(fanShape);
    this.fanArray = [];
    for (let i = 0; i < fanCount; i++) {
      const fan = new THREE.Mesh(this.fanGeometry, this.fanMaterial);
      const radian = (Math.PI * 2) / fanCount;
      fan.rotation.x = Math.PI / 10;
      fan.rotation.y = Math.PI / 10;
      this.fanCurveGroup = new THREE.Group();
      this.fanCurveGroup.add(fan);
      this.fanCurveGroup.rotation.z = -radian * i + Math.PI / 4;
      this.fanCurveGroup.position.x = Math.sin(radian * i) * transformScale;
      this.fanCurveGroup.position.y = Math.cos(radian * i) * transformScale;
      this.fanGroup.add(this.fanCurveGroup);
    }
    this.headGroup.add(this.fanGroup);

    //回転軸
    this.axisGeometry = new THREE.CylinderGeometry(0.3, 0.4, 1, 5);
    const axis = new THREE.Mesh(this.axisGeometry, this.material);
    axis.rotation.x = Math.PI / 2;
    axis.position.z = 0.1;
    axis.position.y = 3;
    this.headGroup.add(axis);
    this.bodyGroup.add(this.headGroup);

    //首
    this.neckGeometry = new THREE.CylinderGeometry(0.1, 0.1, 3, 32);
    const neck = new THREE.Mesh(this.neckGeometry, this.material);
    neck.position.y = 1.5;
    this.bodyGroup.add(neck);

    //台座
    this.baseGeometry = new THREE.CylinderGeometry(1.3, 1.5, 0.2, 32);
    const base = new THREE.Mesh(this.baseGeometry, this.material);
    this.bodyGroup.add(base);
  }
}

class ThreeApp {
  /**
   * カメラ定義のための定数
   */
  static CAMERA_PARAM = {
    fovy: 60,
    aspect: window.innerWidth / window.innerHeight,
    near: 0.1,
    far: 30.0,
    position: new THREE.Vector3(0.0, 10.0, 14.0),
    lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
  };
  /**
   * レンダラー定義のための定数
   */
  static RENDERER_PARAM = {
    clearColor: 0x111111,
    width: window.innerWidth,
    height: window.innerHeight,
  };
  /**
   * 平行光源定義のための定数
   */
  static DIRECTIONAL_LIGHT_PARAM = {
    color: 0xffffff,
    intensity: 1.0,
    position: new THREE.Vector3(1.0, 1.0, 1.0),
  };
  /**
   * アンビエントライト定義のための定数
   */
  static AMBIENT_LIGHT_PARAM = {
    color: 0xffffff,
    intensity: 0.1,
  };
  /**
   * マテリアル定義のための定数
   */
  static MATERIAL_PARAM = {
    color: 0xcce7d3,
  };
  static FAN_MATERIAL_PARAM = {
    color: 0x0099ee,
    transparent: true, // 透明を扱うかどうか
    opacity: 0.7, // 透明度
    side: THREE.DoubleSide, // 描画する面（バックフェイスカリングの設定）
  };

  /**
   * フォグの定義のための定数
   */
  static FOG_PARAM = {
    color: 0x111111,
    near: 10.0,
    far: 25.0,
  };

  /**
   * UnrealBloomPass定義のための定数
   */
  static BLOOM_PARAM = {
    strength: 1.6,
    radius: 1.0,
    threshold: 0.0,
  };

  renderer; // レンダラ
  scene; // シーン
  camera; // カメラ
  directionalLight; // 平行光源（ディレクショナルライト）
  ambientLight; // 環境光（アンビエントライト）
  material; // マテリアル
  fanMaterial; // ファンマテリアル
  fanBox = []; // ファンを入れる箱
  controls; // オービットコントロール
  axesHelper; // 軸ヘルパー
  angle; // ヘッドの角度
  composer; // エフェクトコンポーザー @@@
  renderPass; // レンダーパス
  unrealBloomPass; // 発光パス @@@

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

    // フォグ
    this.scene.fog = new THREE.Fog(
      ThreeApp.FOG_PARAM.color,
      ThreeApp.FOG_PARAM.near,
      ThreeApp.FOG_PARAM.far
    );

    // カメラ
    this.camera = new THREE.PerspectiveCamera(
      ThreeApp.CAMERA_PARAM.fovy,
      ThreeApp.CAMERA_PARAM.aspect,
      ThreeApp.CAMERA_PARAM.near,
      ThreeApp.CAMERA_PARAM.far
    );
    this.camera.position.copy(ThreeApp.CAMERA_PARAM.position);
    this.camera.lookAt(ThreeApp.CAMERA_PARAM.lookAt);

    // ディレクショナルライト（平行光源）
    this.directionalLight = new THREE.DirectionalLight(
      ThreeApp.DIRECTIONAL_LIGHT_PARAM.color,
      ThreeApp.DIRECTIONAL_LIGHT_PARAM.intensity
    );
    this.directionalLight.position.copy(
      ThreeApp.DIRECTIONAL_LIGHT_PARAM.position
    );
    this.scene.add(this.directionalLight);

    // アンビエントライト（環境光）
    this.ambientLight = new THREE.AmbientLight(
      ThreeApp.AMBIENT_LIGHT_PARAM.color,
      ThreeApp.AMBIENT_LIGHT_PARAM.intensity
    );
    this.scene.add(this.ambientLight);

    // ファンを生成
    const count = 8;
    const radian = (Math.PI * 2) / count;
    const fanScale = 5;
    for (let i = 0; i < count; i++) {
      const fanGenerator = new FanGenerator(this.scene);
      fanGenerator.bodyGroup.position.x = Math.sin(radian * i) * fanScale;
      fanGenerator.bodyGroup.position.z = Math.cos(radian * i) * fanScale;
      this.fanBox.push(fanGenerator);
    }

    // 軸ヘルパー
    // const axesBarLength = 5.0;
    // this.axesHelper = new THREE.AxesHelper(axesBarLength);
    // this.scene.add(this.axesHelper);

    // コントロール
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // コンポーザーの設定 @@@
    // コンポーザーにレンダラを渡して初期化する
    this.composer = new EffectComposer(this.renderer);
    // コンポーザーに、まず最初に「レンダーパス」を設定する
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    // コンポーザーにパスを設定する
    this.unrealBloomPass = new UnrealBloomPass(
      new THREE.Vector2(
        ThreeApp.RENDERER_PARAM.width,
        ThreeApp.RENDERER_PARAM.height
      ),
      ThreeApp.BLOOM_PARAM.strength,
      ThreeApp.BLOOM_PARAM.radius,
      ThreeApp.BLOOM_PARAM.threshold
    );
    this.composer.addPass(this.unrealBloomPass);
    // パスの追加がすべて終わったら画面に描画結果を出すよう指示する
    this.unrealBloomPass.renderToScreen = true;

    // this のバインド
    this.render = this.render.bind(this);

    this.angle = 0;
    // マウスの座標を取得する
    window.addEventListener(
      "mousemove",
      (e) => {
        var mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        var mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
        this.angle = Math.atan2(mouseY, mouseX);
      },
      false
    );

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

  /**
   * 描画処理
   */
  render() {
    // 恒常ループ
    requestAnimationFrame(this.render);
    // コントロールを更新
    this.controls.update();

    this.fanBox.forEach((fanGenerator, i) => {
      // ヘッドグループを回転させる
      fanGenerator.headGroup.rotation.y = this.angle;
      // ファングループを回転させる
      fanGenerator.fanGroup.rotation.z -= 0.1;
    });

    // レンダラーではなく、コンポーザーに対して描画を指示する @@@
    this.composer.render();
  }
}
