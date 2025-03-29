// 02 ======================================================================
// 全項で作成したプログラムをベースに、ユーザーイベントに合わせたインタラクション（演出）を追加する

// ▼ ポイント
// 1. ユーザーイベントの追加とインタラクション連携:
// ・	html要素にマウスオーバー・アウト時のイベントを追加し、イベントをトリガーにuniform変数を操作してmeshのマテリアルを変更する
// ・	uniform変数の値の操作には、gsapを使用してアニメーションを追加する

// 2. スムーススクロールと座標値の同期:
// ・	スクロールの値を取得して、meshの位置をスクロールに合わせて変更する

// 3. スクロール差分の取得と利用:
// ・	前フレームからのスクロールの差分を取得して、その値をuniform変数に設定することで、スクロールの差分をシェーダ側で利用する

// 4. スクロールによるカーブエフェクトの実装:
// ・	スクロールの差分を利用して、VertexShaderから板ポリの頂点座標を操作することで、カーブエフェクトを実装する

// 5. テクスチャエフェクト:
// ・	マウスオーバー時に変更されるuniform変数を利用して、テクスチャの切り替えやテクスチャのスケール変更をFragmentShaderで行う

// ============================================================================

import {WebGLUtility} from '../lib/webgl.js';　// WebGLUtilityの読み込み(杉本さん作)
import * as THREE from '../lib/three.module.js';　// three.js の読み込み

import GUI from '../lib/lil-gui.min.js'; // GUI ライブラリの読み込み( https://lil-gui.georgealways.com/ )
import Lenis from '../lib/lenis.js'; // スムーススクロールライブラリの読み込み( https://github.com/darkroomengineering/lenis )
import {gsap} from '../lib/gsap/index.js'; // アニメーションライブラリの読み込み( https://gsap.com/ )

window.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.querySelector('#webgl')
  const thumbElements = document.querySelectorAll('.thumb')
  const linkElements = document.querySelectorAll('.link')

  const app = new ThreeApp(wrapper, thumbElements, linkElements)

  app.init()
}, false)

class ThreeApp {
  /**
   * カメラ定義のための定数
   */
  static CAMERA_PARAM = {
    fovy: 60,
    near: 0.1,
    far: 10000,
    position: new THREE.Vector3(0.0, 0.0, 0.0),
    lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
  };
  /**
   * レンダラー定義のための定数
   */
  static RENDERER_PARAM = {
    clearColor: 0xffffff,
    transparent: 0,　// 背景透過
  };
  /**
   * マテリアル定義のための定数
   */
  static MATERIAL_PARAM = {
    shaderSourcePath: {
      vertexShader: './shaders/index.vert',　// シェーダのパスを指定
      fragmentShader: './shaders/index.frag'　// シェーダのパスを指定
    },
    uniforms: {
      curveStrength: 0.05,
      curveMax: 0.7,
      curveMin:-0.7,
    }
  };

  renderer;　// レンダラ
  scene;　// シーン
  camera;　// カメラ
  planes;　// mesh(今回は複数のmesh)を格納する配列

  wrapper;　// canvas の親要素
  thumbElements;　// meshと情報を同期するためのhtml要素
  linkElements;　// ホバーイベントを設定するためのhtml要素

  shaderSource = {
    vertexShader: null, // 頂点シェーダ
    fragmentShader: null // フラグメントシェーダ
  };

  scroll // スクロールの値
  scrollDiff // スクロールの差分
  scrollPrev // 前フレームのスクロールの値

  /**
   * コンストラクタ
   * @constructor
   * @param {HTMLElement} wrapper - canvas 要素を append する親要素
   * @param {NodeList} thumbElements - meshと情報を同期する要素
   * @param {NodeList} linkElements - ホバーイベントを設定する要素
   */
  constructor(wrapper, thumbElements, linkElements) {
    this.wrapper = wrapper
    this.thumbElements = thumbElements
    this.linkElements = linkElements
  }


  ///////////////////////////////// Setup /////////////////////////////////
  /**
   * @@@ 初期化処理
   */
  init() {
    this.load().then(() => {
      this.setup() // 初回セットアップ処理

      // レンダラー、カメラ、meshのプロパティを設定( リサイズ時にも呼び出す関数群なのでonResize関数にまとめています )
      this.setRendererSize() // レンダラーのプロパティを設定
      this.setCameraProps() // カメラのプロパティを設定
      this.setPlaneSize() // meshのプロパティを設定
      this.setPlanePosition() // meshの位置を設定

      // @@@ smooth scrollを追加
      this.lenis = new Lenis()

      this.addEventListeners() // イベントリスナーの追加
      this.addGUI() // GUIの追加

      // 準備完了次第、恒常ループを開始
      this.start() // レンダラーの描画を開始
    })
  }

  /**
   * @@@ リソースの読み込み
   * @returns {Promise<unknown>}
   */
  async load() {
    return new Promise(async (resolve, reject) => {
      this.shaderSource.vertexShader = await WebGLUtility.loadFile(ThreeApp.MATERIAL_PARAM.shaderSourcePath.vertexShader)
      this.shaderSource.fragmentShader = await WebGLUtility.loadFile(ThreeApp.MATERIAL_PARAM.shaderSourcePath.fragmentShader)
      resolve()
    })
  }

  /**
   * @@@ 初期化処理
   */
  setup() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
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


    // 各種ジオメトリからメッシュを生成し、シーンに追加する
    // セグメント数が多いほど、メッシュが滑らかになる
    const planeGeometry = new THREE.PlaneGeometry(
      1, // 板ポリのサイズは後からscaleで調整するので、とりあえず1を設定
      1, // 板ポリのサイズは後からscaleで調整するので、とりあえず1を設定
      16, // 板ポリのX上の分割数
      16　// 板ポリのY上の分割数
    )

    // サムネイルの数だけ板ポリを生成
    this.planes = []

    const textureLoader = new THREE.TextureLoader()

    // サムネイルの数だけmeshを生成
    this.thumbElements.forEach((element, index) => {

      // マテリアル毎に設定する uniform 変数の内容が違うので、mesh毎にマテリアルを生成する
      const material = new THREE.RawShaderMaterial({
        vertexShader: this.shaderSource.vertexShader,
        fragmentShader: this.shaderSource.fragmentShader,
        wireframe: false,
        uniforms: {
          uMeshResolution: {
            value: {
              x: element.clientWidth,　// サムネイルの幅（リサイズ時に変更するが、初期値として設定）
              y: element.clientHeight　// サムネイルの高さ（リサイズ時に変更するが、初期値として設定）
            }
          },
          uTexture: {
            value: null　// テクスチャ読み込み後に設定
          },
          uTextureResolution: {
            value: {
              x: 1,　// テクスチャの幅（テクスチャ読み込み後に変更するが、初期値として設定）
              y: 1　 // テクスチャの高さ（テクスチャ読み込み後に変更するが、初期値として設定）
            }
          },
          uTextureOn: {
            value: null　// テクスチャ読み込み後に設定
          },
          uTextureResolutionOn: {
            value: {
              x: 1,　// テクスチャの幅（テクスチャ読み込み後に変更するが、初期値として設定）
              y: 1　 // テクスチャの高さ（テクスチャ読み込み後に変更するが、初期値として設定）
            }
          },
          uScrollDiff: {
            value: 0
          },
          uTextureTransitionProgress: {
            value: 0
          },
          uTextureOnScaleProgress: {
            value: 0
          },
          uCureStrength:{
            value: ThreeApp.MATERIAL_PARAM.uniforms.curveStrength
          },
          uCurveMax:{
            value: ThreeApp.MATERIAL_PARAM.uniforms.curveMax
          },
          uCurveMin:{
            value: ThreeApp.MATERIAL_PARAM.uniforms.curveMin
          }
        }
      })

      // html要素に設定されたdata属性からテクスチャのパスを取得
      const textureSrc = element.dataset['textureSrc']
      const textureOnSrc = element.dataset['textureOnSrc']

      // テクスチャを読み込んでマテリアルに設定
      textureLoader.load(textureSrc, (texture) => {
        material.uniforms.uTexture.value = texture
        material.uniforms.uTextureResolution.value = new THREE.Vector2(texture.image.width, texture.image.height)
      })

      textureLoader.load(textureOnSrc, (texture) => {
        material.uniforms.uTextureOn.value = texture
        material.uniforms.uTextureResolutionOn.value = new THREE.Vector2(texture.image.width, texture.image.height)
      })

      this.planes[index] = new THREE.Mesh(planeGeometry, material)

      // meshに対応するhtml要素をプロパティとして保持
      this.planes[index].thumbElement = element // 対象のhtml要素を保持

      // 対象のhtml要素の透明度を設定(meshを表示するので、html要素は透明にしておく
      this.planes[index].thumbElement.style.opacity = '0'
      this.planes[index].thumbElement.style.pointerEvents = 'none'　// 対象のhtml要素のマウスイベントを無効化

      this.scene.add(this.planes[index])
    })
  }

  /**
   * レンダラーの描画を開始
   */
  start() {
    requestAnimationFrame((time) => {
      this.onRaf(time)
    })
  }

  /**
   * @@@ イベントリスナーを追加
   */
  addEventListeners() {
    // リサイズイベント
    window.addEventListener('resize', () => {
      this.onResize()
    }, false)

    // マウスオーバー・アウト時のイベントを追加
    this.linkElements.forEach((element, index) => {
      element.addEventListener('mouseenter', () => {
        this.onMouseEnter(element, index)
      })

      element.addEventListener('mouseleave', () => {
        this.onMouseLeave(element, index)
      })
    })
  }

  /**
   * GUIの追加
   */
  addGUI() {
    this.gui = new GUI()

    const planeFolder = this.gui.addFolder('plane')

    const guiProps = {
      useWireframe: false
    }

    planeFolder.add(guiProps, 'useWireframe').name('wireframe').onChange(() => {
      this.planes.forEach(plane => {
        plane.material.wireframe = guiProps.useWireframe
      })
    })
    planeFolder.add(ThreeApp.MATERIAL_PARAM.uniforms, 'curveStrength').name('curveStrength').min(-0.2).max(0.2).step(0.01).onChange(() => {
      this.planes.forEach(plane => {
        plane.material.uniforms.uCureStrength.value = ThreeApp.MATERIAL_PARAM.uniforms.curveStrength
      })
    })
    planeFolder.add(ThreeApp.MATERIAL_PARAM.uniforms, 'curveMax').name('curveMax').min(-10).max(10).step(0.01).onChange(() => {
      this.planes.forEach(plane => {
        plane.material.uniforms.uCurveMax.value = ThreeApp.MATERIAL_PARAM.uniforms.curveMax
      })
    })
    planeFolder.add(ThreeApp.MATERIAL_PARAM.uniforms, 'curveMin').name('curveMin').min(-10).max(10).step(0.01).onChange(() => {
      this.planes.forEach(plane => {
        plane.material.uniforms.uCurveMin.value = ThreeApp.MATERIAL_PARAM.uniforms.curveMin
      })
    })
  }

  ///////////////////////////////// /Setup //////////////////////////////


  ///////////////////////////////// Update /////////////////////////////////
  /**
   * @@@　meshのポジションを設定する
   * @@@　スクロールの値によって、meshの位置を変更する
   */
  setPlanePosition() {
    const rendererSize = {
      width: this.renderer.domElement.width,
      height: this.renderer.domElement.height
    }

    // meshの位置を設定
    this.planes.forEach((plane) => {
      const meshOrigin = {
        // 中央から、canvasの横幅の半分を引いて、meshの横幅の半分を足した値をx座標に設定（左に寄せる）
        x: -rendererSize.width / 2 + plane.scale.x / 2,
        // 中央から、canvasの縦幅の半分を足して、meshの縦幅の半分を引いた値をy座標に設定（上に寄せる）
        y: rendererSize.height / 2 - plane.scale.y / 2
      }

      const planeElementPosition = {
        x: plane.thumbElement.offsetLeft,　// html要素のx座標を取得
        y: plane.thumbElement.offsetTop // html要素のy座標を取得
      }

      // meshの位置を設定
      const x = meshOrigin.x + planeElementPosition.x;
      const y = meshOrigin.y - planeElementPosition.y + this.scroll; // スクロールの値を加算

      plane.position.set(x, y, 0)
      plane.material.uniforms.uScrollDiff.value = this.scrollDiff || 0 // スクロールの差分をuniform変数に設定
    })
  }

  /**
   * レンダラーのプロパティを設定
   */
  setRendererSize() {
    // レンダラの大きさを設定
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  /**
   * カメラのプロパティを設定
   */
  setCameraProps() {
    // カメラが撮影する視錐台のアスペクト比を再設定
    this.camera.aspect = window.innerWidth / window.innerHeight

    // カメラのポジションを設定して、html上の座標とcanvas上の座標値を合わせる(px単位でコントロール可能にする)
    this.camera.position.z = this.calcViewportDistance(window.innerHeight, this.camera.fov)

    // カメラのパラメータが変更されたときは行列を更新する
    // ※なぜ行列の更新が必要なのかについては、将来的にもう少し詳しく解説します
    this.camera.updateProjectionMatrix()
  }

  /**
   * @@@ meshのプロパティを設定
   */
  setPlaneSize() {
    // サムネイルのサイズに合わせてmeshのサイズを変更
    this.planes.forEach(plane => {
      // 対象のhtml要素のサイズを取得
      const planeSize = {
        x: plane.thumbElement.clientWidth,
        y: plane.thumbElement.clientHeight
      }

      // meshのサイズを設定
      plane.scale.set(
        planeSize.x, // meshの横幅
        planeSize.y, // meshの縦幅
        1
      )

      // シェーダ側で使用するためにuniform変数に値を設定
      plane.material.uniforms.uMeshResolution.value.x = planeSize.x // シェーダ側で使用するためにuniform変数に値を設定
      plane.material.uniforms.uMeshResolution.value.y = planeSize.y // シェーダ側で使用するためにuniform変数に値を設定
    })
  }

  /**
   * 描画処理
   */
  render() {
    this.renderer.render(this.scene, this.camera)　// レンダラーで描画
  }

  ///////////////////////////////// EventHandler /////////////////////////////////
  /**
   * リサイズのたびに呼び出したい処理
   */
  onResize() {
    this.setRendererSize() // レンダラーの大きさを設定
    this.setCameraProps() // カメラのプロパティを設定
    this.setPlaneSize() // meshのプロパティを設定
    this.setPlanePosition() // meshのポジションを設定
  }

  /**
   * @@@ マイフレーム呼び出したい処理実行用のメソッド
   * @param time - マイフレームのタイムスタンプ
   */
  onRaf(time = 0) {
    // スムーススクロールの更新
    this.lenis.raf(time)

    this.scroll = window.scrollY　// scrollの値を取得
    this.scrollDiff = this.scroll - this.scrollPrev　// 前フレームのscrollとの差分を計算

    // meshの位置を設定
    this.setPlanePosition()　

    // 描画処理
    this.render()

    this.scrollPrev = this.scroll　// マイフレーム差分計算用のscrollの値を更新

    // 恒常ループの設定
    requestAnimationFrame((time) => {
      this.onRaf(time)
    })
  }

  /**
   * @@@ マウスオーバー時の処理
   * @param element - html要素
   * @param index - meshのインデックス
   */
  onMouseEnter(element, index) {
    // html要素の透明度を変更
    gsap.to(element, {
      opacity: 1,
      duration: 0.175
    })

    // meshのマウスオーバー時のアニメーション
    gsap.to(this.planes[index].material.uniforms.uTextureTransitionProgress, {
      value: 1,
      duration: 0.6,
      ease: 'cubic.out'
    })

    gsap.to(this.planes[index].material.uniforms.uTextureOnScaleProgress, {
      value: 1,
      duration: 1.2,
      ease: 'quart.out'
    })

  }

  /**
   * @@@ マウスアウト時の処理
   * @param element - html要素
   * @param index - meshのインデックス
   */
  onMouseLeave(element, index) {
    // html要素の透明度を変更
    gsap.to(element, {
      opacity: 0.3,
      ease: 'none',
      duration: 0.5
    })


    // meshのマウスアウト時のアニメーション
    gsap.to(this.planes[index].material.uniforms.uTextureTransitionProgress, {
      value: 0,
      duration: 0.6,
      ease: 'cubic.out'
    })

    gsap.to(this.planes[index].material.uniforms.uTextureOnScaleProgress, {
      value: 0,
      duration: 1.2,
      ease: 'quart.out'
    })
  }

  ///////////////////////////////// /EventHandler /////////////////////////////////


  ///////////////////////////////// Utils /////////////////////////////////
  /**
   * カメラの距離を計算する( html上の座標とcanvas上の座標値を合わせる )
   */
  calcViewportDistance(viewportHeight, cameraFov) {
    // 1. fovの半分をラジアンに変換する
    const halfFovRad = THREE.MathUtils.degToRad(cameraFov / 2)
    // 2. viewportの高さの半分
    const halfViewportHeight = viewportHeight / 2
    // カメラの距離を返す
    return halfViewportHeight / Math.tan(halfFovRad)
  }

  ///////////////////////////////// /Utils /////////////////////////////////
}