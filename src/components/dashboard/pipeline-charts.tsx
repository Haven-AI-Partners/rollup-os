"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface Stage {
  id: string;
  name: string;
  color: string;
}

interface MonthlyDealData {
  month: string;
  [stageId: string]: string | number;
}

interface CurrentMonthData {
  stageName: string;
  stageColor: string;
  count: number;
}

interface PipelineChartsProps {
  stages: Stage[];
  monthlyData: MonthlyDealData[];
  currentMonthData: CurrentMonthData[];
  currentMonthLabel: string;
}

export function PipelineCharts({
  stages,
  monthlyData,
  currentMonthData,
  currentMonthLabel,
}: PipelineChartsProps) {
  const chartConfig = Object.fromEntries(
    stages.map((s) => [s.id, { label: s.name, color: s.color }])
  );

  const currentMonthConfig = Object.fromEntries(
    currentMonthData.map((d) => [
      d.stageName,
      { label: d.stageName, color: d.stageColor },
    ])
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Monthly stacked bar chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deals by Month</CardTitle>
          <CardDescription>Pipeline deals added per month, by current stage</CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={monthlyData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltipContent />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12 }}
                />
                {stages.map((stage) => (
                  <Bar
                    key={stage.id}
                    dataKey={stage.id}
                    name={stage.name}
                    stackId="a"
                    fill={stage.color}
                    radius={0}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No deal data yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Current month bar chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Month ({currentMonthLabel})</CardTitle>
          <CardDescription>Cumulative funnel — each deal counts toward its stage and all earlier stages</CardDescription>
        </CardHeader>
        <CardContent>
          {currentMonthData.length > 0 ? (
            <ChartContainer config={currentMonthConfig} className="h-[300px] w-full">
              <BarChart
                data={currentMonthData}
                layout="vertical"
                barCategoryGap="25%"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="stageName"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                  width={120}
                />
                <Tooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" name="Deals" radius={[0, 4, 4, 0]}>
                  {currentMonthData.map((entry, index) => (
                    <Cell key={index} fill={entry.stageColor} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No deals this month.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
