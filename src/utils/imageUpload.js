function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error('Unable to read image.')))
    image.src = src
  })
}

export async function readOptimizedImageFile(
  file,
  {
    maxWidth = 2000,
    maxHeight = 2000,
    quality = 0.84,
    preferJpeg = false,
  } = {},
) {
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl)
    const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height)
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')

    context.drawImage(image, 0, 0, width, height)

    const useJpeg = preferJpeg || !file.type.includes('png')
    return canvas.toDataURL(useJpeg ? 'image/jpeg' : 'image/png', useJpeg ? quality : undefined)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
