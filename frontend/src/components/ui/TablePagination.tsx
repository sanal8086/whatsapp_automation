import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TablePaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}

export const TablePagination: React.FC<TablePaginationProps> = ({ page, totalPages, totalItems, pageSize = 10, onPageChange }) => {
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '10px' }}>
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        Showing {start}–{end} of {totalItems}
      </span>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <button
          className="btn-table-action"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          style={{ opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'default' : 'pointer' }}
        >
          <ChevronLeft size={13} /> Prev
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className="btn-table-action"
            style={p === page ? { background: 'var(--primary-gradient)', color: '#202020', fontWeight: 700, borderColor: 'var(--primary)' } : undefined}
          >
            {p}
          </button>
        ))}
        <button
          className="btn-table-action"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          style={{ opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'default' : 'pointer' }}
        >
          Next <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
};
