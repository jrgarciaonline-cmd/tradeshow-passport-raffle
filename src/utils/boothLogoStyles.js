export function getBoothLogoFrameStyle(booth) {
  const logoColor = booth?.logoColor || booth?.color || '#007b70'

  return {
    backgroundColor: booth?.logoBackgroundColor || '#ffffff',
    color: logoColor,
    '--logo-bg': logoColor,
  }
}
