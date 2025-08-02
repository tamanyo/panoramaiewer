'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'

interface PanoramaViewerProps {
  videoFile: File
}

export default function PanoramaViewer({ videoFile }: PanoramaViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const cameraRef = useRef<THREE.PerspectiveCamera>()
  const sphereRef = useRef<THREE.Mesh>()
  const videoRef = useRef<HTMLVideoElement>() // Three.js用（映像のみ、音声なし）
  const audioVideoRef = useRef<HTMLVideoElement>() // 音声専用
  const textureRef = useRef<THREE.VideoTexture>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [isPlaying, setIsPlaying] = useState(true)

  // マウス操作用の状態
  const mouseRef = useRef({
    isDown: false,
    previousX: 0,
    previousY: 0,
    rotationX: 0,
    rotationY: 0
  })

  useEffect(() => {
    if (!mountRef.current) return

    // シーンの初期化
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    )
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight)
    mountRef.current.appendChild(renderer.domElement)

    // 球体ジオメトリの作成（メモリ最適化版）
    const geometry = new THREE.SphereGeometry(500, 32, 16) // ポリゴン数を減らしてメモリ最適化
    geometry.scale(-1, 1, 1) // 内側から見るため反転（左右反転を防ぐ）

    // 参照を保存
    sceneRef.current = scene
    rendererRef.current = renderer
    cameraRef.current = camera

    // 映像ファイルの読み込み
    const loadVideo = async () => {
      // Three.js用ビデオ要素（映像のみ、音声なし）
      const video = document.createElement('video')
      video.crossOrigin = 'anonymous'
      video.loop = true
      video.muted = true // Three.js用は常にミュート
      video.playsInline = true
      video.preload = 'auto'
      video.controls = false
      video.setAttribute('webkit-playsinline', 'true')
      video.setAttribute('playsinline', 'true')
      
      // 音声専用ビデオ要素
      const audioVideo = document.createElement('video')
      audioVideo.crossOrigin = 'anonymous'
      audioVideo.loop = true
      audioVideo.muted = isMuted
      audioVideo.volume = volume
      audioVideo.playsInline = true
      audioVideo.preload = 'auto'
      audioVideo.controls = false
      audioVideo.style.display = 'none' // 非表示
      audioVideo.setAttribute('webkit-playsinline', 'true')
      audioVideo.setAttribute('playsinline', 'true')
      
      console.log('ビデオ要素作成完了:', { video, audioVideo })
      try {
        setIsLoading(true)
        setError(null)

        console.log('ファイル情報:', {
          name: videoFile.name,
          type: videoFile.type,
          size: videoFile.size
        })

        // ファイルが有効かチェック
        if (!videoFile || videoFile.size === 0) {
          throw new Error('無効なファイルです')
        }

        // Object URLを生成
        let videoUrl: string
        try {
          videoUrl = URL.createObjectURL(videoFile)
          console.log('生成されたURL:', videoUrl)
          
          // 両方のビデオ要素に同じURLを設定
          video.src = videoUrl
          audioVideo.src = videoUrl
        } catch (urlError) {
          console.error('URL生成エラー:', urlError)
          throw new Error('ファイルURLの生成に失敗しました')
        }

        // 既存のイベントリスナーをクリア
        video.removeEventListener('loadeddata', () => {})
        video.removeEventListener('error', () => {})
        video.removeEventListener('canplay', () => {})
        audioVideo.removeEventListener('loadeddata', () => {})
        audioVideo.removeEventListener('error', () => {})
        
        // イベントハンドラーを定義
        const handleLoadedData = () => {
          console.log('映像データの読み込み完了')
          console.log('Video ready state:', video.readyState)
          setIsLoading(false)
          
          // 音声専用ビデオに音声設定を適用
          audioVideo.volume = volume
          audioVideo.muted = isMuted
          console.log('初期音声設定適用:', { volume, muted: isMuted, audioVideoVolume: audioVideo.volume, audioVideoMuted: audioVideo.muted })
          
          // 両方のビデオを同期再生
          const playPromises = [
            video.play().catch(err => console.warn('Three.jsビデオ再生エラー:', err)),
            audioVideo.play().catch(err => console.warn('音声ビデオ再生エラー:', err))
          ]
          
          Promise.allSettled(playPromises).then(() => {
            // 再生開始後に音声設定を再適用
            setTimeout(() => {
              audioVideo.volume = volume
              audioVideo.muted = isMuted
              console.log('再生後音声設定再適用:', { 
                volume: audioVideo.volume, 
                muted: audioVideo.muted, 
                playing: !audioVideo.paused 
              })
            }, 200)
          })
        }

        const handleError = (event: Event) => {
          console.error('映像読み込みエラー:', event)
          console.error('Video error details:', {
            error: video.error,
            networkState: video.networkState,
            readyState: video.readyState,
            src: video.src
          })
          
          let errorMessage = '映像の読み込みに失敗しました'
          if (video.error) {
            switch (video.error.code) {
              case MediaError.MEDIA_ERR_ABORTED:
                errorMessage += ' (読み込みが中断されました)'
                break
              case MediaError.MEDIA_ERR_NETWORK:
                errorMessage += ' (ネットワークエラー)'
                break
              case MediaError.MEDIA_ERR_DECODE:
                errorMessage += ' (デコードエラー)'
                break
              case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                errorMessage += ' (対応していないファイル形式)'
                break
              default:
                errorMessage += ` (${video.error.message || '不明なエラー'})`
            }
          }
          
          setError(errorMessage)
          setIsLoading(false)
          
          // エラー時はURLをクリーンアップ
          if (videoUrl && videoUrl.startsWith('blob:')) {
            URL.revokeObjectURL(videoUrl)
          }
        }

        const handleCanPlay = () => {
          console.log('映像再生準備完了')
        }

        const handleLoadStart = () => {
          console.log('映像読み込み開始')
        }

        // イベントリスナーを設定
        video.addEventListener('loadeddata', handleLoadedData, { once: true })
        video.addEventListener('error', handleError, { once: true })
        video.addEventListener('canplay', handleCanPlay, { once: true })
        video.addEventListener('loadstart', handleLoadStart, { once: true })

        // タイムアウト設定（15秒後にエラー）
        const timeoutId = setTimeout(() => {
          if (video.readyState < 2) { // HAVE_CURRENT_DATA未満
            console.error('読み込みタイムアウト - readyState:', video.readyState)
            setError('映像の読み込みがタイムアウトしました')
            setIsLoading(false)
            
            // タイムアウト時もURLをクリーンアップ
            if (videoUrl && videoUrl.startsWith('blob:')) {
              URL.revokeObjectURL(videoUrl)
            }
          }
        }, 15000)

        // 成功時にタイムアウトをクリア
        video.addEventListener('loadeddata', () => {
          clearTimeout(timeoutId)
        }, { once: true })

        // URLを設定して読み込み開始
        console.log('ビデオソースを設定中...')
        video.src = videoUrl
        console.log('設定後のsrc:', video.src)
        
        // 明示的にロード開始
        video.load()
        console.log('video.load()実行完了')
        
        // ビデオ要素が準備できたらThree.jsのシーンに追加
        const setupThreeJS = () => {
          // 既存のオブジェクトをクリーンアップ
          if (sphereRef.current) {
            scene.remove(sphereRef.current)
            if (sphereRef.current.material) {
              if (Array.isArray(sphereRef.current.material)) {
                sphereRef.current.material.forEach(mat => mat.dispose())
              } else {
                sphereRef.current.material.dispose()
              }
            }
          }
          if (textureRef.current) {
            textureRef.current.dispose()
          }
          
          const videoTexture = new THREE.VideoTexture(video)
          videoTexture.minFilter = THREE.LinearFilter
          videoTexture.magFilter = THREE.LinearFilter
          videoTexture.format = THREE.RGBFormat // メモリ最適化
          videoTexture.generateMipmaps = false // メモリ最適化

          const material = new THREE.MeshBasicMaterial({ 
            map: videoTexture,
            side: THREE.FrontSide // geometry.scale(-1, 1, 1)を使用するためFrontSide
          })
          const sphere = new THREE.Mesh(geometry, material)
          scene.add(sphere)

          // カメラの初期位置
          camera.position.set(0, 0, 0)

          // 参照を更新
          sphereRef.current = sphere
          videoRef.current = video
          textureRef.current = videoTexture
          
          console.log('Three.jsシーンの設定完了')
        }
        
        // 映像が読み込まれたらThree.jsを設定
        video.addEventListener('loadeddata', setupThreeJS, { once: true })
        
        // 音声専用ビデオの参照を設定
        audioVideoRef.current = audioVideo

      } catch (err) {
        console.error('ファイル処理エラー:', err)
        setError(`ファイルの処理に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
        setIsLoading(false)
      }
    }

    loadVideo()

    // マウスイベントハンドラー
    const handleMouseDown = (event: MouseEvent) => {
      mouseRef.current.isDown = true
      mouseRef.current.previousX = event.clientX
      mouseRef.current.previousY = event.clientY
    }

    const handleMouseUp = () => {
      mouseRef.current.isDown = false
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!mouseRef.current.isDown || !cameraRef.current) return

      const deltaX = event.clientX - mouseRef.current.previousX
      const deltaY = event.clientY - mouseRef.current.previousY

      mouseRef.current.rotationY += deltaX * 0.01
      mouseRef.current.rotationX += deltaY * 0.01

      // 縦方向の回転を制限
      mouseRef.current.rotationX = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, mouseRef.current.rotationX)
      )

      // カメラの回転を適用
      cameraRef.current.rotation.order = 'YXZ'
      cameraRef.current.rotation.y = mouseRef.current.rotationY
      cameraRef.current.rotation.x = mouseRef.current.rotationX

      mouseRef.current.previousX = event.clientX
      mouseRef.current.previousY = event.clientY
    }

    // タッチイベントハンドラー（モバイル対応）
    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        mouseRef.current.isDown = true
        mouseRef.current.previousX = event.touches[0].clientX
        mouseRef.current.previousY = event.touches[0].clientY
      }
    }

    const handleTouchEnd = () => {
      mouseRef.current.isDown = false
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!mouseRef.current.isDown || !cameraRef.current || event.touches.length !== 1) return

      event.preventDefault()

      const deltaX = event.touches[0].clientX - mouseRef.current.previousX
      const deltaY = event.touches[0].clientY - mouseRef.current.previousY

      mouseRef.current.rotationY += deltaX * 0.01
      mouseRef.current.rotationX += deltaY * 0.01

      mouseRef.current.rotationX = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, mouseRef.current.rotationX)
      )

      cameraRef.current.rotation.order = 'YXZ'
      cameraRef.current.rotation.y = mouseRef.current.rotationY
      cameraRef.current.rotation.x = mouseRef.current.rotationX

      mouseRef.current.previousX = event.touches[0].clientX
      mouseRef.current.previousY = event.touches[0].clientY
    }

    // イベントリスナーの追加
    const canvas = renderer.domElement
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd)
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })

    // リサイズハンドラー
    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return

      const width = mountRef.current.clientWidth
      const height = mountRef.current.clientHeight

      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    window.addEventListener('resize', handleResize)

    window.addEventListener('keydown', handleKeyDown)

    // アニメーションループ（メモリ最適化版）
    let animationId: number
    let lastTime = 0
    const targetFPS = 60
    const frameInterval = 1000 / targetFPS
    
    const animate = (currentTime: number) => {
      animationId = requestAnimationFrame(animate)
      
      // FPS制限でメモリ使用量を抑制
      if (currentTime - lastTime >= frameInterval) {
        // VideoTextureの更新を再生状態に応じて制御
        if (textureRef.current && videoRef.current) {
          if (isPlaying && !videoRef.current.paused) {
            textureRef.current.needsUpdate = true
          }
        }
        
        if (renderer && scene && camera) {
          renderer.render(scene, camera)
        }
        lastTime = currentTime
      }
    }
    animate(0)



    // クリーンアップ
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchend', handleTouchEnd)
      canvas.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyDown)
      
      // アニメーションループを停止
      if (animationId) {
        cancelAnimationFrame(animationId)
      }

      // 参照からvideo要素を取得してクリーンアップ
      if (videoRef.current) {
        const video = videoRef.current
        video.pause()
        const currentSrc = video.src
        video.src = ''
        video.load()
        
        // Object URLをクリーンアップ
        if (currentSrc && currentSrc.startsWith('blob:')) {
          URL.revokeObjectURL(currentSrc)
        }
      }
      
      // 音声専用ビデオのクリーンアップ
      if (audioVideoRef.current) {
        const audioVideo = audioVideoRef.current
        audioVideo.pause()
        audioVideo.src = ''
        audioVideo.load()
      }

      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement)
      }

      if (rendererRef.current) {
        rendererRef.current.dispose()
      }

      if (geometry) {
        geometry.dispose()
      }

      // 参照からmaterialを取得してクリーンアップ
      if (sphereRef.current) {
        const material = sphereRef.current.material
        if (material) {
          if (Array.isArray(material)) {
            material.forEach(mat => {
              if (mat && typeof mat.dispose === 'function') {
                mat.dispose()
              }
            })
          } else if (typeof material.dispose === 'function') {
            material.dispose()
          }
        }
      }

      // 参照からvideoTextureを取得してクリーンアップ
      if (textureRef.current) {
        textureRef.current.dispose()
      }
    }
  }, [videoFile])

  // 音声設定専用のuseEffect（音声専用ビデオ要素を使用）
  useEffect(() => {
    console.log('音声設定useEffect実行:', { volume, isMuted, audioVideoExists: !!audioVideoRef.current })
    if (audioVideoRef.current) {
      const audioVideo = audioVideoRef.current
      console.log('設定前の音声状態:', { 
        currentVolume: audioVideo.volume, 
        currentMuted: audioVideo.muted,
        readyState: audioVideo.readyState 
      })
      
      // 音量とミュートを強制的に設定
      try {
        audioVideo.volume = volume
        audioVideo.muted = isMuted
        
        // ブラウザの制限を回避するため、再度設定を試行
        setTimeout(() => {
          if (audioVideo && !audioVideo.paused) {
            audioVideo.volume = volume
            audioVideo.muted = isMuted
            console.log('遅延音声設定適用:', { volume: audioVideo.volume, muted: audioVideo.muted })
          }
        }, 100)
        
        console.log('設定後の音声状態:', { 
          newVolume: audioVideo.volume, 
          newMuted: audioVideo.muted,
          targetVolume: volume,
          targetMuted: isMuted,
          paused: audioVideo.paused,
          currentTime: audioVideo.currentTime
        })
      } catch (error) {
        console.error('音声設定エラー:', error)
      }
    }
  }, [volume, isMuted])

  // 音量変更ハンドラー（状態更新のみ、useEffectで実際の音量設定）
  const handleVolumeChange = (newVolume: number) => {
    console.log('音量変更ハンドラー:', { 
      oldVolume: volume, 
      newVolume, 
      videoExists: !!videoRef.current,
      currentVideoVolume: videoRef.current?.volume
    })
    setVolume(newVolume)
  }

  // ミュート切り替えハンドラー（状態更新のみ、useEffectで実際のミュート設定）
  const toggleMute = () => {
    const newMutedState = !isMuted
    console.log('ミュート切り替えハンドラー:', { 
      oldMuted: isMuted, 
      newMuted: newMutedState, 
      videoExists: !!videoRef.current,
      currentVideoMuted: videoRef.current?.muted
    })
    setIsMuted(newMutedState)
  }

  // 再生/一時停止ハンドラー（useCallbackで最新の状態を参照）
  const togglePlayPause = useCallback(() => {
    const newPlayingState = !isPlaying
    setIsPlaying(newPlayingState)
    
    if (videoRef.current && audioVideoRef.current) {
      if (newPlayingState) {
        videoRef.current.play().catch(console.warn)
        audioVideoRef.current.play().catch(console.warn)
        console.log('再生開始')
        
        // VideoTextureの更新を再開
        if (textureRef.current) {
          textureRef.current.needsUpdate = true
        }
      } else {
        videoRef.current.pause()
        audioVideoRef.current.pause()
        console.log('一時停止')
        
        // VideoTextureの更新を停止（最後のフレームで固定）
        if (textureRef.current) {
          textureRef.current.needsUpdate = false
        }
      }
    }
  }, [isPlaying])

  // スペースキーイベントハンドラー（useCallbackで最新の状態を参照）
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Space') {
      event.preventDefault()
      console.log('スペースキー押下:', {
        isPlaying: isPlaying,
        activeElement: document.activeElement?.tagName,
        videoExists: !!videoRef.current,
        audioExists: !!audioVideoRef.current
      })
      
      // フォーカスされた要素がボタンでない場合のみトグル実行
      const activeElement = document.activeElement
      if (!activeElement || activeElement.tagName !== 'BUTTON') {
        console.log('togglePlayPause実行中...')
        togglePlayPause()
      } else {
        console.log('ボタンにフォーカスがあるためスキップ')
      }
    }
  }, [isPlaying, togglePlayPause])

  // キーイベント管理用のuseEffect
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return (
    <div className="relative w-full h-96 lg:h-[600px]">
      <div
        ref={mountRef}
        className="w-full h-full viewer-container cursor-grab active:cursor-grabbing"
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-90">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">映像を読み込み中...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-100 bg-opacity-90">
          <div className="text-center text-red-600">
            <p className="text-lg font-semibold">エラー</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded text-sm">
        マウスドラッグまたはタッチで視点を変更
      </div>

      {/* メディアコントロール */}
      <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white p-3 rounded-lg">
        <div className="flex items-center space-x-3">
          {/* 再生/一時停止ボタン */}
          <button
            onClick={togglePlayPause}
            className="hover:bg-white hover:bg-opacity-20 p-2 rounded transition-colors"
            title={isPlaying ? '一時停止 (Space)' : '再生 (Space)'}
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* ミュートボタン */}
          <button
            onClick={toggleMute}
            className="hover:bg-white hover:bg-opacity-20 p-2 rounded transition-colors"
            title={isMuted ? '音声をオン' : '音声をオフ'}
          >
            {isMuted ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L4.414 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.414l3.969-3.816a1 1 0 011.617.816zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L4.414 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.414l3.969-3.816a1 1 0 011.617.816zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* 音量スライダー */}
          <div className="flex items-center space-x-2">
            <span className="text-xs">音量</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-20 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              disabled={isMuted}
            />
            <span className="text-xs w-8">{Math.round(volume * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
