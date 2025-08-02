'use client'

import { useState } from 'react'
import PanoramaViewer from '@/components/PanoramaViewer'
import DropZone from '@/components/DropZone'

export default function Home() {
  const [videoFile, setVideoFile] = useState<File | null>(null)

  const handleFileSelect = (file: File) => {
    setVideoFile(file)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-700 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white text-center mb-8">
          360度映像ビューワー
        </h1>
        
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
          {!videoFile ? (
            <DropZone onFileSelect={handleFileSelect} />
          ) : (
            <div className="relative">
              <PanoramaViewer videoFile={videoFile} />
              <button
                onClick={() => setVideoFile(null)}
                className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors z-10"
              >
                映像を変更
              </button>
            </div>
          )}
        </div>
        
        <div className="mt-8 text-center text-gray-300">
          <p className="text-lg">
            360度映像ファイルをドラッグ＆ドロップして開始してください
          </p>
          <p className="text-sm mt-2">
            対応形式: MP4, WebM, MOV
          </p>
        </div>
      </div>
    </main>
  )
}
