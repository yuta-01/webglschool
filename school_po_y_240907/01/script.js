// 01 ======================================================================
// three.jsを利用して、meshにhtml要素の情報を共有し、meshは独自のシェーダでカスタムを行えるようにする

// ▼ ポイント
// 1. meshと同期したいhtmlのセレクタ情報を取得
// ・ meshと同期したいhtml要素のセレクタ情報を取得する(今回は同期したい要素が1つのため、querySelectorを使用)
// ・ 複数の場合はquerySelectorAllを使用し、NodeListを取得する

// 2. canvas周りの準備:
// ・	renderer, scene, cameraの初期化は今まで通りの基本設定を行う（カメラのポジションは別途調整する）

// 3. html要素とmeshの同期:
// ・	html要素のサイズを取得し、meshのscaleを設定:
//    planeElement（htmlの対象要素）の幅と高さを取得し、その情報をもとにmeshのサイズ(scale)を設定する
//    これにより、3D空間内に表示されるmeshの大きさが画面上でのhtml要素の大きさと一致するようになる
// ・	htmlの座標位置を取得し、meshのpositionを設定:
//    planeElementの座標位置を取得し、その情報をもとにmeshの位置(position)を設定する
//    これにより、3D空間内に表示されるmeshの位置が画面上でのhtml要素の位置と一致するようになる

// 4. カメラの位置調整:
// ・	カメラの距離を計算:
//    calcViewportDistance関数は、カメラの視野角（FOV）とビューポートの高さを使って、カメラがどの距離に位置するべきかを計算する
//    算出された距離はカメラのposition.zに設定する
//    カメラが適切な距離に配置されることで、WebGLキャンバス上での3Dオブジェクトの位置が、html要素の位置と見た目上一致するようになる
// ・	視野角とビューポートサイズに基づくカメラ位置:
//    ビューポート（表示領域）の高さに応じて、カメラの位置を動的に調整する
//    リサイズ処理に対応することで画面サイズが変更されても、3Dシーン内のオブジェクトとhtml要素の位置関係が常に整合性を保つことができる

// 5. シェーダのカスタマイズ (RawShaderMaterial の利用):
// ・	RawShaderMaterialの使用
//    RawShaderMaterialは、three.jsで独自のシェーダプログラムを直接指定するためのマテリアル
//    このマテリアルを使用するこでと、自前のシェーダ（頂点シェーダとフラグメントシェーダ）を追加し
//    デフォルトのthree.jsのシェーダの代わりに独自のカスタムな描画を行うことができる

// ============================================================================

import {WebGLUtility} from '../lib/webgl.js'; // WebGLUtilityの読み込み(杉本さん作)
import * as THREE from '../lib/three.module.js'; // three.js の読み込み
import GUI from '../lib/lil-gui.min.js'; // GUI ライブラリの読み込み( https://lil-gui.georgealways.com/ )

window.addEventListener('DOMContentLoaded', () => {
  // canvas append用の要素を取得
  const wrapper = document.querySelector('#webgl')
  // meshと同期用の要素を取得
  const planeElement = document.querySelector('.plane')

  // ThreeAppクラスのインスタンスを生成
  const app = new ThreeApp(wrapper, planeElement)
  app.init()
}, false)

// ThreeAppクラス
// ベースは杉本さんの本講義で使用されていたものから作成しています
// 追加された箇所には できるだけコメントを記載しています
class ThreeApp {
  /**
   * カメラ定義のための定数 @@@
   */
  static CAMERA_PARAM = {
    fovy: 60,
    near: 0.1,
    far: 10000, // カメラのポジションZを調整するので遠目の距離設定しておく（適宜調整）
    position: new THREE.Vector3(0.0, 0.0, 0.0), // 真正面からの見える状態にしたいのでx,yは0に設定。zの数値は後ほど調整
    lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
  };

  /**
   * レンダラー定義のための定数
   */
  static RENDERER_PARAM = {
    clearColor: 0xffffff,
    transparent: 0, // 背景透過
  };

  /**
   * マテリアル定義のための定数 @@@
   */
  static MATERIAL_PARAM = {
    shaderSourcePath: {
      vertexShader: './shaders/index.vert', // 頂点シェーダのパス
      fragmentShader: './shaders/index.frag' // フラグメントシェーダのパス
    },
  };

  /**
   * mesh利用のための定数 @@@
   */
  static PLANE_PARAM = {
    isHtmlWithMesh: false // html要素とmeshの同期を行うかどうかのフラグ
  }

  renderer; // レンダラ
  scene; // シーン
  camera; // カメラ
  material; // マテリアル
  planeGeometry; // meshジオメトリ
  plane; // mesh( mesh )
  wrapper; // canvas の親要素
  planeElement; // meshと同期するhtml要素

  shaderSource = {
    vertexShader: null, // 頂点シェーダ
    fragmentShader: null // フラグメントシェーダ
  };

  texture; // テクスチャ

  /**
   * コンストラクタ
   * @constructor
   * @param {HTMLElement} wrapper - canvas 要素を append する親要素
   * @param {HTMLElement} planeElement - meshと情報を同期する要素
   */
  constructor(wrapper, planeElement) {
    this.wrapper = wrapper
    this.planeElement = planeElement
  }


  ///////////////////////////////// Setup /////////////////////////////////
  /**
   * 初期化処理 @@@
   */
  init() {
    this.load().then(() => {
      // リソースの読込みが完了次第初期化処理を行う
      this.setup() // 初回セットアップ処理

      // レンダラー、カメラ、meshのプロパティを設定( windowリサイズ時にも呼び出す関数群なのでonResize関数にまとめています )
      this.setCameraProps() // カメラのプロパティを設定
      this.setPlaneSize() // meshのサイズを設定
      this.setPlanePosition() // meshのポジションを設定

      this.addEventListeners() // イベントリスナーの追加
      this.addGUI() // GUIの追加

      // 準備完了次第恒常ループを開始
      this.start() // 恒常ループの開始
    })
  }

  /**
   * リソースの読み込み @@@
   * 読み込みが完了したらPromiseを返す
   * @returns {Promise<unknown>}
   */
  async load() {
    return new Promise(async (resolve, reject) => {
      // 独自にカスタムしたシェーダを利用したいので、使用するシェーダを読み込んでおく
      // （今回はフロント側でシェーダファイルを読み込んでいますが、ビルド時にシェーダをバンドルする方法もあるので気になったら調べてみてください！）
      this.shaderSource.vertexShader = await WebGLUtility.loadFile(ThreeApp.MATERIAL_PARAM.shaderSourcePath.vertexShader)
      this.shaderSource.fragmentShader = await WebGLUtility.loadFile(ThreeApp.MATERIAL_PARAM.shaderSourcePath.fragmentShader)

      resolve()
    })
  }

  /**
   * 初回セットアップ処理 @@@
   */
  setup() {
    this.renderer = new THREE.WebGLRenderer({
      alpha: true　// 背景を透過する設定
    })
    const rendererColor = new THREE.Color(ThreeApp.RENDERER_PARAM.clearColor)
    this.renderer.setClearColor(rendererColor, ThreeApp.RENDERER_PARAM.transparent)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.wrapper.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera(
      ThreeApp.CAMERA_PARAM.fovy,
      window.innerWidth / window.innerHeight,
      ThreeApp.CAMERA_PARAM.near,
      ThreeApp.CAMERA_PARAM.far,
    )
    this.camera.position.copy(ThreeApp.CAMERA_PARAM.position)
    this.camera.lookAt(ThreeApp.CAMERA_PARAM.lookAt)

    // meshのジオメトリ
    // 一旦仮のサイズ（1, 1）で作成し、後ほど同期用のhtml要素のサイズに応じてスケールの値を調整する
    // セグメントの数はとりあえず1で作成
    this.planeGeometry = new THREE.PlaneGeometry(
      1,
      1,
      1,
      1
    )

    // テクスチャの読み込み
    const textureLoader = new THREE.TextureLoader()

    // マテリアル @@@
    // 独自のカスタムシェーダをマテリアルとして利用したい場合は、RawShaderMaterial or ShaderMaterialを利用する
    // https://threejs.org/docs/#api/en/materials/RawShaderMaterial
    // https://threejs.org/docs/#api/en/materials/ShaderMaterial
    // 両materialの違いは、ビルトインで用意されている変数等（インスタントに利用できるthree.jsの機能）の違い
    // RawShaderMaterialはよりThree.jsの機能に依存せず、素のWebGLに近いので、シェーダ内で利用する変数定義が必要になる
    // どちらを採用するかはお好みで
    this.material = new THREE.RawShaderMaterial({
      vertexShader: this.shaderSource.vertexShader,
      fragmentShader: this.shaderSource.fragmentShader,
      uniforms: {
        uMeshResolution: {
          value: {
            x: this.planeElement.clientWidth, // meshの横幅
            y: this.planeElement.clientHeight // meshの縦幅
          }
        },
        uTexture: {
          value: null // テクスチャ画像
        },
        uTextureResolution: {
          value: {
            x: 1,　// テクスチャの幅（テクスチャ読み込み後に変更するが、初期値として設定）
            y: 1　 // テクスチャの高さ（テクスチャ読み込み後に変更するが、初期値として設定）
          }
        },
      },
      wireframe: false,
      transparent: true, // 透過処理を有効にする
    })

    // 今回は対象のhtmlとの同期になるので、テクスチャもhtml側で指定されたdata属性の値を参照する
    // html側に設定されたdata-texture-src属性を取得して、テクスチャを読み込む
    const textureSrc = this.planeElement.dataset['textureSrc'];
    textureLoader.load(textureSrc, (texture) => {
      this.material.uniforms.uTexture.value = texture
      this.material.uniforms.uTextureResolution.value.x = texture.image.naturalWidth
      this.material.uniforms.uTextureResolution.value.y = texture.image.naturalHeight
    })

    this.plane = new THREE.Mesh(this.planeGeometry, this.material)
    this.scene.add(this.plane)
  }

  /**
   * @@@ 恒常ループの開始
   */
  start() {
    this.onRaf()
  }

  /**
   * @@@ イベントリスナーを追加
   */
  addEventListeners() {
    // リサイズイベントの登録
    window.addEventListener('resize', () => {
      this.onResize()
    }, false)

  }

  /**
   * @@@ GUIの追加
   */
  addGUI() {
    this.gui = new GUI()
    const planeFolder = this.gui.addFolder('Plane')
    planeFolder.add(ThreeApp.PLANE_PARAM, 'isHtmlWithMesh').name('isHtmlWithMesh').onChange(() => {
      this.setPlanePosition()
    })
    planeFolder.add(this.material, 'wireframe').name('wireframe')
  }

  ///////////////////////////////// /Setup //////////////////////////////


  ///////////////////////////////// Update /////////////////////////////////
  /**
   *　@@@ meshのポジションを設定する
   */
  setPlanePosition() {
    if (!ThreeApp.PLANE_PARAM.isHtmlWithMesh) {
      // 画面中央オリジンに配置（デフォルト）
      this.plane.position.set(0, 0, 0)
    } else {
      // 左上をオリジンに配置（htmlの座標系と同様にする）
      const rendererSize = {
        width: this.renderer.domElement.width,
        height: this.renderer.domElement.height
      }

      const meshOrigin = {
        // 中央から、canvasの横幅の半分を引いて、meshの横幅の半分を足した値をx座標に設定（左に寄せる）
        x: -rendererSize.width / 2 + this.plane.scale.x / 2,
        // 中央から、canvasの縦幅の半分を足して、meshの縦幅の半分を引いた値をy座標に設定（上に寄せる）
        y: rendererSize.height / 2 - this.plane.scale.y / 2
      }

      const planeElementPosition = {
        x: this.planeElement.offsetLeft,　// html要素のx座標を取得
        y: this.planeElement.offsetTop // html要素のy座標を取得
      }

      const planeMeshPosition = {
        x: meshOrigin.x + planeElementPosition.x, // meshのx座標を設定
        y: meshOrigin.y - planeElementPosition.y // meshのy座標を設定
      }

      // 画面左上が原点になることで、html要素をcssを使って配置する際と同じような座標になる
      this.plane.position.set(planeMeshPosition.x, planeMeshPosition.y, 0)
    }
  }

  /**
   *　@@@ レンダラーの大きさを設定
   */
  setRendererSize() {
    // レンダラの大きさを設定
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  /**
   *　@@@ カメラのプロパティを設定
   */
  setCameraProps() {
    // カメラが撮影する視錐台のアスペクト比を再設定
    this.camera.aspect = window.innerWidth / window.innerHeight
    // カメラのポジションを設定して、html上の座標とcanvas上の座標値を合わせる(px単位でコントロール可能にする)
    this.camera.position.z = this.calcViewportDistance(window.innerHeight, this.camera.fov)
    // カメラのパラメータが変更されたときは行列を更新する
    this.camera.updateProjectionMatrix()
  }

  /**
   * @@@ meshのプロパティを設定
   */
  setPlaneSize() {
    // html要素のサイズを取得
    const planeSize = {
      x: this.planeElement.clientWidth,
      y: this.planeElement.clientHeight
    }

    // meshのサイズを設定
    this.plane.scale.set(
      planeSize.x,　// meshの横幅
      planeSize.y,  // meshの縦幅
      1
    )

    // シェーダ側で使用するためにuniform変数に値を設定
    this.material.uniforms.uMeshResolution.value.x = planeSize.x // シェーダ側にmeshの解像度を渡す
    this.material.uniforms.uMeshResolution.value.y = planeSize.y // シェーダ側にmeshの解像度を渡す
  }

  /**
   * @@@ 描画処理
   */
  render() {
    // レンダラーで描画
    this.renderer.render(this.scene, this.camera)
  }

  ///////////////////////////////// /Update /////////////////////////////////


  ///////////////////////////////// EventHandler /////////////////////////////////
  /**
   * @@@ リサイズのたびに呼び出したい処理実行用のメソッド
   */
  onResize() {
    this.setRendererSize() // レンダラーの大きさを設定
    this.setCameraProps() // カメラのプロパティを設定
    this.setPlaneSize() // meshのプロパティを設定
    this.setPlanePosition() // meshのポジションを設定
  }

  /**
   * @@@ マイフレーム呼び出したい処理実行用のメソッド
   */
  onRaf() {
    this.render()

    // 恒常ループの設定
    requestAnimationFrame(() => {
      this.onRaf()
    })
  }

  ///////////////////////////////// /EventHandler /////////////////////////////////


  ///////////////////////////////// Utils(外部関数かも有り) /////////////////////////////////
  /**
   * @@@ カメラの距離を計算する( html上の座標とcanvas上の座標値を合わせる )
   * ここではcanvasを表示したいエリア(今回はwindowサイズ)のことviewportと定義する
   */
  calcViewportDistance(viewportHeight, cameraFov) {
    // 1. fovの半分をラジアンに変換する
    const halfFovRad = THREE.MathUtils.degToRad(cameraFov / 2)
    // 2. viewportの高さの半分
    const halfViewportHeight = viewportHeight / 2
    // 3. カメラの距離を計算する
    const distance = halfViewportHeight / Math.tan(halfFovRad)

    // カメラの距離を返す
    return distance

    // 式をまとめると以下の通り
    // return viewportHeight * .5 / Math.tan(THREE.MathUtils.degToRad(cameraFov * .5)
  }

  ///////////////////////////////// /Utils /////////////////////////////////
}