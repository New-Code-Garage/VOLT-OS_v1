'use client';

import { Sidebar } from '@/components/sidebar';
import { StatusBadge } from '@/components/status-badge';
import { DataTable } from '@/components/data-table';
import { ErrorBoundary } from '@/components/error-boundary';
import { LoadingSpinner } from '@/components/loading-spinner';
import { useAgentsQuery } from '@/lib/api';
import type { Agent } from '@/lib/types';

export default function AgentsPage() {
  const { data: agents = [], isLoading } = useAgentsQuery();

  const columns = [
    {
      key: 'name',
      label: 'Agent',
      render: (agent: Agent) => (
        <div>
          <div className="font-medium">{agent.name}</div>
          <div className="text-[10px] text-muted-foreground font-mono">
            {agent.id.slice(0, 8)}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (agent: Agent) => (
        <StatusBadge status={agent.status} size="sm" />
      ),
    },
    {
      key: 'health',
      label: 'Health',
      render: (agent: Agent) => (
        <StatusBadge status={agent.health} size="sm" />
      ),
    },
    {
      key: 'lastExecution',
      label: 'Last Execution',
      mono: true,
      render: (agent: Agent) =>
        agent.lastExecution
          ? new Date(agent.lastExecution).toLocaleString()
          : '-',
    },
    {
      key: 'capabilities',
      label: 'Capabilities',
      render: (agent: Agent) => (
        <div className="flex flex-wrap gap-1">
          {agent.capabilities.map((cap) => (
            <span
              key={cap}
              className="bg-secondary px-1.5 py-0.5 rounded text-[10px] font-mono"
            >
              {cap}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'currentTasks',
      label: 'Tasks',
      mono: true,
      render: (agent: Agent) => (
        <span className="text-xs">{agent.currentTasks.length}</span>
      ),
    },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-56 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Agent registry and status
          </p>
        </div>

        <ErrorBoundary>
          {isLoading ? (
            <LoadingSpinner label="Loading agents…" />
          ) : (
            <div className="bg-card border border-border rounded-md">
              <DataTable
                columns={columns as any}
                data={
                  agents as unknown as Record<string, unknown>[]
                }
                emptyMessage="No agents registered"
              />
            </div>
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
}
