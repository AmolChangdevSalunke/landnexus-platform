import { Link, type LinkProps } from 'react-router-dom'
import type { ReactNode } from 'react'
import { buttonStyles, type ButtonSize, type ButtonVariant } from './Button'

export interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: ReactNode
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  leftIcon,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link className={buttonStyles(variant, size, className)} {...rest}>
      {leftIcon}
      {children}
    </Link>
  )
}
