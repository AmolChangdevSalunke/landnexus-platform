import logoUrl from '../../assets/landnexus-logo.png'
import { APP_NAME, APP_TAGLINE } from '../../utils/strings'
import { cn } from '../../utils/cn'

type BrandTone = 'on-light' | 'on-dark'
type BrandOrientation = 'horizontal' | 'stacked'
type BrandSize = 'sm' | 'md' | 'lg'

const SIZES: Record<
  BrandSize,
  {
    logo: string
    name: string
    tagline: string
    gap: string
  }
> = {
  sm: {
    logo: 'h-12 w-12',
    name: 'text-sm',
    tagline: 'text-[9px] leading-4',
    gap: 'gap-3',
  },
  md: {
    logo: 'h-14 w-14',
    name: 'text-xl',
    tagline: 'text-[11px] leading-4',
    gap: 'gap-4',
  },
  lg: {
    logo: 'h-40 w-40',
    name: 'text-5xl',
    tagline: 'text-sm leading-6',
    gap: 'gap-7',
  },
}

const TONES: Record<BrandTone, { name: string; tagline: string }> = {
  'on-light': { name: 'text-navy-900', tagline: 'text-slate-500' },
  'on-dark': { name: 'text-white', tagline: 'text-slate-300' },
}

export interface BrandLockupProps {
  tone?: BrandTone
  orientation?: BrandOrientation
  size?: BrandSize
  centered?: boolean
  showTagline?: boolean
  className?: string
}

/**
 * Logo + application name lockup.
 *
 * Replace `src/assets/landnexus-logo.png` to change the logo. The logo is shown
 * with a transparent background; a soft glow keeps it legible on the navy header.
 */
export function BrandLockup({
  tone = 'on-light',
  orientation = 'horizontal',
  size = 'md',
  centered = false,
  showTagline = true,
  className,
}: BrandLockupProps) {
  const sizing = SIZES[size]
  const colors = TONES[tone]
  const stacked = orientation === 'stacked'

  return (
    <div
      className={cn(
        'flex min-w-0',
        stacked ? 'flex-col' : 'items-center',
        sizing.gap,
        centered ? 'items-center text-center' : stacked ? 'items-start' : 'items-center',
        className,
      )}
    >
      <span
        className={cn(
          'relative flex shrink-0 items-center justify-center',
          sizing.logo,
        )}
      >
        {tone === 'on-dark' ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.22),transparent_70%)] blur-xl"
          />
        ) : null}
        <img
          src={logoUrl}
          alt={`${APP_NAME} logo`}
          className="relative h-full w-full object-contain"
          style={
            tone === 'on-dark'
              ? {
                  filter:
                    'brightness(1.35) contrast(1.15) saturate(1.15) drop-shadow(0 0 10px rgba(255,255,255,0.55)) drop-shadow(0 0 24px rgba(255,255,255,0.28))',
                }
              : undefined
          }
          decoding="async"
        />
      </span>

      <span className={cn('min-w-0', stacked && centered ? 'max-w-md' : undefined)}>
        <span
          className={cn(
            'block font-bold tracking-tight',
            sizing.name,
            colors.name,
            stacked && centered ? 'text-center' : undefined,
          )}
        >
          {APP_NAME}
        </span>
        {showTagline ? (
          <span
            className={cn(
              'mt-1 block font-medium tracking-[0.04em]',
              sizing.tagline,
              colors.tagline,
              stacked && centered ? 'text-center' : undefined,
            )}
          >
            {APP_TAGLINE}
          </span>
        ) : null}
      </span>
    </div>
  )
}
