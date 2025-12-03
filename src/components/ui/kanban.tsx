import * as React from 'react';

type Column = {
  id: string;
  name: string;
  color?: string;
};

type KanbanContextValue<T> = {
  columns: Column[];
  data: T[];
};

const KanbanContext = React.createContext<KanbanContextValue<any> | null>(null);

function useKanbanContext<T>() {
  const ctx = React.useContext(KanbanContext);
  if (!ctx) {
    throw new Error('Kanban components must be used within a KanbanProvider');
  }
  return ctx as KanbanContextValue<T>;
}

interface KanbanProviderProps<T> {
  columns: Column[];
  data: T[];
  children: (column: Column) => React.ReactNode;
}

export function KanbanProvider<T>({ columns, data, children }: KanbanProviderProps<T>) {
  return (
    <KanbanContext.Provider value={{ columns, data }}>
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">{columns.map((col) => children(col))}</div>
    </KanbanContext.Provider>
  );
}

export function KanbanBoard({ children, id }: { children: React.ReactNode; id: string }) {
  return (
    <section
      id={id}
      className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden"
    >
      {children}
    </section>
  );
}

export function KanbanHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
      {children}
    </div>
  );
}

export function KanbanCards<T>({
  id,
  renderEmpty,
  children,
}: {
  id: string;
  renderEmpty?: React.ReactNode;
  children: (item: T) => React.ReactNode;
}) {
  const { data } = useKanbanContext<T>();
  const items = data.filter((item: any) => (item as any).column === id);
  return (
    <div className="p-3 space-y-3 min-h-[120px]">
      {items.length === 0 && renderEmpty ? renderEmpty : null}
      {items.map((item, idx) => (
        <React.Fragment key={(item as any).id ?? idx}>{children(item)}</React.Fragment>
      ))}
    </div>
  );
}

export function KanbanCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm hover:shadow-md transition ${className}`}
    >
      {children}
    </article>
  );
}
