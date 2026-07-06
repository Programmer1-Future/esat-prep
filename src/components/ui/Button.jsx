import { cn } from '../../lib/utils'

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  onClick,
  type = 'button',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center font-body font-500 rounded-lg transition-all duration-200 ease-out cursor-pointer select-none'

  const variants = {
    primary:
      'bg-accent text-on-accent hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed',
    secondary:
      'bg-surface-raised border border-border text-text-primary hover:border-accent/40 hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed',
    ghost:
      'text-text-secondary hover:text-text-primary hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed',
    danger:
      'bg-danger/10 border border-danger/25 text-danger hover:border-danger disabled:opacity-40 disabled:cursor-not-allowed',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-2.5 text-base gap-2',
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  )
}
