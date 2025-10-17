"use client"

import { useState, useMemo } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { format, subDays, parseISO } from "date-fns"

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
} from "@/components/ui/chart"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface PaymentData {
    date: string
    vault_id: string
    vault_name: string
    total_amount: string
}

interface PaymentsOverTimeChartProps {
    data: PaymentData[]
    showVaultBreakdown?: boolean // If true, show stacked bars per vault
    title?: string
    description?: string
}

export function PaymentsOverTimeChart({
    data,
    showVaultBreakdown = false,
    title = "Payment Activity",
    description = "Daily payment totals"
}: PaymentsOverTimeChartProps) {
    const [timeRange, setTimeRange] = useState<7 | 14 | 30>(30)

    // Format amount from USDC (6 decimals) to dollars
    const formatAmount = (amount: string | number) => {
        const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount
        return (parsedAmount || 0) / 1_000_000
    }

  // Create vault ID to key mapping
  const vaultMapping = useMemo(() => {
    const uniqueVaults = Array.from(new Set(data.map(d => d.vault_id)))
    const mapping: Record<string, string> = {}
    uniqueVaults.forEach((vaultId, index) => {
      mapping[vaultId] = `vault${index}`
    })
    return mapping
  }, [data])

  // Process data based on time range and format
  const chartData = useMemo(() => {
    const cutoffDate = subDays(new Date(), timeRange)
    
    // Filter data by time range
    const filteredData = data.filter(item => {
      const itemDate = parseISO(item.date)
      return itemDate >= cutoffDate
    })

    if (showVaultBreakdown) {
      // Group by date with separate values for each vault (stacked bar chart)
      const dateMap = new Map<string, any>()
      
      // Initialize all vault keys to 0 for each date
      filteredData.forEach(item => {
        const dateKey = format(parseISO(item.date), 'MMM dd')
        if (!dateMap.has(dateKey)) {
          const entry: any = { date: dateKey, fullDate: item.date }
          // Initialize all vaults to 0
          Object.values(vaultMapping).forEach(vaultKey => {
            entry[vaultKey] = 0
          })
          dateMap.set(dateKey, entry)
        }
        const entry = dateMap.get(dateKey)
        const vaultKey = vaultMapping[item.vault_id]
        entry[vaultKey] = formatAmount(item.total_amount)
      })

      return Array.from(dateMap.values()).sort((a, b) => 
        parseISO(a.fullDate).getTime() - parseISO(b.fullDate).getTime()
      )
    } else {
      // Group by date with single total (simple bar chart)
      const dateMap = new Map<string, { date: string; fullDate: string; amount: number }>()
      
      filteredData.forEach(item => {
        const dateKey = format(parseISO(item.date), 'MMM dd')
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, { date: dateKey, fullDate: item.date, amount: 0 })
        }
        const entry = dateMap.get(dateKey)!
        entry.amount += formatAmount(item.total_amount)
      })

      return Array.from(dateMap.values()).sort((a, b) => 
        parseISO(a.fullDate).getTime() - parseISO(b.fullDate).getTime()
      )
    }
  }, [data, timeRange, showVaultBreakdown, vaultMapping])

  // Generate chart config dynamically for vaults
  const chartConfig = useMemo(() => {
    if (showVaultBreakdown) {
      const config: ChartConfig = {}
      const uniqueVaults = Array.from(new Set(data.map(d => d.vault_id)))
      const colors = [
        "var(--chart-1)",
        "var(--chart-2)",
        "var(--chart-3)",
        "var(--chart-4)",
        "var(--chart-5)",
      ]
      
      uniqueVaults.forEach((vaultId, index) => {
        const vaultName = data.find(d => d.vault_id === vaultId)?.vault_name || "Unknown"
        const vaultKey = vaultMapping[vaultId]
        config[vaultKey] = {
          label: vaultName,
          color: colors[index % colors.length],
        }
      })
      
      return config
    } else {
      return {
        amount: {
          label: "Amount",
          color: "var(--chart-1)",
        },
      } satisfies ChartConfig
    }
  }, [data, showVaultBreakdown, vaultMapping])

    // Calculate total and trend
    const stats = useMemo(() => {
        const amounts = chartData.map(d =>
            showVaultBreakdown
                ? Object.keys(d).filter(k => k !== 'date' && k !== 'fullDate').reduce((sum, key) => sum + (d[key] || 0), 0)
                : d.amount
        )
        const total = amounts.reduce((sum, val) => sum + val, 0)

        // Calculate trend (compare first half vs second half)
        const mid = Math.floor(amounts.length / 2)
        const firstHalf = amounts.slice(0, mid).reduce((sum, val) => sum + val, 0) / mid
        const secondHalf = amounts.slice(mid).reduce((sum, val) => sum + val, 0) / (amounts.length - mid)
        const trendPercent = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0

        return { total, trendPercent, isUp: trendPercent > 0 }
    }, [chartData, showVaultBreakdown])

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(value)
    }

    return (
        <Card>
            <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
                <div className="flex flex-1 flex-col justify-center gap-1 px-6">
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </div>
                <div className="flex">
                    <Tabs
                        value={timeRange.toString()}
                        onValueChange={(value) => setTimeRange(Number(value) as 7 | 14 | 30)}
                        className="ml-auto mr-3"
                    >
                        <TabsList className="grid w-full grid-cols-3 border-b-0 h-full">
                            <TabsTrigger
                                value="7"
                                className="border-l data-[state=active]:bg-muted/50"
                            >
                                7d
                            </TabsTrigger>
                            <TabsTrigger
                                value="14"
                                className="border-l data-[state=active]:bg-muted/50"
                            >
                                14d
                            </TabsTrigger>
                            <TabsTrigger
                                value="30"
                                className="border-l border-r data-[state=active]:bg-muted/50"
                            >
                                30d
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </CardHeader>
            <CardContent className="px-2 sm:p-6">
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart
                        accessibilityLayer
                        data={chartData}
                        margin={{ top: 20, right: 12, left: 12, bottom: 20 }}
                    >
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tickFormatter={(value) => `$${value}`}
                        />
                        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                        {showVaultBreakdown && <ChartLegend content={<ChartLegendContent />} />}
                        {showVaultBreakdown && <Bar dataKey="vault0" stackId="a" fill="var(--color-vault0)" radius={[4, 4, 0, 0]} />}
                        {showVaultBreakdown && <Bar dataKey="vault1" stackId="a" fill="var(--color-vault1)" radius={[4, 4, 0, 0]} />}
                        {showVaultBreakdown && <Bar dataKey="vault2" stackId="a" fill="var(--color-vault2)" radius={[4, 4, 0, 0]} />}
                        {showVaultBreakdown && <Bar dataKey="vault3" stackId="a" fill="var(--color-vault3)" radius={[4, 4, 0, 0]} />}
                        {showVaultBreakdown && <Bar dataKey="vault4" stackId="a" fill="var(--color-vault4)" radius={[4, 4, 0, 0]} />}
                        {!showVaultBreakdown && <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} />}
                    </BarChart>
                </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col items-start gap-2 text-sm">
                <div className="flex gap-2 font-medium leading-none items-center">
                    {stats.isUp ? "Trending up" : "Trending down"} by {Math.abs(stats.trendPercent).toFixed(1)}%
                    {stats.isUp ? (
                        <TrendingUp className="h-4 w-4" />
                    ) : (
                        <TrendingDown className="h-4 w-4" />
                    )}
                </div>
                <div className="leading-none text-muted-foreground">
                    Total spent: {formatCurrency(stats.total)} over last {timeRange} days
                </div>
            </CardFooter>
        </Card>
    )
}

