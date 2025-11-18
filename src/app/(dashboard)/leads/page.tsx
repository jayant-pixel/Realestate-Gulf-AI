'use client';

import { useEffect, useState } from 'react';
import { Download, Filter, Search } from 'lucide-react';
import LeadDrawer from '@/components/LeadDrawer';
import LeadTable from '@/components/LeadTable';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Activity, Lead } from '@/types/db';

export default function LeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadActivities, setLeadActivities] = useState<Activity[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadLeads();
  }, []);

  useEffect(() => {
    if (selectedLead) {
      void loadLeadActivities(selectedLead.id);
    }
  }, [selectedLead]);

  const loadLeads = async () => {
    try {
      const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setLeads(data ?? []);
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLeadActivities = async (leadId: string) => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeadActivities(data ?? []);
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const handleAddActivity = async (type: 'note' | 'task' | 'status', message: string, dueAt?: string) => {
    if (!selectedLead || !user) return;

    try {
      const { error } = await supabase.from('activities').insert({
        lead_id: selectedLead.id,
        type,
        message,
        due_at: dueAt || null,
        created_by: user.id,
      });

      if (error) throw error;
      void loadLeadActivities(selectedLead.id);
    } catch (error) {
      console.error('Error adding activity:', error);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const query = searchQuery.toLowerCase();
    return (
      lead.full_name.toLowerCase().includes(query) ||
      lead.email.toLowerCase().includes(query) ||
      lead.phone.toLowerCase().includes(query) ||
      lead.preferred_location.toLowerCase().includes(query)
    );
  });

  const handleExport = () => {
    const csv = [
      ['Name', 'Email', 'Phone', 'Location', 'Budget', 'Intent', 'Stage', 'Created'],
      ...filteredLeads.map((lead) => [
        lead.full_name,
        lead.email,
        lead.phone,
        lead.preferred_location,
        lead.budget.toString(),
        lead.intent_level,
        lead.stage,
        new Date(lead.created_at).toLocaleDateString(),
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    anchor.click();
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-600">Loading leads...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Lead Management</h1>
          <p className="text-gray-600">View and manage all your real estate leads</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 transition-colors hover:bg-gray-50"
        >
          <Download className="h-5 w-5" />
          Export CSV
        </button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search leads by name, email, phone, or location..."
            className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-700 transition-colors hover:bg-gray-50">
          <Filter className="h-5 w-5" />
          Filters
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-4 flex gap-4">
          <button className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white">
            All Leads ({filteredLeads.length})
          </button>
          <button className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200">
            High Intent ({filteredLeads.filter((lead) => lead.intent_level === 'high').length})
          </button>
          <button className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200">
            Qualified ({filteredLeads.filter((lead) => lead.stage === 'Qualified').length})
          </button>
        </div>
      </div>

      <LeadTable leads={filteredLeads} onSelectLead={setSelectedLead} />

      <LeadDrawer
        lead={selectedLead}
        activities={leadActivities}
        onClose={() => setSelectedLead(null)}
        onAddActivity={handleAddActivity}
        onLeadUpdated={() => {
          void loadLeads();
        }}
      />
    </div>
  );
}
