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
    clearColor: 0x111111,
    width: window.innerWidth,
    height: window.innerHeight,
  };
  /**
   * 平行光源定義のための定数
   */
  static DIRECTIONAL_LIGHT_PARAM = {
    color: 0xffffff,
    intensity: 2.0,
    position: new THREE.Vector3(1.0, 1.0, 1.0),
  };
  /**
   * アンビエントライト定義のための定数
   */
  static AMBIENT_LIGHT_PARAM = {
    color: 0xffffff,
    intensity: 0.5,
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
    color: 0x111111,
    near: 5.0,
    far: 15.0,
  };
  /**
   * 雲のマテリアル定義のための定数
   */
  static CROWD_PARAM = {
    transparent: true,
    side: THREE.DoubleSide, // 裏からも見えるようにする
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

  /**
   * レンダーターゲットの大きさ @@@
   */
  static RENDER_TARGET_SIZE = 1024;

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

  //サブカメラのマテリアル
  planeCamGeometry;
  planeCamDirection;
  planeCamMaterial;

  //雲のマテリアル
  crowdGeometry;
  crowdMaterial;

  polygon; // 板ポリゴン @@@
  renderTarget; // オフスクリーン用のレンダーターゲット @@@
  blackColor; // 背景色出し分けのため @@@
  whiteColor; // 背景色出し分けのため @@@

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
        this.cameraMain.updateProjectionMatrix();
        // this.cameraSub.updateProjectionMatrix();
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
    // 雲
    promises.push(
      new Promise((resolve) => {
        const loader = new THREE.TextureLoader();
        loader.load("./crowd.png", (texture) => {
          this.crowdTexture = texture;
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
    // オフスクリーン用のシーン @@@
    // 以下、各種オブジェクトやライトはオフスクリーン用のシーンに add しておく
    this.offscreenScene = new THREE.Scene();

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
    // // サブカメラ
    // this.cameraSub = new THREE.PerspectiveCamera(
    //   ThreeApp.CAMERA_PARAM.fovy,
    //   ThreeApp.CAMERA_PARAM.aspect,
    //   ThreeApp.CAMERA_PARAM.near,
    //   ThreeApp.CAMERA_PARAM.far
    // );
    // this.cameraSub.position.copy(ThreeApp.CAMERA_PARAM.position);
    // this.cameraSub.lookAt(ThreeApp.CAMERA_PARAM.lookAt);

    // ディレクショナルライト（平行光源）
    this.directionalLight = new THREE.DirectionalLight(
      ThreeApp.DIRECTIONAL_LIGHT_PARAM.color,
      ThreeApp.DIRECTIONAL_LIGHT_PARAM.intensity
    );
    this.directionalLight.position.copy(
      ThreeApp.DIRECTIONAL_LIGHT_PARAM.position
    );
    this.offscreenScene.add(this.directionalLight);
    this.scene.add(this.directionalLight);

    // アンビエントライト（環境光）
    this.ambientLight = new THREE.AmbientLight(
      ThreeApp.AMBIENT_LIGHT_PARAM.color,
      ThreeApp.AMBIENT_LIGHT_PARAM.intensity
    );
    this.offscreenScene.add(this.ambientLight);
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
    this.offscreenScene.add(this.earth);
    this.scene.add(this.earth);

    this.planeDirection = new THREE.Vector3(0.0, 1.0, 0.0).normalize();
    this.plane.rotation.set(0, 0, -Math.PI / 2);
    this.plane.position.set(0, 0, ThreeApp.PLANE_DISTANCE);
    this.plane.scale.set(
      ThreeApp.PLANE_SCALE,
      ThreeApp.PLANE_SCALE,
      ThreeApp.PLANE_SCALE
    );

    this.offscreenScene.add(this.plane);
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
    // this.offscreenScene.add(this.planeCam);
    this.scene.add(this.planeCam);

    // 地球のマテリアルとメッシュ
    this.crowdGeometry = new THREE.SphereGeometry(
      ThreeApp.EARTH_SCALE * 1.1,
      32,
      32
    );
    this.crowdMaterial = new THREE.MeshLambertMaterial(ThreeApp.CROWD_PARAM);
    this.crowdMaterial.map = this.crowdTexture;
    this.crowd = new THREE.Mesh(this.crowdGeometry, this.crowdMaterial);
    this.offscreenScene.add(this.crowd);
    this.scene.add(this.crowd);

    // コントロール
    this.controls = new OrbitControls(
      this.cameraMain,
      this.renderer.domElement
    );

    // レンダーターゲットをアスペクト比 1.0 の正方形で生成する @@@
    this.renderTarget = new THREE.WebGLRenderTarget(
      ThreeApp.RENDER_TARGET_SIZE,
      ThreeApp.RENDER_TARGET_SIZE
    );
    // オフスクリーン用のカメラは、この時点でのカメラの状態を（使いまわして手間軽減のため）クローンしておく @@@
    this.offscreenCamera = this.cameraMain.clone();
    // ただし、最終シーンがブラウザのクライアント領域のサイズなのに対し……
    // レンダーターゲットは正方形なので、アスペクト比は 1.0 に設定を上書きしておく
    this.offscreenCamera.aspect = 1.0;
    // カメラのパラメータが変更されたので、行列を更新しておく
    this.offscreenCamera.updateProjectionMatrix();

    // レンダリング結果を可視化するのに、板ポリゴンを使う @@@
    const planeGeometry = new THREE.PlaneGeometry(5.0, 5.0);
    const planeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.polygon = new THREE.Mesh(planeGeometry, planeMaterial);
    this.polygon.position.set(5, 5, 0);

    // 板ポリゴンのマテリアルには、レンダーターゲットに描き込まれた結果を投影したいので……
    // マテリアルの map プロパティにレンダーターゲットのテクスチャを割り当てておく @@@
    planeMaterial.map = this.renderTarget.texture; // WebGLRenderTargetには、textureというプロパティが生えてる https://threejs.org/docs/?q=renderTarget#api/en/renderers/WebGLRenderTarget.texture

    // 板ポリゴンをシーンに追加
    this.scene.add(this.polygon);

    // ヘルパー
    const axesBarLength = 10.0;
    this.axesHelper = new THREE.AxesHelper(axesBarLength);
    this.scene.add(this.axesHelper);

    // Clock オブジェクトの生成
    this.clock = new THREE.Clock();

    // 背景色を出し分けるため、あらかじめ Color オブジェクトを作っておく @@@
    this.blackColor = new THREE.Color(0x000000);
    this.whiteColor = new THREE.Color(0xffffff);
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

    this.earth.rotation.y += 0.001;
    this.crowd.rotation.y += 0.003;

    // 現在の位置を保持しておく
    const oldPosition = this.plane.position.clone();
    // アニメーション後の新しい位置
    const newPosition = new THREE.Vector3(
      Math.cos(time) * ThreeApp.PLANE_DISTANCE,
      Math.sin(time) * ThreeApp.PLANE_DISTANCE,
      (Math.sin(time * 5) / 10) * ThreeApp.PLANE_DISTANCE
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
    // サブカメラの現在の位置に向かって、原点から伸びるベクトル（を単位化したもの）
    const cameraUpDirection = cameraPosition.clone().normalize();
    // サブカメラの上方向を意味するプロパティに上記のベクトルを設定してから lookAt
    this.offscreenCamera.up.copy(cameraUpDirection);

    this.offscreenCamera.lookAt(this.plane.position);
    this.offscreenCamera.position.copy(cameraPosition);
    this.planeCam.position.copy(cameraPosition);

    // まず最初に、オフスクリーンレンダリングを行う @@@
    this.renderer.setRenderTarget(this.renderTarget);

    this.renderer.setSize(
      ThreeApp.RENDER_TARGET_SIZE,
      ThreeApp.RENDER_TARGET_SIZE
    );

    // わかりやすくするために、背景を黒にしておく
    // this.renderer.setClearColor(this.whiteColor, 1.0);
    // オフスクリーン用のシーン（Duck が含まれるほう）を描画する
    this.renderer.render(this.offscreenScene, this.offscreenCamera);

    // 次に最終的な画面の出力用のシーンをレンダリングするため null を指定しもとに戻す @@@
    this.renderer.setRenderTarget(null);
    // 最終的な出力はウィンドウサイズ
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // わかりやすくするために、背景を白にしておく
    this.renderer.setClearColor(this.blackColor, 1.0);
    // 板ポリゴンが１枚置かれているだけのシーンを描画する
    this.renderer.render(this.scene, this.cameraMain);

    // レンダラー
    // this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    // this.renderer.clear();

    // this.renderer.setViewport(
    //   window.innerWidth - 0.4 * window.innerWidth,
    //   window.innerHeight - window.innerHeight * 0.4,
    //   0.4 * window.innerWidth,
    //   0.4 * window.innerHeight
    // );
    // this.renderer.setScissor(
    //   window.innerWidth - 0.4 * window.innerWidth,
    //   window.innerHeight - window.innerHeight * 0.4,
    //   0.4 * window.innerWidth,
    //   0.4 * window.innerHeight
    // );
    // this.renderer.setScissorTest(true);
    // this.renderer.render(this.scene, this.cameraSub);
    // this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    // this.renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
    // this.renderer.setScissorTest(true);
    // this.renderer.render(this.scene, this.cameraMain);
  }
}
