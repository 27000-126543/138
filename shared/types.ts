export enum SimulationStatus {
  PENDING_VALIDATION = 'pending_validation',
  SYSTEM_BUILDING = 'system_building',
  ENERGY_MINIMIZATION = 'energy_minimization',
  EQUILIBRATION = 'equilibration',
  FEP_CALCULATION = 'fep_calculation',
  COMPLETED = 'completed',
  ERROR_ROLLBACK = 'error_rollback'
}

export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  FATAL = 'fatal'
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export enum FEMethod {
  FEP = 'fep',
  TI = 'ti',
  MMPBSA = 'mmpbsa'
}

export enum UserRole {
  COMPUTATIONAL_CHEMIST = 'computational_chemist',
  MEDICINAL_CHEMIST = 'medicinal_chemist',
  SYNTHESIS_TEAM = 'synthesis_team',
  CHIEF_SCIENTIST = 'chief_scientist',
  ADMIN = 'admin'
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: string;
  lastLogin?: string;
}

export interface Target {
  id: string;
  name: string;
  uniprotId?: string;
  pdbId?: string;
  description?: string;
  isPaused: boolean;
  pauseReason?: string;
  pausedAt?: string;
  pausedBy?: string;
  consecutiveDeviations: number;
  lastDeviationCheck?: string;
}

export interface BindingSite {
  residues: number[];
  center: { x: number; y: number; z: number };
  radius: number;
  method: string;
}

export interface SimulationTask {
  id: string;
  name: string;
  targetId: string;
  target?: Target;
  createdBy: string;
  creator?: User;
  assignedTo?: string;
  assignee?: User;
  status: SimulationStatus;
  forceField: string;
  temperature: number;
  saltConcentration: number;
  feMethod: FEMethod;
  rmsdThreshold: number;
  progress: number;
  currentStep?: string;
  estimatedTime?: number;
  proteinFilePath?: string;
  ligandFilePath?: string;
  bindingSite?: BindingSite;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  retryCount: number;
  lastError?: string;
}

export interface MonitoringData {
  id?: number;
  taskId: string;
  timestamp: string;
  rmsd: number;
  potentialEnergy: number;
  temperature: number;
  pressure: number;
  volume: number;
}

export interface Alert {
  id: string;
  taskId: string;
  task?: SimulationTask;
  level: AlertLevel;
  type: string;
  message: string;
  metric?: string;
  value?: number;
  threshold?: number;
  timestamp: string;
  reviewedBy?: string;
  reviewer?: User;
  reviewComment?: string;
  reviewAction?: string;
  reviewedAt?: string;
}

export interface Approval {
  id: string;
  taskId: string;
  task?: SimulationTask;
  level: number;
  status: ApprovalStatus;
  approverId: string;
  approver?: User;
  comment?: string;
  signedAt?: string;
}

export interface EnergyComponent {
  name: string;
  value: number;
  error: number;
}

export interface ResidueContribution {
  residueNumber: number;
  residueName: string;
  energyContribution: number;
  interactionType?: string;
}

export interface InteractionFingerprint {
  [residue: string]: {
    hydrogenBond: number;
    hydrophobic: number;
    piStacking: number;
    saltBridge: number;
    vanDerWaals: number;
  };
}

export interface FreeEnergyResult {
  id: string;
  taskId: string;
  method: FEMethod;
  totalBindingEnergy: number;
  standardError: number;
  energyComponents: EnergyComponent[];
  decompositionPerResidue: ResidueContribution[];
  interactionFingerprint: InteractionFingerprint;
  calculatedAt: string;
}

export interface ParameterAdjustment {
  id: string;
  taskId: string;
  adjustedBy: string;
  adjuster?: User;
  parameterName: string;
  oldValue: string;
  newValue: string;
  reason: string;
  adjustedAt: string;
}

export interface SimulationLog {
  id: string;
  taskId: string;
  level: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface Report {
  id: string;
  taskId: string;
  task?: SimulationTask;
  filePath: string;
  fileType: string;
  fileSize: number;
  generatedAt: string;
}

export interface DailyStats {
  date: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  completionRate: number;
  averageError: number;
  totalComputeHours: number;
  averageSimulationTime: number;
  alertsGenerated: number;
  approvalsProcessed: number;
}

export interface Recommendation {
  method: FEMethod;
  confidence: number;
  reason: string;
  samplingStrategy: {
    equilibrationTime: number;
    productionTime: number;
    replicaCount: number;
    lambdaWindows: number;
  };
  historicalPerformance: {
    method: FEMethod;
    averageError: number;
    successRate: number;
    sampleSize: number;
  }[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export interface CreateTaskRequest {
  name: string;
  targetId: string;
  forceField: string;
  temperature: number;
  saltConcentration: number;
  feMethod: string;
  rmsdThreshold: number;
  proteinFilePath?: string;
  ligandFilePath?: string;
  bindingSite?: BindingSite;
  [key: string]: any;
}

export interface TaskListFilters {
  status?: SimulationStatus;
  targetId?: string;
  createdBy?: string;
  assignedTo?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const SIMULATION_STATUS_LABELS: Record<SimulationStatus, string> = {
  [SimulationStatus.PENDING_VALIDATION]: '待校验',
  [SimulationStatus.SYSTEM_BUILDING]: '体系构建',
  [SimulationStatus.ENERGY_MINIMIZATION]: '能量最小化',
  [SimulationStatus.EQUILIBRATION]: '平衡模拟',
  [SimulationStatus.FEP_CALCULATION]: '自由能微扰',
  [SimulationStatus.COMPLETED]: '已完成',
  [SimulationStatus.ERROR_ROLLBACK]: '异常回退'
};

export const SIMULATION_STATUS_COLORS: Record<SimulationStatus, string> = {
  [SimulationStatus.PENDING_VALIDATION]: 'bg-slate-500',
  [SimulationStatus.SYSTEM_BUILDING]: 'bg-blue-500',
  [SimulationStatus.ENERGY_MINIMIZATION]: 'bg-cyan-500',
  [SimulationStatus.EQUILIBRATION]: 'bg-teal-500',
  [SimulationStatus.FEP_CALCULATION]: 'bg-purple-500',
  [SimulationStatus.COMPLETED]: 'bg-emerald-500',
  [SimulationStatus.ERROR_ROLLBACK]: 'bg-red-500'
};

export const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  [AlertLevel.INFO]: '信息',
  [AlertLevel.WARNING]: '警告',
  [AlertLevel.CRITICAL]: '严重',
  [AlertLevel.FATAL]: '致命'
};

export const ALERT_LEVEL_COLORS: Record<AlertLevel, string> = {
  [AlertLevel.INFO]: 'bg-blue-500',
  [AlertLevel.WARNING]: 'bg-amber-500',
  [AlertLevel.CRITICAL]: 'bg-orange-500',
  [AlertLevel.FATAL]: 'bg-red-600'
};

export const FE_METHOD_LABELS: Record<FEMethod, string> = {
  [FEMethod.FEP]: 'FEP 自由能微扰',
  [FEMethod.TI]: 'TI 热力学积分',
  [FEMethod.MMPBSA]: 'MM-PBSA 分子力学泊松玻尔兹曼表面积'
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  [ApprovalStatus.PENDING]: '待审批',
  [ApprovalStatus.APPROVED]: '已批准',
  [ApprovalStatus.REJECTED]: '已拒绝'
};

export const APPROVAL_STATUS_COLORS: Record<ApprovalStatus, string> = {
  [ApprovalStatus.PENDING]: 'bg-amber-500',
  [ApprovalStatus.APPROVED]: 'bg-green-500',
  [ApprovalStatus.REJECTED]: 'bg-red-500'
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.COMPUTATIONAL_CHEMIST]: '计算化学家',
  [UserRole.MEDICINAL_CHEMIST]: '药物化学家',
  [UserRole.SYNTHESIS_TEAM]: '合成优化小组',
  [UserRole.CHIEF_SCIENTIST]: '首席科学家',
  [UserRole.ADMIN]: '系统管理员'
};

export const FORCE_FIELD_OPTIONS = [
  { value: 'amber14SB', label: 'Amber ff14SB' },
  { value: 'amber99SB', label: 'Amber ff99SB' },
  { value: 'charmm36', label: 'CHARMM36' },
  { value: 'oplsaa', label: 'OPLS-AA' },
  { value: 'gromos54a7', label: 'GROMOS 54A7' }
];

export const SOLVENT_MODELS = [
  { value: 'tip3p', label: 'TIP3P' },
  { value: 'tip4p', label: 'TIP4P' },
  { value: 'spce', label: 'SPC/E' },
  { value: 'gbneck2', label: 'GB-Neck2' }
];

export const SIMULATION_STEPS = [
  SimulationStatus.PENDING_VALIDATION,
  SimulationStatus.SYSTEM_BUILDING,
  SimulationStatus.ENERGY_MINIMIZATION,
  SimulationStatus.EQUILIBRATION,
  SimulationStatus.FEP_CALCULATION,
  SimulationStatus.COMPLETED
];
