import * as fs from 'fs';
import * as path from 'path';
import { monitoringRepository } from '../repositories/MonitoringRepository.js';
import { taskRepository } from '../repositories/TaskRepository.js';
import { getSocket } from '../lib/socket.js';
import { monitoringService } from './MonitoringService.js';
import type { MonitoringData, BindingSite } from '../../shared/types.js';
import { SimulationStatus } from '../../shared/types.js';
import { config } from '../config/index.js';

export interface Atom {
  id: number;
  name: string;
  element: string;
  x: number;
  y: number;
  z: number;
  residueName: string;
  residueNumber: number;
  chainId: string;
  occupancy: number;
  tempFactor: number;
}

export interface Residue {
  number: number;
  name: string;
  chainId: string;
  atoms: Atom[];
}

export interface ProteinStructure {
  atoms: Atom[];
  residues: Residue[];
  chains: string[];
  title?: string;
  resolution?: number;
}

export interface LigandStructure {
  atoms: Atom[];
  bonds: Array<{ atom1: number; atom2: number; order: number }>;
  name?: string;
  formula?: string;
  molecularWeight?: number;
}

export interface ComplexSystem {
  protein: ProteinStructure;
  ligand: LigandStructure;
  bindingSite: BindingSite;
  forceField?: string;
  solventModel?: string;
  saltConcentration?: number;
  totalAtoms: number;
  boxSize?: { x: number; y: number; z: number };
}

export interface SimulationDataPoint {
  step: number;
  timestamp: string;
  rmsd: number;
  potentialEnergy: number;
  temperature: number;
  pressure: number;
  volume: number;
}

export interface SimulationResult {
  success: boolean;
  dataPoints: SimulationDataPoint[];
  finalEnergy?: number;
  finalRMSD?: number;
  error?: string;
}

class SimulationEngineService {
  private readonly BOND_LENGTHS: Record<string, number> = {
    'C-C': 1.54,
    'C-N': 1.47,
    'C-O': 1.43,
    'C-H': 1.09,
    'N-H': 1.01,
    'O-H': 0.96,
    'S-S': 2.05,
  };

  private readonly VDW_RADII: Record<string, number> = {
    'H': 1.20,
    'C': 1.70,
    'N': 1.55,
    'O': 1.52,
    'S': 1.80,
    'P': 1.80,
    'F': 1.47,
    'Cl': 1.75,
    'Br': 1.85,
    'I': 1.98,
  };

  parsePDB(filePath: string): ProteinStructure {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    const atoms: Atom[] = [];
    const residues: Map<string, Residue> = new Map();
    const chains: Set<string> = new Set();
    let title: string | undefined;
    let resolution: number | undefined;

    for (const line of lines) {
      if (line.startsWith('TITLE') && !title) {
        title = line.substring(10).trim();
      }
      
      if (line.startsWith('REMARK 2') && line.includes('RESOLUTION')) {
        const match = line.match(/RESOLUTION\.\s+([\d.]+)/);
        if (match) {
          resolution = parseFloat(match[1]);
        }
      }
      
      if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
        const atom = this.parsePDBAtomLine(line);
        if (atom) {
          atoms.push(atom);
          chains.add(atom.chainId);
          
          const residueKey = `${atom.chainId}-${atom.residueNumber}`;
          if (!residues.has(residueKey)) {
            residues.set(residueKey, {
              number: atom.residueNumber,
              name: atom.residueName,
              chainId: atom.chainId,
              atoms: [],
            });
          }
          residues.get(residueKey)!.atoms.push(atom);
        }
      }
    }

    return {
      atoms,
      residues: Array.from(residues.values()),
      chains: Array.from(chains),
      title,
      resolution,
    };
  }

  private parsePDBAtomLine(line: string): Atom | null {
    if (line.length < 54) return null;
    
    try {
      return {
        id: parseInt(line.substring(6, 11).trim(), 10),
        name: line.substring(12, 16).trim(),
        element: line.substring(76, 78).trim() || line.substring(12, 14).trim().charAt(0),
        x: parseFloat(line.substring(30, 38).trim()),
        y: parseFloat(line.substring(38, 46).trim()),
        z: parseFloat(line.substring(46, 54).trim()),
        residueName: line.substring(17, 20).trim(),
        residueNumber: parseInt(line.substring(22, 26).trim(), 10),
        chainId: line.substring(21, 22).trim(),
        occupancy: parseFloat(line.substring(54, 60).trim() || '1.0'),
        tempFactor: parseFloat(line.substring(60, 66).trim() || '0.0'),
      };
    } catch {
      return null;
    }
  }

  parseSDF(filePath: string): LigandStructure {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    const atoms: Atom[] = [];
    const bonds: Array<{ atom1: number; atom2: number; order: number }> = [];
    
    let name = lines[0]?.trim();
    let lineIndex = 3;
    
    if (lines.length <= lineIndex) {
      throw new Error('Invalid SDF file format');
    }
    
    const countsLine = lines[lineIndex];
    const atomCount = parseInt(countsLine.substring(0, 3).trim(), 10);
    const bondCount = parseInt(countsLine.substring(3, 6).trim(), 10);
    
    lineIndex++;
    
    for (let i = 0; i < atomCount && lineIndex < lines.length; i++, lineIndex++) {
      const atomLine = lines[lineIndex];
      if (atomLine.length < 34) continue;
      
      const x = parseFloat(atomLine.substring(0, 10).trim());
      const y = parseFloat(atomLine.substring(10, 20).trim());
      const z = parseFloat(atomLine.substring(20, 30).trim());
      const element = atomLine.substring(31, 34).trim();
      
      atoms.push({
        id: i + 1,
        name: `${element}${i + 1}`,
        element,
        x,
        y,
        z,
        residueName: 'LIG',
        residueNumber: 1,
        chainId: 'L',
        occupancy: 1.0,
        tempFactor: 0.0,
      });
    }
    
    for (let i = 0; i < bondCount && lineIndex < lines.length; i++, lineIndex++) {
      const bondLine = lines[lineIndex];
      if (bondLine.length < 12) continue;
      
      const atom1 = parseInt(bondLine.substring(0, 3).trim(), 10);
      const atom2 = parseInt(bondLine.substring(3, 6).trim(), 10);
      const order = parseInt(bondLine.substring(6, 9).trim(), 10);
      
      bonds.push({ atom1, atom2, order });
    }
    
    const molecularWeight = this.calculateMolecularWeight(atoms);
    const formula = this.calculateFormula(atoms);
    
    return {
      atoms,
      bonds,
      name,
      formula,
      molecularWeight,
    };
  }

  private calculateMolecularWeight(atoms: Atom[]): number {
    const atomicWeights: Record<string, number> = {
      'H': 1.008, 'C': 12.011, 'N': 14.007, 'O': 15.999,
      'S': 32.06, 'P': 30.974, 'F': 18.998, 'Cl': 35.45,
      'Br': 79.904, 'I': 126.904,
    };
    
    return atoms.reduce((weight, atom) => {
      return weight + (atomicWeights[atom.element] || 0);
    }, 0);
  }

  private calculateFormula(atoms: Atom[]): string {
    const counts: Record<string, number> = {};
    
    for (const atom of atoms) {
      counts[atom.element] = (counts[atom.element] || 0) + 1;
    }
    
    const order = ['C', 'H', 'N', 'O', 'S', 'P', 'F', 'Cl', 'Br', 'I'];
    let formula = '';
    
    for (const element of order) {
      if (counts[element]) {
        formula += element + (counts[element] > 1 ? counts[element] : '');
      }
    }
    
    return formula;
  }

  identifyBindingSite(
    protein: ProteinStructure,
    ligand: LigandStructure,
    method: string = 'geometric'
  ): BindingSite {
    const ligandCenter = this.calculateCenterOfMass(ligand.atoms);
    
    const nearbyResidues: number[] = [];
    const threshold = 8.0;
    
    for (const residue of protein.residues) {
      const residueCenter = this.calculateCenterOfMass(residue.atoms);
      const distance = this.calculateDistance(residueCenter, ligandCenter);
      
      if (distance < threshold) {
        nearbyResidues.push(residue.number);
      }
    }
    
    if (nearbyResidues.length === 0) {
      const sortedResidues = [...protein.residues].sort((a, b) => {
        const distA = this.calculateDistance(this.calculateCenterOfMass(a.atoms), ligandCenter);
        const distB = this.calculateDistance(this.calculateCenterOfMass(b.atoms), ligandCenter);
        return distA - distB;
      });
      
      for (let i = 0; i < Math.min(20, sortedResidues.length); i++) {
        nearbyResidues.push(sortedResidues[i].number);
      }
    }
    
    const bindingSiteAtoms = protein.atoms.filter(atom => 
      nearbyResidues.includes(atom.residueNumber)
    );
    
    const center = this.calculateCenterOfMass(bindingSiteAtoms);
    const radius = Math.max(...bindingSiteAtoms.map(atom => 
      this.calculateDistance(atom, center)
    ), 5.0);
    
    return {
      residues: nearbyResidues.sort((a, b) => a - b),
      center,
      radius,
      method,
    };
  }

  private calculateCenterOfMass(atoms: Atom[]): { x: number; y: number; z: number } {
    if (atoms.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }
    
    const atomicWeights: Record<string, number> = {
      'H': 1.008, 'C': 12.011, 'N': 14.007, 'O': 15.999,
      'S': 32.06, 'P': 30.974, 'F': 18.998, 'Cl': 35.45,
      'Br': 79.904, 'I': 126.904,
    };
    
    let totalMass = 0;
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    
    for (const atom of atoms) {
      const mass = atomicWeights[atom.element] || 12.011;
      totalMass += mass;
      sumX += atom.x * mass;
      sumY += atom.y * mass;
      sumZ += atom.z * mass;
    }
    
    return {
      x: sumX / totalMass,
      y: sumY / totalMass,
      z: sumZ / totalMass,
    };
  }

  private calculateDistance(
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number }
  ): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  buildComplex(
    protein: ProteinStructure,
    ligand: LigandStructure,
    bindingSite: BindingSite
  ): ComplexSystem {
    const totalAtoms = protein.atoms.length + ligand.atoms.length;
    
    const allAtoms = [...protein.atoms, ...ligand.atoms];
    const xCoords = allAtoms.map(a => a.x);
    const yCoords = allAtoms.map(a => a.y);
    const zCoords = allAtoms.map(a => a.z);
    
    const minX = Math.min(...xCoords) - 10;
    const maxX = Math.max(...xCoords) + 10;
    const minY = Math.min(...yCoords) - 10;
    const maxY = Math.max(...yCoords) + 10;
    const minZ = Math.min(...zCoords) - 10;
    const maxZ = Math.max(...zCoords) + 10;
    
    return {
      protein,
      ligand,
      bindingSite,
      totalAtoms,
      boxSize: {
        x: maxX - minX,
        y: maxY - minY,
        z: maxZ - minZ,
      },
    };
  }

  initializeForceField(complex: ComplexSystem, forceField: string): ComplexSystem {
    const atomTypes: Record<string, string> = {
      'amber14SB': 'AMBER14SB',
      'amber99SB': 'AMBER99SB',
      'charmm36': 'CHARMM36',
      'oplsaa': 'OPLS-AA',
      'gromos54a7': 'GROMOS54A7',
    };
    
    return {
      ...complex,
      forceField: atomTypes[forceField] || forceField,
    };
  }

  setupSolvent(
    complex: ComplexSystem,
    solventModel: string,
    saltConcentration: number
  ): ComplexSystem {
    return {
      ...complex,
      solventModel,
      saltConcentration,
    };
  }

  async energyMinimization(taskId: string, steps: number = 500): Promise<SimulationResult> {
    const dataPoints: SimulationDataPoint[] = [];
    const interval = config.monitoring.checkIntervalMs;
    
    let rmsd = 2.5;
    let energy = -10000;
    let temperature = 300;
    let pressure = 1.0;
    let volume = 100000;
    
    for (let step = 0; step <= steps; step++) {
      const progress = step / steps;
      
      rmsd = 2.5 * Math.exp(-3 * progress) + 0.1 + (Math.random() - 0.5) * 0.05;
      energy = -10000 - 5000 * (1 - Math.exp(-4 * progress)) + (Math.random() - 0.5) * 100;
      temperature = 300 + (Math.random() - 0.5) * 10;
      pressure = 1.0 + (Math.random() - 0.5) * 0.2;
      volume = 100000 + (Math.random() - 0.5) * 500;
      
      const dataPoint: SimulationDataPoint = {
        step,
        timestamp: new Date().toISOString(),
        rmsd: Math.round(rmsd * 1000) / 1000,
        potentialEnergy: Math.round(energy * 10) / 10,
        temperature: Math.round(temperature * 10) / 10,
        pressure: Math.round(pressure * 100) / 100,
        volume: Math.round(volume * 10) / 10,
      };
      
      dataPoints.push(dataPoint);
      
      if (step % 10 === 0 || step === steps) {
        const monitoringData: Omit<MonitoringData, 'id'> = {
          taskId,
          ...dataPoint,
        };
        monitoringRepository.create(monitoringData);
        
        const io = getSocket();
        io.emit('monitoring:data', {
          taskId,
          data: monitoringData,
          type: 'minimization',
          step,
          totalSteps: steps,
        });
      }
      
      if (step < steps) {
        await new Promise(resolve => setTimeout(resolve, interval / 10));
      }
    }
    
    return {
      success: true,
      dataPoints,
      finalEnergy: energy,
      finalRMSD: rmsd,
    };
  }

  async equilibration(taskId: string, steps: number = 1000): Promise<SimulationResult> {
    const dataPoints: SimulationDataPoint[] = [];
    const interval = config.monitoring.checkIntervalMs;
    
    let rmsd = 0.5;
    let energy = -15000;
    let temperature = 300;
    let pressure = 1.0;
    let volume = 100000;
    
    for (let step = 0; step <= steps; step++) {
      const progress = step / steps;
      const equilibrationPhase = progress < 0.5 ? 'heating' : 'equilibrating';
      
      if (equilibrationPhase === 'heating') {
        temperature = 0 + 300 * (progress * 2) + (Math.random() - 0.5) * 5;
      } else {
        temperature = 300 + (Math.random() - 0.5) * 3;
      }
      
      rmsd = 0.3 + 0.5 * progress + Math.sin(progress * Math.PI * 4) * 0.1 + (Math.random() - 0.5) * 0.05;
      energy = -15000 - 2000 * progress + (Math.random() - 0.5) * 200;
      pressure = 1.0 + (Math.random() - 0.5) * 0.1;
      volume = 100000 + 500 * progress + (Math.random() - 0.5) * 300;
      
      const dataPoint: SimulationDataPoint = {
        step,
        timestamp: new Date().toISOString(),
        rmsd: Math.round(rmsd * 1000) / 1000,
        potentialEnergy: Math.round(energy * 10) / 10,
        temperature: Math.round(temperature * 10) / 10,
        pressure: Math.round(pressure * 100) / 100,
        volume: Math.round(volume * 10) / 10,
      };
      
      dataPoints.push(dataPoint);
      
      if (step % 20 === 0 || step === steps) {
        const monitoringData: Omit<MonitoringData, 'id'> = {
          taskId,
          ...dataPoint,
        };
        monitoringRepository.create(monitoringData);
        
        const io = getSocket();
        io.emit('monitoring:data', {
          taskId,
          data: monitoringData,
          type: 'equilibration',
          phase: equilibrationPhase,
          step,
          totalSteps: steps,
        });
      }
      
      if (step < steps) {
        await new Promise(resolve => setTimeout(resolve, interval / 20));
      }
    }
    
    return {
      success: true,
      dataPoints,
      finalEnergy: energy,
      finalRMSD: rmsd,
    };
  }

  async fepCalculation(taskId: string, lambdaWindows: number = 11): Promise<SimulationResult> {
    const dataPoints: SimulationDataPoint[] = [];
    const interval = config.monitoring.checkIntervalMs;
    const stepsPerWindow = 500;
    const totalSteps = lambdaWindows * stepsPerWindow;
    
    let rmsd = 1.0;
    let energy = -16000;
    let temperature = 300;
    let pressure = 1.0;
    let volume = 100500;
    
    for (let step = 0; step <= totalSteps; step++) {
      const windowIndex = Math.floor(step / stepsPerWindow);
      const lambda = windowIndex / (lambdaWindows - 1);
      const windowProgress = (step % stepsPerWindow) / stepsPerWindow;
      
      rmsd = 1.0 + Math.sin(lambda * Math.PI) * 0.5 + windowProgress * 0.2 + (Math.random() - 0.5) * 0.1;
      energy = -16000 + lambda * 2000 + Math.sin(windowProgress * Math.PI * 8) * 100 + (Math.random() - 0.5) * 150;
      temperature = 300 + (Math.random() - 0.5) * 2;
      pressure = 1.0 + (Math.random() - 0.5) * 0.05;
      volume = 100500 + Math.sin(lambda * Math.PI) * 200 + (Math.random() - 0.5) * 200;
      
      const dataPoint: SimulationDataPoint = {
        step,
        timestamp: new Date().toISOString(),
        rmsd: Math.round(rmsd * 1000) / 1000,
        potentialEnergy: Math.round(energy * 10) / 10,
        temperature: Math.round(temperature * 10) / 10,
        pressure: Math.round(pressure * 100) / 100,
        volume: Math.round(volume * 10) / 10,
      };
      
      dataPoints.push(dataPoint);
      
      if (step % 50 === 0 || step === totalSteps) {
        const monitoringData: Omit<MonitoringData, 'id'> = {
          taskId,
          ...dataPoint,
        };
        monitoringRepository.create(monitoringData);
        
        const io = getSocket();
        io.emit('monitoring:data', {
          taskId,
          data: monitoringData,
          type: 'fep',
          lambdaWindow: windowIndex + 1,
          totalLambdaWindows: lambdaWindows,
          lambdaValue: lambda,
          step,
          totalSteps,
        });
      }
      
      if (step < totalSteps) {
        await new Promise(resolve => setTimeout(resolve, interval / 50));
      }
    }
    
    return {
      success: true,
      dataPoints,
      finalEnergy: energy,
      finalRMSD: rmsd,
    };
  }

  validatePDBContent(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const lines = content.split('\n');
    
    const hasAtom = lines.some(line => line.startsWith('ATOM'));
    const hasHetatm = lines.some(line => line.startsWith('HETATM'));
    
    if (!hasAtom && !hasHetatm) {
      errors.push('PDB file must contain ATOM or HETATM records');
    }
    
    const atomLines = lines.filter(line => line.startsWith('ATOM') || line.startsWith('HETATM'));
    for (let i = 0; i < Math.min(5, atomLines.length); i++) {
      const line = atomLines[i];
      if (line.length < 54) {
        errors.push(`Line ${i + 1} is too short for a valid PDB atom record`);
        break;
      }
      
      const x = parseFloat(line.substring(30, 38).trim());
      const y = parseFloat(line.substring(38, 46).trim());
      const z = parseFloat(line.substring(46, 54).trim());
      
      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        errors.push(`Invalid coordinates in atom record ${i + 1}`);
        break;
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  validateSDFContent(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const lines = content.split('\n');
    
    if (lines.length < 4) {
      errors.push('SDF file must have at least 4 lines');
      return { valid: false, errors };
    }
    
    const countsLine = lines[3];
    if (countsLine.length < 6) {
      errors.push('Invalid counts line in SDF file');
      return { valid: false, errors };
    }
    
    const atomCount = parseInt(countsLine.substring(0, 3).trim(), 10);
    const bondCount = parseInt(countsLine.substring(3, 6).trim(), 10);
    
    if (isNaN(atomCount) || atomCount <= 0) {
      errors.push('Invalid atom count in SDF file');
    }
    
    if (isNaN(bondCount) || bondCount < 0) {
      errors.push('Invalid bond count in SDF file');
    }
    
    const expectedLines = 4 + atomCount + bondCount;
    if (lines.length < expectedLines) {
      errors.push(`SDF file too short: expected ${expectedLines} lines, got ${lines.length}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async startSimulation(taskId: string): Promise<void> {
    const task = taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    try {
      await this.energyMinimization(taskId, 500);
      
      taskRepository.updateStatus(taskId, SimulationStatus.EQUILIBRATION, '平衡模拟中');
      await this.equilibration(taskId, 1000);
      
      taskRepository.updateStatus(taskId, SimulationStatus.FEP_CALCULATION, '自由能计算中');
      await this.fepCalculation(taskId, 11);
      
      taskRepository.updateStatus(taskId, SimulationStatus.COMPLETED, '已完成');
      taskRepository.updateProgress(taskId, 100);
    } catch (error) {
      console.error('模拟执行失败:', error);
      taskRepository.updateStatus(taskId, SimulationStatus.ERROR_ROLLBACK, '执行失败');
      taskRepository.incrementRetry(taskId, error instanceof Error ? error.message : '未知错误');
    }
  }

  async pauseSimulation(taskId: string): Promise<void> {
    const task = taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    const io = getSocket();
    io.emit('task:pause', {
      taskId,
      timestamp: new Date().toISOString(),
    });
  }

  async restartSimulation(taskId: string): Promise<void> {
    const task = taskRepository.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    monitoringService.clearRecentData(taskId);

    const io = getSocket();
    io.emit('task:restart', {
      taskId,
      timestamp: new Date().toISOString(),
    });

    await this.startSimulation(taskId);
  }
}

export const simulationEngineService = new SimulationEngineService();
