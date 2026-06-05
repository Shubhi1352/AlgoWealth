'use client'

import React, { ReactNode } from 'react'

export interface ColumnDef<T> {
  header: string
  accessorKey?: keyof T | string
  cell?: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
  headerClassName?: string
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  isLoading?: boolean
  emptyState?: {
    icon: ReactNode
    title: string
    subtitle: ReactNode
  }
  loadingRowsCount?: number
  rowKey: (row: T) => string | number
  className?: string
  tableClassName?: string
  rowClassName?: (row: T) => string
  renderRowDetails?: (row: T) => ReactNode
  isRowExpanded?: (row: T) => boolean
  onRowClick?: (row: T) => void
}

export default function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyState,
  loadingRowsCount = 3,
  rowKey,
  className = '',
  tableClassName = '',
  rowClassName,
  renderRowDetails,
  isRowExpanded,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className={className}>
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
          {Array.from({ length: loadingRowsCount }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '56px', borderRadius: '8px' }} />
          ))}
        </div>
      ) : data.length === 0 ? (
        emptyState ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' }}>
            <span style={{ fontSize: '2rem', marginBottom: '8px' }}>{emptyState.icon}</span>
            <p style={{ fontWeight: 600, fontSize: '15px', color: 'var(--color-text-primary)', marginBottom: '4px' }}>{emptyState.title}</p>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{emptyState.subtitle}</div>
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No data available.
          </div>
        )
      ) : (
        <table className={`aw-table ${tableClassName}`}>
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={col.headerClassName}
                  style={{ textAlign: col.align || 'left' }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const key = rowKey(row)
              const expanded = isRowExpanded ? isRowExpanded(row) : false
              return (
                <React.Fragment key={key}>
                  <tr
                    className={rowClassName ? rowClassName(row) : ''}
                    onClick={() => onRowClick && onRowClick(row)}
                    style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                  >
                    {columns.map((col, idx) => {
                      let cellContent: ReactNode = null
                      if (col.cell) {
                        cellContent = col.cell(row)
                      } else if (col.accessorKey) {
                        cellContent = String(row[col.accessorKey as keyof T] ?? '')
                      }
                      return (
                        <td
                          key={idx}
                          className={col.className}
                          style={{ textAlign: col.align || 'left' }}
                        >
                          {cellContent}
                        </td>
                      )
                    })}
                  </tr>
                  {expanded && renderRowDetails && renderRowDetails(row)}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
