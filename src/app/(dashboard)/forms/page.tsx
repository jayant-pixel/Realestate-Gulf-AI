"use client";

import { useEffect, useState } from "react";
import type { Form } from "@/types/db";

const defaultFields = {
  name: { required: true, label: "Full name" },
  phone: { required: true, label: "Phone" },
  email: { required: false, label: "Email" },
  budget: { required: false, label: "Budget" },
  location: { required: false, label: "Location" },
  notes: { required: false, label: "Notes" },
};

export default function FormsPage() {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [snippet, setSnippet] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/forms");
        const payload = await res.json();
        setForms(payload?.data || []);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSnippet(null);
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, fields: defaultFields }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Unable to create form");
      setForms((prev) => [payload.data, ...prev]);
      setSnippet(payload.embedSnippet);
      setName("");
      setDescription("");
    } catch (err: any) {
      setError(err?.message || "Failed to create form");
    }
  };

  return (
    <main className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Forms</h1>
        <p className="text-sm text-slate-600">Create embeddable lead forms that trigger outbound calls.</p>
      </div>

      <form onSubmit={onCreate} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Name
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Description
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <button type="submit" className="rounded-full bg-cyan-600 text-white px-4 py-2 font-semibold">
          Create form
        </button>
        {snippet ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-700">
            {snippet}
          </div>
        ) : null}
      </form>

      <div className="grid gap-3 md:grid-cols-2">
        {loading ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : (
          forms.map((form) => (
            <div key={form.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-900">{form.name}</p>
                  <p className="text-xs text-slate-500">{form.slug}</p>
                </div>
                <span className="text-xs rounded-full px-2 py-1 border border-emerald-200 text-emerald-700">
                  {form.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              {form.description ? <p className="mt-2 text-sm text-slate-700">{form.description}</p> : null}
              <div className="mt-3 text-xs">
                <p className="font-semibold">Embed:</p>
                <code className="block rounded bg-slate-50 p-2 text-slate-700 break-all">
                  {`<iframe src="${process.env.NEXT_PUBLIC_SITE_URL || ""}/forms/${form.slug}?token=${form.embed_token}" width="100%" height="640" style="border:0;border-radius:16px;"></iframe>`}
                </code>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
