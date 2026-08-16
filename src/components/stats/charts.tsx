"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { useI18n } from "@/components/i18n-provider";
import { Card } from "@/components/ui/card";

export function ForecastChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const { t } = useI18n();
  return (
    <Card variant="flat" className="p-6 sm:p-7">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <h3 className="display text-xl">{t("stats.forecast")}</h3>
          <p className="text-xs text-fg-muted mt-0.5">{t("stats.forecastSub")}</p>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="fc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--ember))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="rgb(var(--ember))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "rgb(var(--ink-soft))" }}
              tickFormatter={(d) => d.slice(5)}
              interval={5}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 10, fill: "rgb(var(--ink-soft))" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              contentStyle={{
                background: "rgb(var(--surface))",
                border: "1px solid rgb(var(--ink-line) / 0.1)",
                borderRadius: 12,
                fontSize: 12,
              }}
              labelStyle={{ color: "rgb(var(--ink-soft))" }}
            />
            <Area type="monotone" dataKey="count" stroke="rgb(var(--ember))" strokeWidth={2} fill="url(#fc)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function AccuracyChart({ data }: { data: Array<{ date: string; accuracy: number; count: number }> }) {
  const { t } = useI18n();
  return (
    <Card variant="flat" className="p-6 sm:p-7">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <h3 className="display text-xl">{t("stats.accuracy")}</h3>
          <p className="text-xs text-fg-muted mt-0.5">{t("stats.accuracySub")}</p>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="rgb(var(--ink-line) / 0.08)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "rgb(var(--ink-soft))" }}
              tickFormatter={(d) => d.slice(5)}
              interval={5}
              axisLine={false}
              tickLine={false}
            />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "rgb(var(--ink-soft))" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              contentStyle={{
                background: "rgb(var(--surface))",
                border: "1px solid rgb(var(--ink-line) / 0.1)",
                borderRadius: 12,
                fontSize: 12,
              }}
              labelStyle={{ color: "rgb(var(--ink-soft))" }}
            />
            <Line type="monotone" dataKey="accuracy" stroke="rgb(var(--moss-500))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
