import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type RowData,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Per-column display metadata. `align` is the single source of truth for a
// column's horizontal alignment — it is applied to BOTH the header cell and the
// body cells, so a header can never drift out of line with its column (the RTL
// bug this component exists to prevent). Default alignment is 'start', which
// follows the document direction (right in our RTL Hebrew UI).
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: 'start' | 'center' | 'end';
    /** Extra classes applied to both the header and the body cells of this column. */
    className?: string;
  }
}

function alignClass(align: 'start' | 'center' | 'end' | undefined): string {
  if (align === 'end') return 'text-end';
  if (align === 'center') return 'text-center';
  return 'text-start';
}

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Optional per-row className (e.g. to highlight the current user's row). */
  rowClassName?: (row: Row<TData>) => string | undefined;
  /** Optional per-row data attributes (e.g. data-you for the current user). */
  rowProps?: (row: Row<TData>) => Record<string, unknown>;
}

/**
 * A TanStack-Table-backed data table used for every tabular surface in the app.
 * Column definitions carry their own alignment via `meta.align`, applied
 * identically to header and cells so columns and headers always line up — in
 * particular under RTL Hebrew, where the previous hand-rolled tables had
 * left-aligned headers over right-aligned data.
 */
export function DataTable<TData>({ columns, data, rowClassName, rowProps }: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const meta = header.column.columnDef.meta;
              return (
                <TableHead key={header.id} className={cn(alignClass(meta?.align), meta?.className)}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => {
          const extra = rowProps?.(row);
          return (
            <TableRow key={row.id} className={cn(rowClassName?.(row))} {...extra}>
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta;
                return (
                  <TableCell key={cell.id} className={cn(alignClass(meta?.align), meta?.className)}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default DataTable;
