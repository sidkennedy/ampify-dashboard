import { CallStatus } from '@/types'

const CONFIG: Record<CallStatus, { label: string; className: string }> = {
  queued:      { label: 'Queued',      className: 'badge badge-gray' },
  scheduled:   { label: 'Scheduled',   className: 'badge badge-yellow' },
  in_progress: { label: 'In Progress', className: 'badge badge-blue' },
  completed:   { label: 'Completed',   className: 'badge badge-green' },
  failed:      { label: 'Failed',      className: 'badge badge-red' },
}

export default function StatusBadge({ status }: { status: CallStatus }) {
  const { label, className } = CONFIG[status] ?? { label: status, className: 'badge badge-gray' }
  return <span className={className}>{label}</span>
}
