import { useEffect, useState } from 'react'

function getPixel(data, index) {
  return {
    r: data[index],
    g: data[index + 1],
    b: data[index + 2],
    a: data[index + 3],
  }
}

function colorDistance(first, second) {
  return Math.hypot(first.r - second.r, first.g - second.g, first.b - second.b)
}

function shouldRemove(pixel, background) {
  const lightness = (pixel.r + pixel.g + pixel.b) / 3
  const chroma = Math.max(pixel.r, pixel.g, pixel.b) - Math.min(pixel.r, pixel.g, pixel.b)

  return (
    pixel.a > 0 &&
    lightness > 178 &&
    chroma < 38 &&
    colorDistance(pixel, background) < 58
  )
}

function estimateBackground(data, width, height) {
  const cornerIndexes = [
    0,
    (width - 1) * 4,
    (width * (height - 1)) * 4,
    (width * height - 1) * 4,
  ]
  const colors = cornerIndexes.map((index) => getPixel(data, index))

  return colors.reduce(
    (total, color) => ({
      r: total.r + color.r / colors.length,
      g: total.g + color.g / colors.length,
      b: total.b + color.b / colors.length,
      a: total.a + color.a / colors.length,
    }),
    { r: 0, g: 0, b: 0, a: 0 },
  )
}

function removeEdgeBackground(source) {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const width = image.naturalWidth
      const height = image.naturalHeight

      if (!width || !height) {
        resolve(source)
        return
      }

      canvas.width = width
      canvas.height = height

      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) {
        resolve(source)
        return
      }

      context.drawImage(image, 0, 0)
      const imageData = context.getImageData(0, 0, width, height)
      const { data } = imageData
      const background = estimateBackground(data, width, height)
      const visited = new Uint8Array(width * height)
      const queue = []

      const enqueue = (x, y) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return

        const pixelIndex = y * width + x
        if (visited[pixelIndex]) return

        const dataIndex = pixelIndex * 4
        if (!shouldRemove(getPixel(data, dataIndex), background)) return

        visited[pixelIndex] = 1
        queue.push([x, y])
      }

      for (let x = 0; x < width; x += 1) {
        enqueue(x, 0)
        enqueue(x, height - 1)
      }

      for (let y = 0; y < height; y += 1) {
        enqueue(0, y)
        enqueue(width - 1, y)
      }

      while (queue.length) {
        const [x, y] = queue.shift()
        const dataIndex = (y * width + x) * 4
        data[dataIndex + 3] = 0

        enqueue(x + 1, y)
        enqueue(x - 1, y)
        enqueue(x, y + 1)
        enqueue(x, y - 1)
      }

      context.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    image.onerror = () => resolve(source)
    image.src = source
  })
}

export function MapMarkerLogo({ src, alt }) {
  const [processedSrc, setProcessedSrc] = useState(src)

  useEffect(() => {
    let cancelled = false

    if (!src) return undefined

    removeEdgeBackground(src).then((nextSrc) => {
      if (!cancelled) setProcessedSrc(nextSrc)
    })

    return () => {
      cancelled = true
    }
  }, [src])

  if (!src) return null

  return <img src={processedSrc} alt={alt} />
}
