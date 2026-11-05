import { ComparisonReport, SimulationEvent, SimulationMetrics } from '../types';

export class CsvExporter {
  static exportEventsToCsv(events: SimulationEvent[], filename: string = 'nexus_decision_logs.csv'): void {
    const headers = ['Timestamp_s', 'Type', 'Severity', 'Approach', 'Message'];
    const rows = events.map((e) => [
      e.timestamp.toFixed(1),
      `"${e.type}"`,
      `"${e.severity}"`,
      `"${e.approach}"`,
      `"${e.message.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    CsvExporter.triggerDownload(csvContent, filename);
  }

  static exportComparisonToCsv(report: ComparisonReport, filename: string = 'nexus_comparison_report.csv'): void {
    const lines: string[] = [];

    // Header metadata
    lines.push(`NEXUS TRAFFIC INTELLIGENCE - EXPERIMENTAL COMPARISON REPORT`);
    lines.push(`Scenario,"${report.scenarioName}"`);
    lines.push(`Horizon_seconds,${report.horizon}`);
    lines.push(`Random_Seed,${report.seed}`);
    lines.push('');

    // Summary KPI comparison table
    lines.push(`Metric,Fixed_Time,Adaptive,Delta_Percent`);
    lines.push(`Average Waiting Time (s),${report.fixed.avgWaitingTime},${report.adaptive.avgWaitingTime},${report.deltas.avgWaitPercent}%`);
    lines.push(`Median Waiting Time (s),${report.fixed.medianWaitingTime},${report.adaptive.medianWaitingTime},-`);
    lines.push(`95th Percentile Wait (s),${report.fixed.p95WaitingTime},${report.adaptive.p95WaitingTime},-`);
    lines.push(`Maximum Waiting Time (s),${report.fixed.maxWaitingTime},${report.adaptive.maxWaitingTime},${report.deltas.maxWaitPercent}%`);
    lines.push(`Vehicles Served,${report.fixed.totalServed},${report.adaptive.totalServed},${report.deltas.servedPercent}%`);
    lines.push(`Throughput (veh/min),${report.fixed.throughputPerMin},${report.adaptive.throughputPerMin},${report.deltas.throughputPercent}%`);
    lines.push(`Remaining Queued,${report.fixed.remainingQueue},${report.adaptive.remainingQueue},${report.deltas.queuePercent}%`);
    lines.push(`Phase Changes,${report.fixed.phaseChangeCount},${report.adaptive.phaseChangeCount},-`);
    lines.push('');

    // Timeline data
    lines.push(`Time_s,Queue_Fixed,Queue_Adaptive,AvgWait_Fixed,AvgWait_Adaptive,Served_Fixed,Served_Adaptive`);
    for (const p of report.timeline) {
      lines.push(`${p.time},${p.queueFixed},${p.queueAdaptive},${p.avgWaitFixed},${p.avgWaitAdaptive},${p.servedFixed},${p.servedAdaptive}`);
    }

    lines.push('');
    lines.push(`Interpretation,"${report.interpretation.replace(/"/g, '""')}"`);

    const csvContent = lines.join('\n');
    CsvExporter.triggerDownload(csvContent, filename);
  }

  static exportMetricsToCsv(metrics: SimulationMetrics, filename: string = 'nexus_simulation_metrics.csv'): void {
    const lines: string[] = [];
    lines.push(`Metric,Value`);
    lines.push(`Simulation Time (s),${metrics.simulationTime}`);
    lines.push(`Total Generated,${metrics.totalGenerated}`);
    lines.push(`Total Served,${metrics.totalServed}`);
    lines.push(`Currently Queued,${metrics.currentQueued}`);
    lines.push(`Queue North,${metrics.approachQueues.N}`);
    lines.push(`Queue South,${metrics.approachQueues.S}`);
    lines.push(`Queue East,${metrics.approachQueues.E}`);
    lines.push(`Queue West,${metrics.approachQueues.W}`);
    lines.push(`Average Waiting Time (s),${metrics.avgWaitingTime}`);
    lines.push(`Median Waiting Time (s),${metrics.medianWaitingTime}`);
    lines.push(`95th Percentile Wait (s),${metrics.p95WaitingTime}`);
    lines.push(`Max Waiting Time (s),${metrics.maxWaitingTime}`);
    lines.push(`Throughput (veh/min),${metrics.throughputPerMin}`);
    lines.push(`Phase Changes,${metrics.phaseChangeCount}`);

    const csvContent = lines.join('\n');
    CsvExporter.triggerDownload(csvContent, filename);
  }

  private static triggerDownload(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
