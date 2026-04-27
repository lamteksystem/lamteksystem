import { useTheme } from '@/contexts/ThemeContext'

type BrandLogoProps = {
  className?: string
  alt?: string
}

export default function BrandLogo({ className, alt = 'Lamtek' }: BrandLogoProps) {
  const { resolvedTheme } = useTheme()
  const src = resolvedTheme === 'dark' ? '/marketing/logo-on-dark.png' : '/marketing/logo-on-light.png'
  return <img src={src} alt={alt} className={className} referrerPolicy="no-referrer" />
}
