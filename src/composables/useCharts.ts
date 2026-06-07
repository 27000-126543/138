import type { EChartsOption, SeriesOption } from 'echarts';
import type { MonitoringData, EnergyComponent, InteractionFingerprint, FreeEnergyResult } from '@shared/types';

interface LineChartData {
  timestamps: string[];
  values: number[];
}

interface BoxPlotData {
  name: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers?: number[];
}

interface RadarData {
  name: string;
  value: number[];
}

interface RadarIndicator {
  name: string;
  max: number;
}

export function useCharts() {
  const createLineChart = (
    data: MonitoringData[],
    metric: 'rmsd' | 'temperature' | 'potentialEnergy',
    options: { title?: string; yAxisName?: string; color?: string } = {}
  ): EChartsOption => {
    const { title, yAxisName, color = '#5470c6' } = options;
    const timestamps = data.map(d => new Date(d.timestamp).toLocaleTimeString());
    const values = data.map(d => d[metric]);

    return {
      title: title ? { text: title, left: 'center' } : undefined,
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const p = params as { dataIndex: number }[];
          const idx = p[0]?.dataIndex ?? 0;
          const item = data[idx];
          if (!item) return '';
          return `
            <div>时间: ${timestamps[idx]}</div>
            <div>${yAxisName || metric}: ${values[idx].toFixed(4)}</div>
          `;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: timestamps,
        axisLabel: {
          rotate: 45,
          fontSize: 10
        }
      },
      yAxis: {
        type: 'value',
        name: yAxisName || metric,
        scale: true
      },
      series: [
        {
          name: yAxisName || metric,
          type: 'line',
          smooth: true,
          symbol: 'none',
          sampling: 'lttb',
          itemStyle: { color },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: color + '80' },
                { offset: 1, color: color + '10' }
              ]
            }
          },
          data: values
        }
      ],
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100
        },
        {
          type: 'slider',
          start: 0,
          end: 100,
          height: 20,
          bottom: 10
        }
      ]
    };
  };

  const createMultiLineChart = (
    data: MonitoringData[],
    metrics: ('rmsd' | 'temperature' | 'potentialEnergy' | 'pressure' | 'volume')[],
    options: { title?: string } = {}
  ): EChartsOption => {
    const { title } = options;
    const timestamps = data.map(d => new Date(d.timestamp).toLocaleTimeString());
    const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de'];

    const series = metrics.map((metric, index) => ({
      name: metric,
      type: 'line' as const,
      smooth: true,
      symbol: 'none',
      sampling: 'lttb' as const,
      itemStyle: { color: colors[index % colors.length] },
      data: data.map(d => d[metric])
    })) as SeriesOption[];

    return {
      title: title ? { text: title, left: 'center' } : undefined,
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        data: metrics,
        top: title ? 30 : 0
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: title ? 60 : 30,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: timestamps,
        axisLabel: {
          rotate: 45,
          fontSize: 10
        }
      },
      yAxis: {
        type: 'value',
        scale: true
      },
      series
    };
  };

  const createBarChart = (
    components: EnergyComponent[],
    options: { title?: string; showErrorBars?: boolean } = {}
  ): EChartsOption => {
    const { title, showErrorBars = true } = options;
    const names = components.map(c => c.name);
    const values = components.map(c => c.value);
    const errors = components.map(c => c.error);

    return {
      title: title ? { text: title, left: 'center' } : undefined,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const p = params as { dataIndex: number }[];
          const idx = p[0]?.dataIndex ?? 0;
          const item = components[idx];
          if (!item) return '';
          return `
            <div>${item.name}</div>
            <div>能量: ${item.value.toFixed(2)} ± ${item.error.toFixed(2)} kcal/mol</div>
          `;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: names,
        axisLabel: {
          rotate: 45,
          fontSize: 10
        }
      },
      yAxis: {
        type: 'value',
        name: '能量 (kcal/mol)'
      },
      series: [
        {
          name: '能量分量',
          type: 'bar',
          data: values,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#83bff6' },
                { offset: 1, color: '#188df0' }
              ]
            }
          }
        },
        ...(showErrorBars
          ? [
              {
                name: '标准误差',
                type: 'custom' as const,
                renderItem: (params: unknown, api: unknown) => {
                  const p = params as { dataIndex: number; coord: number[] };
                  const a = api as {
                    coord: (values: number[]) => number[];
                    size: (values: number[]) => number[];
                  };
                  const idx = p.dataIndex;
                  const value = values[idx];
                  const error = errors[idx];
                  const [x, y] = p.coord;
                  const [, width] = a.size([1, 1]);
                  const barWidth = width * 0.6;

                  const yHigh = a.coord([0, value + error])[1];
                  const yLow = a.coord([0, value - error])[1];

                  return {
                    type: 'group' as const,
                    children: [
                      {
                        type: 'line' as const,
                        shape: {
                          x1: x - barWidth / 2,
                          y1: yHigh,
                          x2: x + barWidth / 2,
                          y2: yHigh,
                          stroke: '#333',
                          lineWidth: 1
                        }
                      },
                      {
                        type: 'line' as const,
                        shape: {
                          x1: x,
                          y1: yHigh,
                          x2: x,
                          y2: yLow,
                          stroke: '#333',
                          lineWidth: 1
                        }
                      },
                      {
                        type: 'line' as const,
                        shape: {
                          x1: x - barWidth / 2,
                          y1: yLow,
                          x2: x + barWidth / 2,
                          y2: yLow,
                          stroke: '#333',
                          lineWidth: 1
                        }
                      }
                    ]
                  };
                },
                data: values.map((v, i) => [i, v, errors[i]])
              }
            ]
          : [])
      ]
    };
  };

  const createHeatmap = (
    fingerprint: InteractionFingerprint,
    options: { title?: string } = {}
  ): EChartsOption => {
    const { title } = options;
    const residues = Object.keys(fingerprint);
    const interactionTypes = ['hydrogenBond', 'hydrophobic', 'piStacking', 'saltBridge', 'vanDerWaals'];
    const interactionLabels = ['氢键', '疏水作用', 'π-π堆积', '盐桥', '范德华力'];

    const data: [number, number, number][] = [];
    residues.forEach((residue, i) => {
      interactionTypes.forEach((type, j) => {
        const value = fingerprint[residue][type as keyof (typeof fingerprint)[string]];
        if (value > 0) {
          data.push([j, i, value]);
        }
      });
    });

    return {
      title: title ? { text: title, left: 'center' } : undefined,
      tooltip: {
        position: 'top',
        formatter: (params: unknown) => {
          const p = params as { data: [number, number, number] };
          const [j, i, value] = p.data;
          return `
            <div>残基: ${residues[i]}</div>
            <div>相互作用: ${interactionLabels[j]}</div>
            <div>强度: ${value.toFixed(4)}</div>
          `;
        }
      },
      grid: {
        left: '15%',
        right: '10%',
        bottom: '15%',
        top: title ? 60 : 30,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: interactionLabels,
        splitArea: { show: true },
        axisLabel: {
          rotate: 30,
          fontSize: 10
        }
      },
      yAxis: {
        type: 'category',
        data: residues,
        splitArea: { show: true },
        axisLabel: {
          fontSize: 9
        }
      },
      visualMap: {
        min: 0,
        max: Math.max(...data.map(d => d[2])) || 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '0%',
        inRange: {
          color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
        }
      },
      series: [
        {
          name: '相互作用指纹',
          type: 'heatmap',
          data,
          label: {
            show: true,
            fontSize: 8,
            formatter: (params: unknown) => {
              const p = params as { value: [number, number, number] };
              return p.value[2] > 0.1 ? p.value[2].toFixed(1) : '';
            }
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };
  };

  const createBoxPlot = (
    boxData: BoxPlotData[],
    options: { title?: string; yAxisName?: string } = {}
  ): EChartsOption => {
    const { title, yAxisName = '值' } = options;
    const names = boxData.map(d => d.name);
    const data = boxData.map(d => [d.min, d.q1, d.median, d.q3, d.max]);
    const outliers = boxData.flatMap((d, i) =>
      (d.outliers || []).map(v => [i, v])
    );

    return {
      title: title ? { text: title, left: 'center' } : undefined,
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { seriesName: string; name: string; data: number[] | [number, number] };
          if (p.seriesName === '异常值') {
            const [, value] = p.data as [number, number];
            return `<div>${p.name}<br/>异常值: ${value.toFixed(2)}</div>`;
          }
          const [min, q1, median, q3, max] = p.data as number[];
          return `
            <div>${p.name}</div>
            <div>最大值: ${max.toFixed(2)}</div>
            <div>上四分位数: ${q3.toFixed(2)}</div>
            <div>中位数: ${median.toFixed(2)}</div>
            <div>下四分位数: ${q1.toFixed(2)}</div>
            <div>最小值: ${min.toFixed(2)}</div>
          `;
        }
      },
      grid: {
        left: '10%',
        right: '10%',
        bottom: '15%',
        top: title ? 60 : 30,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: names,
        axisLabel: {
          rotate: 30,
          fontSize: 10
        }
      },
      yAxis: {
        type: 'value',
        name: yAxisName,
        scale: true
      },
      series: [
        {
          name: '箱线图',
          type: 'boxplot',
          data,
          itemStyle: {
            color: '#5470c6',
            borderColor: '#2e4e7e'
          }
        },
        ...(outliers.length > 0
          ? [
              {
                name: '异常值',
                type: 'scatter' as const,
                data: outliers,
                itemStyle: {
                  color: '#ee6666'
                }
              }
            ]
          : [])
      ]
    };
  };

  const createRadarChart = (
    indicators: RadarIndicator[],
    datasets: RadarData[],
    options: { title?: string } = {}
  ): EChartsOption => {
    const { title } = options;
    const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de'];

    return {
      title: title ? { text: title, left: 'center' } : undefined,
      tooltip: {
        trigger: 'item'
      },
      legend: {
        data: datasets.map(d => d.name),
        top: title ? 30 : 0,
        orient: 'horizontal'
      },
      radar: {
        indicator: indicators,
        shape: 'polygon',
        splitNumber: 4,
        axisName: {
          fontSize: 11
        },
        splitArea: {
          areaStyle: {
            color: ['rgba(114, 172, 209, 0.2)', 'rgba(114, 172, 209, 0.4)']
          }
        }
      },
      series: [
        {
          name: '方法对比',
          type: 'radar',
          data: datasets.map((d, i) => ({
            value: d.value,
            name: d.name,
            itemStyle: { color: colors[i % colors.length] },
            areaStyle: {
              color: colors[i % colors.length] + '30'
            }
          }))
        }
      ]
    };
  };

  const createPieChart = (
    data: { name: string; value: number }[],
    options: { title?: string; donut?: boolean } = {}
  ): EChartsOption => {
    const { title, donut = false } = options;

    return {
      title: title ? { text: title, left: 'center' } : undefined,
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: title ? 30 : 0
      },
      series: [
        {
          name: '统计',
          type: 'pie',
          radius: donut ? ['40%', '70%'] : '70%',
          center: ['50%', '50%'],
          data,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          label: {
            show: true,
            formatter: '{b}: {d}%'
          }
        }
      ]
    };
  };

  const createResidueContributionChart = (
    result: FreeEnergyResult,
    options: { title?: string; topN?: number } = {}
  ): EChartsOption => {
    const { title, topN = 20 } = options;
    const contributions = [...result.decompositionPerResidue]
      .sort((a, b) => Math.abs(b.energyContribution) - Math.abs(a.energyContribution))
      .slice(0, topN);

    const labels = contributions.map(
      c => `${c.residueName}${c.residueNumber}`
    );
    const values = contributions.map(c => c.energyContribution);
    const colors = values.map(v => (v < 0 ? '#5470c6' : '#ee6666'));

    return {
      title: title ? { text: title, left: 'center' } : undefined,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const p = params as { dataIndex: number }[];
          const idx = p[0]?.dataIndex ?? 0;
          const item = contributions[idx];
          if (!item) return '';
          return `
            <div>${item.residueName}${item.residueNumber}</div>
            <div>能量贡献: ${item.energyContribution.toFixed(3)} kcal/mol</div>
            ${item.interactionType ? `<div>类型: ${item.interactionType}</div>` : ''}
          `;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          rotate: 45,
          fontSize: 9
        }
      },
      yAxis: {
        type: 'value',
        name: '能量贡献 (kcal/mol)'
      },
      series: [
        {
          name: '能量贡献',
          type: 'bar',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: { color: colors[i] }
          }))
        }
      ]
    };
  };

  return {
    createLineChart,
    createMultiLineChart,
    createBarChart,
    createHeatmap,
    createBoxPlot,
    createRadarChart,
    createPieChart,
    createResidueContributionChart
  };
}

export default useCharts;
