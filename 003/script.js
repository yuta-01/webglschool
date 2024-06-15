// ======================================================================
// WebGLスクール-課題003
// ======================================================================

// 必要なモジュールを読み込み
import * as THREE from "../lib/three.module.js";
import { OrbitControls } from "../lib/OrbitControls.js";
import { GLTFLoader } from "../lib/GLTFLoader.js";

window.addEventListener(
  "DOMContentLoaded",
  async () => {
    const wrapper = document.querySelector("#webgl");
    const app = new ThreeApp(wrapper);
    await app.load();
    app.init();
    app.render();
  },
  false
);

class ThreeApp {
  /**
   * カメラ定義のための定数
   */
  static CAMERA_PARAM = {
    fovy: 60,
    aspect: window.innerWidth / window.innerHeight,
    near: 0.1,
    far: 50.0,
    position: new THREE.Vector3(5.0, 5.0, 10.0),
    lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
    rotation: new THREE.Vector3(0.0, 0.0, 0.0),
  };
  /**
   * レンダラー定義のための定数
   */
  static RENDERER_PARAM = {
    clearColor: 0xdddddd,
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
    intensity: 0.3,
  };
  /**
   * マテリアル定義のための定数
   */
  static MATERIAL_PARAM = {
    color: 0xffffff,
  };
  /**
   * フォグの定義のための定数
   */
  static FOG_PARAM = {
    color: 0xdddddd,
    near: 5.0,
    far: 20.0,
  };

  /**
   * スケール
   */
  static EARTH_SCALE = 4;
  static PLANE_SCALE = 0.02;
  /**
   * 飛行機と地球の間の距離
   */
  static PLANE_DISTANCE = 4.1;

  /**
   * カメラの移動速度
   */
  static CAMERA_SPEED = 0.1;
  /**
   * カメラと飛行機の距離
   */
  static CAMERA_DISTANCE = 1.5;
  /**
   * 曲がる力
   */
  static PLANE_TURN_SCALE = 0.1;

  wrapper; // canvas の親要素
  renderer; // レンダラ
  scene; // シーン
  cameraMain; // カメラ
  cameraSub; // カメラ
  directionalLight; // 平行光源（ディレクショナルライト）
  ambientLight; // 環境光（アンビエントライト）
  controls; // オービットコントロール
  axesHelper; // 軸ヘルパー
  clock; // 時間管理用
  earth; // 地球
  earthMaterial; // 地球用マテリアル
  earthTexture; // 地球用テクスチャ

  plane; // 飛行機
  planeDirection; // 飛行機の進行方向

  //サブカメラのマテイリアル
  planeCamGeometry;
  planeCamDirection;
  planeCamMaterial;

  /**
   * コンストラクタ
   * @constructor
   * @param {HTMLElement} wrapper - canvas 要素を append する親要素
   */
  constructor(wrapper) {
    // 初期化時に canvas を append できるようにプロパティに保持
    this.wrapper = wrapper;

    // 再帰呼び出しのための this 固定
    this.render = this.render.bind(this);

    // リサイズイベント
    window.addEventListener(
      "resize",
      () => {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.cameraMain.aspect = window.innerWidth / window.innerHeight;
        this.cameraSub.aspect = window.innerWidth / window.innerHeight;
        this.cameraMain.updateProjectionMatrix();
        this.cameraSub.updateProjectionMatrix();
      },
      false
    );
  }

  /**
   * アセット（素材）のロードを行う Promise
   */
  load() {
    const promises = [];
    //boeing
    promises.push(
      new Promise((resolve) => {
        const loader = new GLTFLoader();
        loader.load("./boeing_787.glb", (gltf) => {
          this.plane = gltf.scene;
          resolve();
        });
      })
    );
    // 地球
    promises.push(
      new Promise((resolve) => {
        const loader = new THREE.TextureLoader();
        loader.load("./earth.jpg", (texture) => {
          this.earthTexture = texture;
          resolve();
        });
      })
    );
    return Promise.all(promises);
  }

  /**
   * 初期化処理
   */
  init() {
    // レンダラー
    const color = new THREE.Color(ThreeApp.RENDERER_PARAM.clearColor);
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setClearColor(color);
    this.renderer.setSize(
      ThreeApp.RENDERER_PARAM.width,
      ThreeApp.RENDERER_PARAM.height
    );
    this.wrapper.appendChild(this.renderer.domElement);
    this.renderer.autoClear = false;

    // シーン
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(
      ThreeApp.FOG_PARAM.color,
      ThreeApp.FOG_PARAM.near,
      ThreeApp.FOG_PARAM.far
    );

    // カメラ
    this.cameraMain = new THREE.PerspectiveCamera(
      ThreeApp.CAMERA_PARAM.fovy,
      ThreeApp.CAMERA_PARAM.aspect,
      ThreeApp.CAMERA_PARAM.near,
      ThreeApp.CAMERA_PARAM.far
    );
    this.cameraMain.position.copy(ThreeApp.CAMERA_PARAM.position);
    this.cameraMain.lookAt(ThreeApp.CAMERA_PARAM.lookAt);
    // サブカメラ
    this.cameraSub = new THREE.PerspectiveCamera(
      ThreeApp.CAMERA_PARAM.fovy,
      ThreeApp.CAMERA_PARAM.aspect,
      ThreeApp.CAMERA_PARAM.near,
      ThreeApp.CAMERA_PARAM.far
    );
    this.cameraSub.position.copy(ThreeApp.CAMERA_PARAM.position);
    this.cameraSub.lookAt(ThreeApp.CAMERA_PARAM.lookAt);

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

    // 球体のジオメトリを生成
    this.sphereGeometry = new THREE.SphereGeometry(
      ThreeApp.EARTH_SCALE,
      32,
      32
    );
    // 地球のマテリアルとメッシュ
    this.earthMaterial = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM);
    this.earthMaterial.map = this.earthTexture;
    this.earth = new THREE.Mesh(this.sphereGeometry, this.earthMaterial);
    this.scene.add(this.earth);

    this.planeDirection = new THREE.Vector3(0.0, 1.0, 0.0).normalize();
    this.plane.rotation.set(0, 0, -Math.PI / 2);
    this.plane.position.set(0, 0, ThreeApp.PLANE_DISTANCE);
    this.plane.scale.set(
      ThreeApp.PLANE_SCALE,
      ThreeApp.PLANE_SCALE,
      ThreeApp.PLANE_SCALE
    );

    this.scene.add(this.plane);

    // サブカメラを生成;
    this.planeCamGeometry = new THREE.ConeGeometry(0.2, 0.5, 32);
    // サブカメラのマテリアルとメッシュ
    this.planeCamMaterial = new THREE.MeshPhongMaterial(
      ThreeApp.MATERIAL_PARAM
    );
    this.planeCam = new THREE.Mesh(
      this.planeCamGeometry,
      this.planeCamMaterial
    );
    this.scene.add(this.planeCam);

    // コントロール
    this.controls = new OrbitControls(
      this.cameraMain,
      this.renderer.domElement
    );

    // ヘルパー
    // const axesBarLength = 10.0;
    // this.axesHelper = new THREE.AxesHelper(axesBarLength);
    // this.scene.add(this.axesHelper);

    // Clock オブジェクトの生成
    this.clock = new THREE.Clock();
  }

  /**
   * 描画処理
   */
  render() {
    // 恒常ループ
    requestAnimationFrame(this.render);
    // 前回のフレームからの経過時間の取得
    const time = this.clock.getElapsedTime() / 2;

    // コントロールを更新
    this.controls.update();

    // 現在の位置を保持しておく
    const oldPosition = this.plane.position.clone();
    // アニメーション後の新しい位置
    const newPosition = new THREE.Vector3(
      Math.cos(time) * ThreeApp.PLANE_DISTANCE,
      Math.sin(time) * ThreeApp.PLANE_DISTANCE,
      (Math.sin(time * 3) / 10) * ThreeApp.PLANE_DISTANCE
    );
    this.plane.position.copy(newPosition);

    //　四元数を使って姿勢を制御する
    // (A) 現在（前のフレームまで）の進行方向を変数に保持しておく
    const previousDirection = this.planeDirection.clone();
    // (終点 - 始点) という計算を行うことで、２点間を結ぶベクトルを定義
    const subVector = newPosition.clone().sub(oldPosition);

    // 長さに依存せず、向きだけを考えたい場合はベクトルを単位化する
    subVector.normalize();
    // 飛行機の進行方向ベクトルに、向きベクトルを小さくスケールして加算する
    this.planeDirection.add(
      subVector.multiplyScalar(ThreeApp.PLANE_TURN_SCALE)
    );
    // (B) 加算したことでベクトルの長さが変化するので、単位化してカメラの座標に加算する
    this.planeDirection.normalize();
    const direction = this.planeDirection.clone();
    this.plane.position.add(direction.multiplyScalar(ThreeApp.CAMERA_SPEED));
    // (C) 変換前と変換後の２つのベクトルから外積で法線ベクトルを求める
    const normalAxis = new THREE.Vector3().crossVectors(
      previousDirection,
      this.planeDirection
    );

    normalAxis.normalize(); //→正規化して回転軸として使う
    // (D) 変換前と変換後のふたつのベクトルから内積でコサインを取り出す
    const cos = previousDirection.dot(this.planeDirection); //→単位化されたベクトル同士の内積はcosθに等しい
    // (D) コサインをラジアンに戻す
    const radians = Math.acos(cos);
    // 求めた法線ベクトルとラジアンからクォータニオンを定義
    const qtn = new THREE.Quaternion().setFromAxisAngle(normalAxis, radians);
    // 飛行機の現在のクォータニオンに乗算する
    this.plane.quaternion.premultiply(qtn);
    //カメラの現在のクォータニオンに乗算する
    this.planeCam.quaternion.premultiply(qtn);

    // カメラの位置を設定
    const backVector = this.planeDirection.clone().negate();
    // 逆向きベクトルを距離分引き伸ばす
    backVector.multiplyScalar(ThreeApp.CAMERA_DISTANCE);

    const cameraPosition = backVector.add(this.plane.position);

    // カメラの位置と注視点を設定
    // this.cameraMain.lookAt(this.plane.position);
    this.cameraSub.lookAt(this.plane.position);
    this.cameraSub.position.copy(cameraPosition);
    this.planeCam.position.copy(cameraPosition);

    // レンダラー
    this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    this.renderer.clear();

    this.renderer.setViewport(
      window.innerWidth - 0.4 * window.innerWidth,
      window.innerHeight - window.innerHeight * 0.4,
      0.4 * window.innerWidth,
      0.4 * window.innerHeight
    );
    this.renderer.setScissor(
      window.innerWidth - 0.4 * window.innerWidth,
      window.innerHeight - window.innerHeight * 0.4,
      0.4 * window.innerWidth,
      0.4 * window.innerHeight
    );
    this.renderer.setScissorTest(true);
    this.renderer.render(this.scene, this.cameraSub);
    this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    this.renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
    this.renderer.setScissorTest(true);
    this.renderer.render(this.scene, this.cameraMain);
  }
}
