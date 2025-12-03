"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lead } from "@/types/db";
import { KanbanBoard, KanbanCard, KanbanCards, KanbanHeader, KanbanProvider } from "@/components/ui/kanban";

type PipelineCard = Lead & { column: string };

const STAGES: { key: string; label: string; color: string }[] = [
  { key: "new", label: "New", color: "#6B7280" },
  { key: "contacted", label: "Contacted", color: "#0EA5E9" },
  { key: "qualified", label: "Qualified", color: "#22C55E" },
  { key: "follow_up", label: "Follow-up", color: "#F59E0B" },
  { key: "closed_won", label: "Closed/Won", color: "#10B981" },
  { key: "closed_lost", label: "Closed/Lost", color: "#EF4444" },
];

export default function PipelinePage() {
  const [items, setItems] = useState<PipelineCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/pipeline");
        const payload = await res.json();
        const grouped = payload?.data || {};
        const flattened: PipelineCard[] = Object.entries(grouped).flatMap(([stage, leads]: [string, Lead[]]) =>
          (leads || []).map((lead) => ({ ...lead, column: stage.toLowerCase() })),
        );
        setItems(flattened);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const columns = useMemo(
    () =>
      STAGES.map((stage) => ({
        id: stage.key,
        name: stage.label,
        color: stage.color,
      })),
    [],
  );

  const move = async (lead: PipelineCard, stage: string) => {
    await fetch("/api/pipeline", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: lead.id, stage }),
    });
    setItems((prev) => prev.map((item) => (item.id === lead.id ? { ...item, column: stage } : item)));
  };

  return (
    <main className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Pipeline</h1>
        <p className="text-sm text-slate-600">Track outbound calls and lead progress by stage.</p>
      </div>
      {loading ? (
        <div className="text-sm text-slate-600">Loading pipeline…</div>
      ) : (
        <KanbanProvider columns={columns} data={items}>
          {(column) => (
            <KanbanBoard id={column.id} key={column.id}>
              <KanbanHeader>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: column.color }} />
                  <span className="text-sm font-semibold">{column.name}</span>
                </div>
                <span className="text-xs text-slate-500">
                  {items.filter((item) => item.column === column.id).length}
                </span>
              </KanbanHeader>
              <KanbanCards<PipelineCard> id={column.id} renderEmpty={<p className="text-xs text-slate-500">No leads</p>}>
                {(lead) => (
                  <KanbanCard>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{lead.full_name || "Unnamed Lead"}</p>
                        <p className="text-xs text-slate-600">{lead.phone || lead.email || "No contact"}</p>
                      </div>
                    </div>
                    {lead.preferred_location ? (
                      <p className="text-xs text-slate-600 mt-1">Location: {lead.preferred_location}</p>
                    ) : null}
                    {lead.budget ? (
                      <p className="text-xs text-slate-600">Budget: {lead.budget}</p>
                    ) : null}
                    {lead.last_call_summary ? (
                      <p className="mt-2 text-xs text-slate-700 bg-white rounded-lg p-2 border border-slate-200">
                        {lead.last_call_summary}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-1 pt-2">
                      {STAGES.filter((s) => s.key !== column.id)
                        .slice(0, 3)
                        .map((target) => (
                          <button
                            key={target.key}
                            onClick={() => move(lead, target.key)}
                            className="text-[11px] rounded-full border border-cyan-200 px-2 py-0.5 text-cyan-700 hover:bg-cyan-50"
                          >
                            Move to {target.label}
                          </button>
                        ))}
                    </div>
                  </KanbanCard>
                )}
              </KanbanCards>
            </KanbanBoard>
          )}
        </KanbanProvider>
      )}
    </main>
  );
}
