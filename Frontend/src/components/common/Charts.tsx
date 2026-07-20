import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface DataPoint { [key: string]: any }

// ── Line Chart ────────────────────────────────────────────────────────────────
export function LineChartWidget({
  data, xKey, lines, title,
}: { data: DataPoint[]; xKey: string; lines: { key: string; label: string; color?: string }[]; title?: string }) {
  return (
    <div className="card">
      {title && <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend iconType="circle" iconSize={8} />
          {lines.map((l, i) => (
            <Line
              key={l.key} type="monotone" dataKey={l.key} name={l.label}
              stroke={l.color ?? COLORS[i]} strokeWidth={2} dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
export function BarChartWidget({
  data, xKey, bars, title,
}: { data: DataPoint[]; xKey: string; bars: { key: string; label: string; color?: string }[]; title?: string }) {
  return (
    <div className="card">
      {title && <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend iconType="circle" iconSize={8} />
          {bars.map((b, i) => (
            <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color ?? COLORS[i]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Pie / Donut Chart ─────────────────────────────────────────────────────────
export function PieChartWidget({
  data, nameKey, valueKey, title,
}: { data: DataPoint[]; nameKey: string; valueKey: string; title?: string }) {
  return (
    <div className="card">
      {title && <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data} dataKey={valueKey} nameKey={nameKey}
            cx="50%" cy="50%" innerRadius={60} outerRadius={90}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend iconType="circle" iconSize={8} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
