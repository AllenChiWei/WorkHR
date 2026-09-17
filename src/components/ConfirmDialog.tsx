import { Button } from './Button';
import { Sheet } from './Sheet';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 重複打卡、停用工班等不可輕易執行的操作都要先經過這裡。 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '確定',
  cancelLabel = '取消',
  tone = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Sheet
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone} fullWidth onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-base leading-relaxed text-ink-soft">{message}</p>
    </Sheet>
  );
}
