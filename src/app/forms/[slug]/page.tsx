"use client";

import { useEffect, useState } from "react";

type FormFieldKey = "name" | "phone" | "email" | "budget" | "location" | "notes";

interface FormConfig {
  id: string;
  name: string;
  slug: string;
  fields: Record<string, { required?: boolean; label?: string }>;
}

export default function EmbeddedForm({ params, searchParams }: { params: { slug: string }; searchParams: Record<string, string> }) {
  const token = searchParams.token;
  const [form, setForm] = useState<FormConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fields, setFields] = useState<Record<FormFieldKey, string>>({
    name: "",
    phone: "",
    email: "",
    budget: "",
    location: "",
    notes: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/forms?slug=${encodeURIComponent(params.slug)}`);
        const payload = await res.json();
        const match = (payload?.data || []).find((f: FormConfig) => f.slug === params.slug);
        if (!match) throw new Error("Form not found");
        setForm(match);
      } catch (err: any) {
        setError(err?.message || "Unable to load form");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [params.slug]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(form.slug)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, fields }),
      });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload?.error || "Failed to submit");
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-slate-600">Loading…</div>;
  if (error) return <div className="p-6 text-center text-rose-600">{error}</div>;
  if (!form) return <div className="p-6 text-center">Form unavailable.</div>;

  if (submitted) {
    return (
      <div className="p-6 text-center text-emerald-700">
        Thanks! We received your details. Our team will reach out shortly.
      </div>
    );
  }

  const fieldConfig = (key: FormFieldKey) => form.fields?.[key] || { label: key, required: false };

  return (
    <div className="p-6 bg-white text-slate-900 rounded-2xl shadow-lg">
      <h1 className="text-xl font-semibold mb-3">{form.name}</h1>
      <form className="space-y-4" onSubmit={onSubmit}>
        {(Object.keys(fields) as FormFieldKey[]).map((key) => (
          <label key={key} className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              {fieldConfig(key).label || key}
              {fieldConfig(key).required ? " *" : ""}
            </span>
            {key === "notes" ? (
              <textarea
                className="rounded-xl border px-3 py-2"
                value={fields[key]}
                onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
                required={fieldConfig(key).required}
              />
            ) : (
              <input
                className="rounded-xl border px-3 py-2"
                value={fields[key]}
                onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
                required={fieldConfig(key).required}
              />
            )}
          </label>
        ))}
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-cyan-600 text-white py-2.5 font-semibold disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </form>
    </div>
  );
}
