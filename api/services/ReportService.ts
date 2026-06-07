import jsPDF from 'jspdf';
import { reportRepository } from '../repositories/ReportRepository.js';
import { taskRepository } from '../repositories/TaskRepository.js';
import { resultRepository } from '../repositories/ResultRepository.js';
import { monitoringRepository } from '../repositories/MonitoringRepository.js';
import type {
  Report,
  SimulationTask,
  FreeEnergyResult,
  MonitoringData,
  EnergyComponent,
  ResidueContribution,
  InteractionFingerprint
} from '../../shared/types.js';
import { FEMethod, FE_METHOD_LABELS, SIMULATION_STATUS_LABELS } from '../../shared/types.js';
import fs from 'fs';
import path from 'path';

export interface TrajectoryExportOptions {
  forceField?: string;
  temperature?: number;
  saltConcentration?: number;
  format?: 'csv' | 'json' | 'pdb';
}

export class ReportService {
  async generatePDFReport(taskId: string): Promise<string> {
    const task = taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    const results = resultRepository.findByTaskId(taskId);
    const monitoringData = monitoringRepository.findByTaskId(taskId, 1000);

    const doc = new jsPDF();
    let yOffset = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('结合自由能计算报告', pageWidth / 2, yOffset, { align: 'center' });
    yOffset += 15;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, margin, yOffset);
    yOffset += 10;

    this.addTaskInfoSection(doc, task, margin, yOffset);
    yOffset += 80;

    if (results.length > 0) {
      const result = results[0];
      
      if (yOffset > 250) {
        doc.addPage();
        yOffset = 20;
      }
      this.addFreeEnergyDecomposition(doc, result, margin, yOffset);
      yOffset += 60;

      if (yOffset > 250) {
        doc.addPage();
        yOffset = 20;
      }
      this.addEnergyComponentsTable(doc, result.energyComponents, margin, yOffset);
      yOffset += 40 + result.energyComponents.length * 8;
    }

    if (monitoringData.length > 0) {
      if (yOffset > 250) {
        doc.addPage();
        yOffset = 20;
      }
      this.addRMSDCurve(doc, monitoringData, margin, yOffset);
      yOffset += 70;
    }

    if (results.length > 0 && results[0].interactionFingerprint) {
      if (yOffset > 250) {
        doc.addPage();
        yOffset = 20;
      }
      this.addInteractionFingerprint(doc, results[0].interactionFingerprint, margin, yOffset);
      yOffset += 80;
    }

    if (yOffset > 250) {
      doc.addPage();
      yOffset = 20;
    }
    this.addBindingModeSnapshot(doc, task, margin, yOffset);

    const fileName = `report_${taskId}_${Date.now()}.pdf`;
    const filePath = path.join(process.cwd(), 'data', 'reports', fileName);
    
    const reportsDir = path.dirname(filePath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    doc.save(filePath);

    const stats = fs.statSync(filePath);
    await this.saveReportToDB(taskId, filePath, 'pdf', stats.size);

    return filePath;
  }

  private addTaskInfoSection(doc: jsPDF, task: SimulationTask, margin: number, y: number): void {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('一、任务信息', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const taskInfo = [
      { label: '任务名称', value: task.name },
      { label: '任务ID', value: task.id },
      { label: '靶标ID', value: task.targetId },
      { label: '状态', value: SIMULATION_STATUS_LABELS[task.status] || task.status },
      { label: '力场', value: task.forceField },
      { label: '温度', value: `${task.temperature} K` },
      { label: '盐浓度', value: `${task.saltConcentration} M` },
      { label: '计算方法', value: FE_METHOD_LABELS[task.feMethod as FEMethod] || task.feMethod },
      { label: 'RMSD阈值', value: `${task.rmsdThreshold} Å` },
      { label: '创建时间', value: new Date(task.createdAt).toLocaleString('zh-CN') },
      { label: '完成时间', value: task.completedAt ? new Date(task.completedAt).toLocaleString('zh-CN') : '-' }
    ];

    taskInfo.forEach((info, index) => {
      const infoY = y + index * 6;
      doc.text(`${info.label}:`, margin, infoY);
      doc.text(info.value, margin + 35, infoY);
    });
  }

  private addFreeEnergyDecomposition(doc: jsPDF, result: FreeEnergyResult, margin: number, y: number): void {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('二、结合自由能分解图', margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`总结合自由能: ${result.totalBindingEnergy.toFixed(2)} ± ${result.standardError.toFixed(2)} kcal/mol`, margin, y);
    y += 8;

    const chartWidth = 170;
    const chartHeight = 40;
    const chartX = margin;
    const chartY = y;

    doc.setDrawColor(0);
    doc.rect(chartX, chartY, chartWidth, chartHeight);

    const maxEnergy = Math.max(...result.decompositionPerResidue.map(r => Math.abs(r.energyContribution)), 1);
    const barWidth = chartWidth / result.decompositionPerResidue.length;

    result.decompositionPerResidue.forEach((residue, index) => {
      const barX = chartX + index * barWidth;
      const barHeight = (Math.abs(residue.energyContribution) / maxEnergy) * (chartHeight - 10);
      const barY = chartY + chartHeight - barHeight - 5;

      if (residue.energyContribution < 0) {
        doc.setFillColor(0, 128, 0);
      } else {
        doc.setFillColor(255, 0, 0);
      }
      doc.rect(barX + 1, barY, barWidth - 2, barHeight, 'F');

      if (index % 5 === 0) {
        doc.setFontSize(6);
        doc.text(`${residue.residueNumber}`, barX + barWidth / 2, chartY + chartHeight + 3, { align: 'center' });
      }
    });

    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text('残基编号', chartX + chartWidth / 2, chartY + chartHeight + 8, { align: 'center' });
    doc.text('能量贡献 (kcal/mol)', chartX - 10, chartY + chartHeight / 2, { align: 'center', angle: 90 });
  }

  private addEnergyComponentsTable(doc: jsPDF, components: EnergyComponent[], margin: number, y: number): void {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('自由能分量明细', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('分量名称', margin, y);
    doc.text('能量值 (kcal/mol)', margin + 60, y);
    doc.text('误差 (kcal/mol)', margin + 120, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    components.forEach((comp, index) => {
      const rowY = y + index * 8;
      doc.text(comp.name, margin, rowY);
      doc.text(comp.value.toFixed(4), margin + 60, rowY);
      doc.text(comp.error.toFixed(4), margin + 120, rowY);
    });
  }

  private addRMSDCurve(doc: jsPDF, data: MonitoringData[], margin: number, y: number): void {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('三、RMSD曲线', margin, y);
    y += 10;

    const chartWidth = 170;
    const chartHeight = 50;
    const chartX = margin;
    const chartY = y;

    doc.setDrawColor(0);
    doc.rect(chartX, chartY, chartWidth, chartHeight);

    const rmsdValues = data.map(d => d.rmsd);
    const maxRmsd = Math.max(...rmsdValues, 0.1);
    const minRmsd = Math.min(...rmsdValues, 0);
    const yRange = maxRmsd - minRmsd || 1;

    doc.setDrawColor(0, 0, 255);
    doc.setLineWidth(0.5);

    data.forEach((point, index) => {
      const x = chartX + (index / (data.length - 1)) * chartWidth;
      const yPoint = chartY + chartHeight - ((point.rmsd - minRmsd) / yRange) * (chartHeight - 10) - 5;
      
      if (index === 0) {
        doc.moveTo(x, yPoint);
      } else {
        doc.lineTo(x, yPoint);
      }
    });
    doc.stroke();

    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text('时间步', chartX + chartWidth / 2, chartY + chartHeight + 8, { align: 'center' });
    doc.text(`RMSD (Å)`, chartX - 10, chartY + chartHeight / 2, { align: 'center', angle: 90 });
    doc.text(`${maxRmsd.toFixed(1)}`, chartX - 5, chartY + 5);
    doc.text(`${minRmsd.toFixed(1)}`, chartX - 5, chartY + chartHeight - 5);
  }

  private addInteractionFingerprint(doc: jsPDF, fingerprint: InteractionFingerprint, margin: number, y: number): void {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('四、配体-残基相互作用指纹', margin, y);
    y += 10;

    const residues = Object.keys(fingerprint).slice(0, 15);
    const interactionTypes = ['hydrogenBond', 'hydrophobic', 'piStacking', 'saltBridge', 'vanDerWaals'];
    const typeLabels: Record<string, string> = {
      hydrogenBond: '氢键',
      hydrophobic: '疏水',
      piStacking: 'π-π堆积',
      saltBridge: '盐桥',
      vanDerWaals: '范德华'
    };

    const cellWidth = 12;
    const cellHeight = 10;
    const startX = margin;
    const startY = y;

    interactionTypes.forEach((type, typeIndex) => {
      doc.setFontSize(8);
      doc.text(typeLabels[type], startX - 5, startY + (typeIndex + 1) * cellHeight + 3);
    });

    residues.forEach((residue, resIndex) => {
      const cellX = startX + 35 + resIndex * cellWidth;
      doc.setFontSize(6);
      doc.text(residue, cellX + cellWidth / 2, startY + 5, { align: 'center' });

      interactionTypes.forEach((type, typeIndex) => {
        const cellY = startY + (typeIndex + 1) * cellHeight;
        const value = fingerprint[residue]?.[type as keyof typeof fingerprint[string]] || 0;
        
        const intensity = Math.min(value / 10, 1);
        const gray = Math.floor(255 * (1 - intensity * 0.8));
        doc.setFillColor(gray, gray, gray);
        doc.rect(cellX, cellY, cellWidth - 1, cellHeight - 1, 'F');

        if (value > 0) {
          doc.setFontSize(5);
          doc.setTextColor(intensity > 0.5 ? 255 : 0);
          doc.text(value.toFixed(0), cellX + cellWidth / 2, cellY + cellHeight / 2 + 1, { align: 'center' });
        }
      });
    });

    doc.setTextColor(0);
  }

  private addBindingModeSnapshot(doc: jsPDF, task: SimulationTask, margin: number, y: number): void {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('五、结合模式快照', margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('结合位点信息:', margin, y);
    y += 6;

    if (task.bindingSite) {
      doc.text(`中心坐标: (${task.bindingSite.center.x.toFixed(2)}, ${task.bindingSite.center.y.toFixed(2)}, ${task.bindingSite.center.z.toFixed(2)}) Å`, margin + 10, y);
      y += 5;
      doc.text(`半径: ${task.bindingSite.radius.toFixed(2)} Å`, margin + 10, y);
      y += 5;
      doc.text(`定义方法: ${task.bindingSite.method}`, margin + 10, y);
      y += 5;
      doc.text(`关键残基: ${task.bindingSite.residues.slice(0, 10).join(', ')}${task.bindingSite.residues.length > 10 ? '...' : ''}`, margin + 10, y);
      y += 10;
    }

    doc.text('蛋白质文件: ' + (task.proteinFilePath || '未提供'), margin, y);
    y += 5;
    doc.text('配体文件: ' + (task.ligandFilePath || '未提供'), margin, y);
    y += 10;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('* 3D结合模式快照可通过可视化工具查看完整结果文件', margin, y);
  }

  async exportTrajectoryData(taskId: string, options: TrajectoryExportOptions = {}): Promise<string> {
    const task = taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    if (options.forceField && task.forceField !== options.forceField) {
      throw new Error(`任务力场不匹配: 期望 ${options.forceField}, 实际 ${task.forceField}`);
    }
    if (options.temperature !== undefined && Math.abs(task.temperature - options.temperature) > 0.1) {
      throw new Error(`任务温度不匹配: 期望 ${options.temperature}K, 实际 ${task.temperature}K`);
    }
    if (options.saltConcentration !== undefined && Math.abs(task.saltConcentration - options.saltConcentration) > 0.001) {
      throw new Error(`任务盐浓度不匹配: 期望 ${options.saltConcentration}M, 实际 ${task.saltConcentration}M`);
    }

    const monitoringData = monitoringRepository.findByTaskId(taskId, 10000);
    const format = options.format || 'csv';

    let content: string;
    let fileName: string;

    if (format === 'csv') {
      const headers = ['timestamp', 'rmsd', 'potentialEnergy', 'temperature', 'pressure', 'volume'];
      content = headers.join(',') + '\n';
      monitoringData.forEach(d => {
        content += `${d.timestamp},${d.rmsd},${d.potentialEnergy},${d.temperature},${d.pressure},${d.volume}\n`;
      });
      fileName = `trajectory_${taskId}.csv`;
    } else if (format === 'json') {
      content = JSON.stringify(monitoringData, null, 2);
      fileName = `trajectory_${taskId}.json`;
    } else {
      content = `HEADER    TRAJECTORY DATA FOR TASK ${taskId}\n`;
      content += `REMARK    Force Field: ${task.forceField}\n`;
      content += `REMARK    Temperature: ${task.temperature}K\n`;
      content += `REMARK    Salt Concentration: ${task.saltConcentration}M\n`;
      monitoringData.forEach((d, i) => {
        content += `ATOM  ${String(i + 1).padStart(5)}  CA  ALA A   1      ${String(d.rmsd).padStart(8)}${String(d.potentialEnergy).padStart(8)}${String(d.temperature).padStart(8)}  1.00  ${d.rmsd.toFixed(2)}\n`;
      });
      fileName = `trajectory_${taskId}.pdb`;
    }

    const filePath = path.join(process.cwd(), 'data', 'exports', fileName);
    const exportsDir = path.dirname(filePath);
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    fs.writeFileSync(filePath, content);
    return filePath;
  }

  async exportFreeEnergyComponents(taskId: string): Promise<string> {
    const results = resultRepository.findByTaskId(taskId);
    if (results.length === 0) {
      throw new Error('未找到该任务的自由能结果');
    }

    const result = results[0];
    const content: string[] = [];
    
    content.push(`# 自由能分量数据 - 任务 ${taskId}`);
    content.push(`# 计算方法: ${result.method}`);
    content.push(`# 总结合自由能: ${result.totalBindingEnergy.toFixed(4)} ± ${result.standardError.toFixed(4)} kcal/mol`);
    content.push('');
    content.push('## 能量分量');
    content.push('| 分量名称 | 能量值 (kcal/mol) | 误差 (kcal/mol) |');
    content.push('|----------|------------------|----------------|');
    
    result.energyComponents.forEach(comp => {
      content.push(`| ${comp.name} | ${comp.value.toFixed(4)} | ${comp.error.toFixed(4)} |`);
    });

    content.push('');
    content.push('## 残基分解');
    content.push('| 残基编号 | 残基名称 | 能量贡献 (kcal/mol) | 相互作用类型 |');
    content.push('|----------|----------|-------------------|-------------|');
    
    result.decompositionPerResidue.forEach(res => {
      content.push(`| ${res.residueNumber} | ${res.residueName} | ${res.energyContribution.toFixed(4)} | ${res.interactionType || '-'} |`);
    });

    const fileName = `free_energy_${taskId}.md`;
    const filePath = path.join(process.cwd(), 'data', 'exports', fileName);
    const exportsDir = path.dirname(filePath);
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    fs.writeFileSync(filePath, content.join('\n'));
    return filePath;
  }

  async saveReportToDB(taskId: string, filePath: string, fileType: string, fileSize: number): Promise<Report> {
    const task = taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    const report = reportRepository.create({
      taskId,
      filePath,
      fileType,
      fileSize,
      generatedAt: new Date().toISOString()
    } as Omit<Report, 'id'>);

    return report;
  }
}

export const reportService = new ReportService();
