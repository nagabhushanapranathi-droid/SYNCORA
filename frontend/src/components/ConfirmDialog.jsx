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
  children,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      closeDisabled={loading}
      title={title}
      maxWidth="max-w-md"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={loading} className="btn-ghost">
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={isDestructive ? 'btn-danger' : 'btn-primary'}
          >
            {loading && <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />}
            {confirmText}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-10 h-10 rounded-panel flex items-center justify-center shrink-0 ${
            isDestructive ? 'bg-danger-soft text-danger-ink' : 'bg-warn-soft text-warn-ink'
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="text-base text-ink-2 leading-relaxed pt-1.5">
          {message}
          {children}
        </div>
      </div>
    </Modal>
  )
}
