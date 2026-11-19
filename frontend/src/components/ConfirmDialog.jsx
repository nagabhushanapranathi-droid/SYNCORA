import Modal from './Modal'
import { AlertTriangle } from 'lucide-react'

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  loading = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title={title}
      maxWidth="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-ghost text-sm"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`text-sm px-4 py-2 rounded-xl font-medium text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2 ${
              isDestructive
                ? 'bg-error hover:bg-red-700'
                : 'bg-accent hover:bg-accent-dark'
            }`}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isDestructive ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'
          }`}
        >
          <AlertTriangle className="w-5 h-5 stroke-[2]" />
        </div>
        <div className="text-sm text-textSecondary leading-relaxed pt-1">
          {message}
        </div>
      </div>
    </Modal>
  )
}
