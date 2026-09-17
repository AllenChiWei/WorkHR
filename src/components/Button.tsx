import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'md' | 'lg' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** 載入中時自動 disable，並把文字換成提示。 */
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-ink-invert hover:bg-brand-strong active:bg-brand-strong',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-sunken',
  ghost: 'bg-transparent text-brand hover:bg-brand-soft',
  danger: 'bg-danger text-ink-invert hover:brightness-90',
  success: 'bg-present text-ink-invert hover:brightness-95',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-2 text-sm rounded-lg',
  md: 'px-4 py-2.5 text-base rounded-xl',
  lg: 'px-5 py-3.5 text-lg rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      // tap：規格第 8 節要求的 44x44 最小點擊區
      className={`tap inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
      <span>{children}</span>
    </button>
  );
}
