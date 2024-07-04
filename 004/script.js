// ======================================================================
// WebGLスクール-課題004
// ======================================================================

import * as THREE from "../lib/three.module.js";
import { gsap } from "../lib/gsap-core.js";

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
    position: new THREE.Vector3(0.0, 0.0, 5.0),
    lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
  };
  /**
   * レンダラー定義のための定数
   */
  static RENDERER_PARAM = {
    clearColor: 0x000000,
    width: window.innerWidth,
    height: window.innerHeight,
  };
  /**
   * 平行光源定義のための定数
   */
  static DIRECTIONAL_LIGHT_PARAM = {
    color: 0xffffff,
    intensity: 1.0,
    position: new THREE.Vector3(0.0, 0.0, 10.0),
  };
  /**
   * アンビエントライト定義のための定数
   */
  static AMBIENT_LIGHT_PARAM = {
    color: 0xffffff,
    intensity: 1.0,
  };
  /**
   * マテリアル定義のための定数
   */
  static MATERIAL_PARAM = {
    color: 0xffffff,
    side: THREE.DoubleSide,
  };

  // 半径
  static TRANSFORM_SCALE = 2.5;

  wrapper; // canvas の親要素
  renderer; // レンダラ
  scene; // シーン
  camera; // カメラ
  camera; // カメラ2
  cameraDirection; // カメラの向き
  directionalLight; // 平行光源（ディレクショナルライト）
  ambientLight; // 環境光（アンビエントライト）
  material; // マテリアル
  planeGeometry; // プレーンジオメトリ
  planeArray; // プレーンメッシュの配列
  texture; // テクスチャ
  isOn; // ホイールの押下状態用フラグ
  group; // グループ
  raycaster; // レイキャスター @@@

  angle;
  newWheel;
  intersects; // 交差したオブジェクト
  imgMaterial;
  imgDataList;
  imgList = [
    "img/img01.jpg",
    "img/img02.jpg",
    "img/img03.jpg",
    "img/img04.jpg",
    "img/img05.jpg",
    "img/img06.jpg",
    "img/img07.jpg",
    "img/img08.jpg",
  ];

  /**
   * コンストラクタ
   * @constructor
   * @param {HTMLElement} wrapper - canvas 要素を append する親要素
   */
  constructor(wrapper) {
    // 初期化時に canvas を append できるようにプロパティに保持
    this.wrapper = wrapper;

    // this のバインド
    this.render = this.render.bind(this);

    // Raycaster のインスタンスを生成する @@@
    this.raycaster = new THREE.Raycaster();

    this.isOn = true;

    // ホイールイベントの定義
    window.addEventListener(
      "wheel",
      (mouseEvent) => {
        // mouseEvent.preventDefault();

        if (this.isOn === true) {
          this.newWheel += 0.001 * mouseEvent.deltaY;
          this.planeArray.forEach((mesh, i) => {
            const newPosition =
              ((Math.PI * 2) / this.imgList.length) * i + this.newWheel;
            let targetX = Math.cos(newPosition) * ThreeApp.TRANSFORM_SCALE;
            let targetY = Math.sin(newPosition) * ThreeApp.TRANSFORM_SCALE;
            let targetRot = newPosition;

            // 配置座標を指定
            gsap.to(mesh.position, {
              x: targetX,
              y: targetY,
              duration: 1.8,
              ease: "expo.out",
              overwrite: true,
            });

            // 角度を指定
            gsap.to(mesh.rotation, {
              y: targetRot,
              duration: 0.9,
              ease: "expo.out",
              overwrite: true,
            });
          });
        }
      },
      false
    );
    // マウスのクリックイベントの定義 @@@
    window.addEventListener(
      "click",
      (mouseEvent) => {
        // ホイールイベントを有効にする
        this.isOn = true;

        // スクリーン空間の座標系をレイキャスター用に正規化する（-1.0 ~ 1.0 の範囲）
        const x = (mouseEvent.clientX / window.innerWidth) * 2.0 - 1.0;
        const y = (mouseEvent.clientY / window.innerHeight) * 2.0 - 1.0;
        // スクリーン空間は上下が反転している点に注意（Y だけ符号を反転させる）
        const v = new THREE.Vector2(x, -y);
        // レイキャスターに正規化済みマウス座標とカメラを指定する
        this.raycaster.setFromCamera(v, this.camera);
        // 計算に必要な要素を渡しただけで、計算はまだ行われていない
        // scene に含まれるすべてのオブジェクト（ここでは Mesh）を対象にレイキャストする

        this.intersects = this.raycaster.intersectObjects(this.planeArray);
        // レイが交差しなかった場合を考慮し一度カメラを通常時の状態にリセットしておく
        this.planeArray.forEach((mesh, i) => {
          const newPosition =
            ((Math.PI * 2) / this.imgList.length) * i + this.newWheel;
          gsap.to(mesh.rotation, {
            y: newPosition,
            duration: 0.9,
            ease: "expo.out",
            overwrite: true,
          });
        });
        gsap.to(this.camera.position, {
          x: ThreeApp.CAMERA_PARAM.position.x,
          y: ThreeApp.CAMERA_PARAM.position.y,
          z: ThreeApp.CAMERA_PARAM.position.z,
          duration: 0.8,
          ease: "expo.out",
          overwrite: true,
        });

        if (this.intersects.length > 0) {
          // ホイールイベントを無効にする
          this.isOn = false;
          this.intersects[0].object.scale.set(1, 1, 1);

          // 角度を指定;
          gsap.to(this.intersects[0].object.rotation, {
            y: 0,
            duration: 0.8,
            ease: "expo.out",
            overwrite: true,
          });
          const cameraPosition = this.intersects[0].object.position.clone();
          // 配置座標を指定;
          gsap.to(this.camera.position, {
            x: cameraPosition.x,
            y: cameraPosition.y,
            z: cameraPosition.z + 2,
            duration: 0.8,
            ease: "expo.out",
            overwrite: true,
          });
        }
      },
      false
    );

    // hoverイベントの定義
    window.addEventListener(
      "mousemove",
      (mouseEvent) => {
        const x = (mouseEvent.clientX / window.innerWidth) * 2.0 - 1.0;
        const y = (mouseEvent.clientY / window.innerHeight) * 2.0 - 1.0;
        const v = new THREE.Vector2(x, -y);
        this.raycaster.setFromCamera(v, this.camera);
        this.intersects = this.raycaster.intersectObjects(this.planeArray);
        this.planeArray.forEach((mesh) => {
          gsap.to(mesh.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: 0.3,
            ease: "expo.out",
            overwrite: true,
          });
        });
        if (this.isOn === true) {
          if (this.intersects.length > 0) {
            gsap.to(this.intersects[0].object.scale, {
              x: 1.06,
              y: 1.06,
              z: 1.06,
              duration: 0.2,
              ease: "expo.out",
              overwrite: true,
            });
          }
        }
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

    //マテリアル
    this.material = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM);

    // グループ
    this.group = new THREE.Group();

    this.planeArray = [];
    this.planeGeometry = new THREE.PlaneGeometry(1.5, 1.5);
    this.imgDataList.forEach((img, i) => {
      this.imgMaterial = this.material.clone();
      this.imgMaterial.map = img;

      // メッシュ
      const plane = new THREE.Mesh(this.planeGeometry, this.imgMaterial);
      this.angle = ((Math.PI * 2) / this.imgList.length) * i;
      // 初期値ちょっとずらす
      this.angle = this.angle - Math.PI / 8;
      this.newWheel = 0.0;

      plane.rotation.y = this.angle;
      plane.position.set(
        Math.cos(this.angle) * ThreeApp.TRANSFORM_SCALE,
        Math.sin(this.angle) * ThreeApp.TRANSFORM_SCALE,
        0
      );
      this.group.add(plane);
      this.planeArray.push(plane);
    });

    this.scene.add(this.group);
  }

  /**
   * アセット（素材）のロードを行う Promise
   */
  load() {
    const promises = [];
    this.imgDataList = [];

    const loader = new THREE.TextureLoader();
    this.imgList.map((path) => {
      promises.push(
        new Promise((resolve) => {
          loader.load(path, (texture) => {
            this.imgDataList.push(texture);
            resolve();
          });
        })
      );
    });
    return Promise.all(promises);
  }

  /**
   * 描画処理
   */

  render() {
    // 恒常ループ
    requestAnimationFrame(this.render);

    // レンダラーで描画
    this.renderer.render(this.scene, this.camera);
  }
}
