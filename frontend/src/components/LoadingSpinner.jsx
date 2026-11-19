export default function LoadingSpinner({ message = '', size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-9 h-9 border-3',
    lg: 'w-12 h-12 border-4',
  }

  const spinnerSize = sizeClasses[size] || sizeClasses.md

  return (
    <div className={`flex flex-col items-center justify-center p-6 ${className}`}>
      <div
        className={`${spinnerSize} rounded-full border-primary/30 border-t-accent animate-spin`}
        role="status"
        aria-label="Loading"
      />
      {message && (
        <p className="mt-3 text-sm font-medium text-textSecondary animate-pulse">
          {message}
        </p>
      )}
    </div>
  )
}
