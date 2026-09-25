import { STATUS } from '../../lib/tickets';

// A ticket's status: a dot in its colour and the word. No box around it.
export default function TicketStatus({ status, className = '' }) {
  const s = STATUS[status] || STATUS.new;
  return (
    <span className={`inline-flex items-center gap-1.5 font-ninja text-xs font-semibold text-ninja-navy whitespace-nowrap ${className}`}>
      <span aria-hidden="true" className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.dot }} />
      {s.label}
    </span>
  );
}
