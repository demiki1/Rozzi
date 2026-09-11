'use client';

import { useEffect, useState, FormEvent } from 'react';
import { DashboardShell, PageHeader, Button } from '@/components/dashboard-shell';
import { api } from '@/lib/api-client';
import { Category } from '@/lib/types';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<Category[]>('/api/admin/categories')
      .then(setCategories)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/api/admin/categories', { name, displayOrder: categories.length });
      setName('');
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function toggleActive(cat: Category) {
    try {
      if (cat.isActive) {
        await api.post(`/api/admin/categories/${cat.id}/deactivate`);
      } else {
        await api.patch(`/api/admin/categories/${cat.id}`, { isActive: true });
      }
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <DashboardShell>
      <PageHeader
        title="Categories"
        description="Product categories customers browse by. Add or disable without touching code (§25)."
      />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="max-w-xl rounded-xl border border-gray-200 bg-white p-5">
        <ul className="mb-4 divide-y divide-gray-100">
          {categories
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((cat) => (
              <li key={cat.id} className="flex items-center justify-between py-2">
                <span className={`text-sm ${cat.isActive ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                  {cat.name}
                </span>
                <Button variant={cat.isActive ? 'secondary' : 'primary'} onClick={() => toggleActive(cat)}>
                  {cat.isActive ? 'Disable' : 'Enable'}
                </Button>
              </li>
            ))}
          {categories.length === 0 && <li className="py-4 text-sm text-gray-400">No categories yet.</li>}
        </ul>

        <form onSubmit={create} className="flex gap-2 border-t border-gray-100 pt-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New category name"
            required
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Add
          </button>
        </form>
      </div>
    </DashboardShell>
  );
}
