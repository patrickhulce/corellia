import Image from 'next/image'
import {ConnectedAccountType} from '@/lib/types'
import type {LucideProps} from 'lucide-react'

interface BrandIconProps extends Omit<LucideProps, 'ref' | 'size'> {
  brand: ConnectedAccountType
}

const iconMap: Record<ConnectedAccountType, string> = {
  google: '/logos/google.svg',
  target: '/logos/target.svg',
  amazon: '/logos/amazon.svg',
  costco: '/logos/costco.svg',
}

export function BrandIcon({brand, className}: BrandIconProps) {
  let {width, height} = {width: 24, height: 24}
  if (brand === ConnectedAccountType.COSTCO) {
    width = 201
    height = 72
  }
  return (
    <Image
      src={iconMap[brand]}
      alt={`${brand} logo`}
      className={className}
      width={width}
      height={height}
    />
  )
}
