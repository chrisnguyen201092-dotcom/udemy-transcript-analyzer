# Next.js analytics dashboard patterns (Next.js 16 App Router)

Patterns:
- Server Components for layout, Client Components for charts, API routes for data.
- Real-time-ish dashboards via periodic revalidation and WebSocket/SSR data caches.
- UI with TanStack Table + Chart.js/Visx.

Code sketch: Next.js App Router pages
```tsx
// app/dashboard/page.tsx
import React from 'react';
import dynamic from 'next/dynamic';
import { getAnalytics } from '@/lib/analytics';

const Chart = dynamic(() => import('@/components/Chart'), { ssr: false });

export default async function Dashboard() {
  const data = await getAnalytics();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Learning Analytics</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        <Chart data={data.sessions} type="line" />
        <Chart data={data.knowledge} type="bar" />
        <Chart data={data.csv} type="pie" />
      </div>
    </div>
  );
}
```

Reference patterns:
- SaaS analytics dashboards on Next.js with TanStack: AysoDev/saas-analytics
- Self-hosted analytics with Next.js and PostgreSQL
- Build dashboards with Next.js + TanStack patterns

KB sources:
- https://github.com/AysoDev/saas-analytics
- https://mxd.codes/articles/self-hosted-analytics-with-next-js-and-postgresql
- https://terminalskills.io/use-cases/build-dashboard-with-nextjs-and-tanstack
