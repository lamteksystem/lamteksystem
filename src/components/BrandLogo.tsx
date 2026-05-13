import { useTheme } from '@/contexts/ThemeContext'
import { publicAsset } from '@/lib/basePath'

type BrandLogoProps = {
  className?: string
  alt?: string
}

export default function BrandLogo({ className, alt = 'Lamtek' }: BrandLogoProps) {
  const { resolvedTheme } = useTheme()
  const src =
    resolvedTheme === 'dark' ? publicAsset('marketing/logo-on-dark.png') : publicAsset('marketing/logo-on-light.png')
  return <img src={src} alt={alt} className={className} referrerPolicy="no-referrer" />
}
