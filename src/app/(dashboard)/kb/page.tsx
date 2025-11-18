'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Property, PropertyFAQ } from '@/types/db';
import { Plus, Edit, Trash2, Upload, Building2 } from 'lucide-react';

export default function KB() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [faqs, setFaqs] = useState<PropertyFAQ[]>([]);
  const [, setShowPropertyForm] = useState(false);
  const [, setShowFAQForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProperties = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('name');

      if (error) throw error;
      setProperties(data || []);
      setSelectedProperty((previous) => {
        if (previous) return previous;
        return data && data.length > 0 ? data[0] : null;
      });
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  const loadFAQs = useCallback(async (propertyId: string) => {
    try {
      const { data, error } = await supabase
        .from('property_faqs')
        .select('*')
        .eq('property_id', propertyId)
        .order('question');

      if (error) throw error;
      setFaqs(data || []);
    } catch (error) {
      console.error('Error loading FAQs:', error);
    }
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      void loadFAQs(selectedProperty.id);
    }
  }, [selectedProperty, loadFAQs]);

  const handleDeleteProperty = async (id: string) => {
    if (!confirm('Are you sure you want to delete this property?')) return;

    try {
      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw error;
      void loadProperties();
      setSelectedProperty(null);
    } catch (error) {
      console.error('Error deleting property:', error);
    }
  };

  const handleDeleteFAQ = async (id: string) => {
    if (!confirm('Are you sure you want to delete this FAQ?')) return;

    try {
      const { error } = await supabase.from('property_faqs').delete().eq('id', id);
      if (error) throw error;
      if (selectedProperty) {
        void loadFAQs(selectedProperty.id);
      }
    } catch (error) {
      console.error('Error deleting FAQ:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading knowledge base...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Knowledge Base</h1>
          <p className="text-gray-600">Manage properties and FAQs for AI assistant</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Upload className="w-5 h-5" />
            Import CSV
          </button>
          <button
            onClick={() => setShowPropertyForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            Add Property
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Properties</h3>
            <div className="space-y-2">
              {properties.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-8">No properties yet</p>
              ) : (
                properties.map((property) => (
                  <button
                    key={property.id}
                    onClick={() => setSelectedProperty(property)}
                    className={`w-full text-left p-4 rounded-lg transition-all ${
                      selectedProperty?.id === property.id
                        ? 'bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{property.name}</p>
                          <p className="text-xs text-gray-600 mt-1">{property.location}</p>
                          <p className="text-xs text-cyan-600 mt-1">${property.base_price.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedProperty ? (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedProperty.name}</h2>
                    <p className="text-gray-600">{selectedProperty.location}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      aria-label="Edit property details"
                    >
                      <Edit className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDeleteProperty(selectedProperty.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      aria-label="Delete property"
                    >
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Base Price</p>
                    <p className="text-lg font-semibold text-gray-900">${selectedProperty.base_price.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Availability</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedProperty.availability}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-600 mb-2">Unit Types</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedProperty.unit_types.map((type, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        {type}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-600 mb-2">Amenities</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedProperty.amenities.map((amenity, idx) => (
                      <span key={idx} className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm">
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Highlights</p>
                  <p className="text-gray-700">{selectedProperty.highlights}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Property FAQs</h3>
                  <button
                    onClick={() => setShowFAQForm(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add FAQ
                  </button>
                </div>

                <div className="space-y-4">
                  {faqs.length === 0 ? (
                    <p className="text-gray-600 text-sm text-center py-8">No FAQs yet</p>
                  ) : (
                    faqs.map((faq) => (
                      <div key={faq.id} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-medium text-gray-900">{faq.question}</p>
                          <button
                            onClick={() => handleDeleteFAQ(faq.id)}
                            className="p-1 hover:bg-red-100 rounded transition-colors"
                            aria-label="Delete FAQ"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                        <p className="text-sm text-gray-700">{faq.answer}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Select a property to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
