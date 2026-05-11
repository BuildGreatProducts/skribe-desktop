import { Button } from './Button';
import { Modal } from './Modal';

type ConfirmDeleteModalProps = {
  open: boolean;
  itemName: string;
  itemKind?: 'file' | 'folder';
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteModal({
  open,
  itemName,
  itemKind = 'file',
  loading,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  return (
    <Modal open={open} title={`Delete ${itemKind}?`} onClose={onCancel} className="max-w-[360px]">
      <p className="mb-6 text-sm text-ink-soft">{itemName} will be moved to Trash.</p>
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
