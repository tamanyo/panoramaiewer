'use client'

import { useState, useCallback } from 'react'

interface DropZoneProps {
  onFileSelect: (file: File) => void
}

export default function DropZone({ onFileSelect }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    const videoFile = files.find(file => 
      file.type.startsWith('video/') || 
      file.name.toLowerCase().match(/\.(mp4|webm|mov|avi|mkv)$/)
    )

    if (videoFile) {
      onFileSelect(videoFile)
    } else {
      alert('対応していないファイル形式です。MP4、WebM、MOVファイルを選択してください。')
    }
  }, [onFileSelect])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }, [onFileSelect])

  return (
    <div
      className={`drop-zone p-16 text-center border-2 border-dashed rounded-lg transition-all duration-300 ${
        isDragOver 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-300 hover:border-gray-400'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="space-y-6">
        <div className="text-6xl text-gray-400">
          📹
        </div>
        
        <div>
          <h3 className="text-2xl font-semibold text-gray-700 mb-2">
            360度映像をドロップしてください
          </h3>
          <p className="text-gray-500">
            または下のボタンからファイルを選択
          </p>
        </div>

        <div>
          <label className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg cursor-pointer transition-colors">
            ファイルを選択
            <input
              type="file"
              accept="video/*,.mp4,.webm,.mov,.avi,.mkv"
              onChange={handleFileInput}
              className="hidden"
            />
          </label>
        </div>

        <div className="text-sm text-gray-400">
          対応形式: MP4, WebM, MOV, AVI, MKV
        </div>
      </div>
    </div>
  )
}
