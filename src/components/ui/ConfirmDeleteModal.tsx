import { Button } from './Button';
import { Modal } from './Modal';

type ConfirmDeleteModalProps = {
  open: boolean;
  fileName: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteModal({
  open,
  fileName,
  loading,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  return (
    <Modal open={open} title="Delete file?" onClose={onCancel} className="max-w-[360px]">
      <p className="mb-6 text-sm text-ink-soft">{fileName} will be moved to Trash.</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" disabled={loading} onClick={onConfirm}>
          {loading ? 'Deleting...' : 'Delete'}
        </Button>
      </div>
    </Modal>
  );
}
