import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (id: string) => ReactNode;
}

export function Field({ label, error, hint, required, children }: FieldProps) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </label>
      {children(id)}
      {hint && !error ? <p className="text-xs text-ink-mute">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL_CLASS =
  'tap w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-base text-ink placeholder:text-ink-mute focus:border-brand';

export function TextInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL_CLASS} ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${CONTROL_CLASS} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function TextArea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${CONTROL_CLASS} min-h-[88px] ${className}`} {...rest} />;
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <label
      className={`tap flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3 ${disabled ? 'opacity-50' : ''}`}
    >
      <input
        type="checkbox"
        className="mt-1 size-5 accent-[color:var(--color-brand)]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description ? <span className="block text-xs text-ink-soft">{description}</span> : null}
      </span>
    </label>
  );
}
