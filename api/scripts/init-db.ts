import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { getDb, closeDb } from '../db/index.js';
import { CREATE_TABLES_SQL, CREATE_INDEXES_SQL, DROP_TABLES_SQL } from '../db/schema.js';
import { SimulationStatus, UserRole, FEMethod } from '../../shared/types.js';

interface UserSeed {
  username: string;
  email: string;
  role: UserRole;
}

interface TargetSeed {
  name: string;
  uniprotId: string;
  pdbId: string;
  description: string;
}

const USERS: UserSeed[] = [
  { username: 'admin', email: 'admin@example.com', role: UserRole.ADMIN },
  { username: 'comp_chem_01', email: 'comp_chem_01@example.com', role: UserRole.COMPUTATIONAL_CHEMIST },
  { username: 'comp_chem_02', email: 'comp_chem_02@example.com', role: UserRole.COMPUTATIONAL_CHEMIST },
  { username: 'med_chem_01', email: 'med_chem_01@example.com', role: UserRole.MEDICINAL_CHEMIST },
  { username: 'chief_scientist', email: 'chief_scientist@example.com', role: UserRole.CHIEF_SCIENTIST },
];

const TARGETS: TargetSeed[] = [
  { name: 'EGFR', uniprotId: 'P00533', pdbId: '1M17', description: '表皮生长因子受体，肺癌治疗靶点' },
  { name: 'BRAF', uniprotId: 'P15056', pdbId: '1UWH', description: 'B-Raf 原癌基因丝氨酸/苏氨酸激酶，黑色素瘤靶点' },
  { name: 'KRAS', uniprotId: 'P01116', pdbId: '4OBE', description: 'Kirsten大鼠肉瘤病毒癌基因，胰腺癌靶点' },
  { name: 'HER2', uniprotId: 'P04626', pdbId: '3RCD', description: '人表皮生长因子受体2，乳腺癌靶点' },
  { name: 'CDK4', uniprotId: 'P11802', pdbId: '2W96', description: '细胞周期蛋白依赖性激酶4，肿瘤治疗靶点' },
];

const SIMULATION_STATUSES = Object.values(SimulationStatus);
const FE_METHODS = Object.values(FEMethod);
const FORCE_FIELDS = ['amber14SB', 'amber99SB', 'charmm36', 'oplsaa', 'gromos54a7'];

async function initDatabase() {
  const db = getDb();
  const passwordHash = bcrypt.hashSync('password123', 10);
  const now = new Date().toISOString();

  console.log('正在删除旧表...');
  db.exec(DROP_TABLES_SQL);

  console.log('正在创建表...');
  db.exec(CREATE_TABLES_SQL);

  console.log('正在创建索引...');
  db.exec(CREATE_INDEXES_SQL);

  console.log('正在插入用户数据...');
  const userIds: string[] = [];
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, email, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const user of USERS) {
    const id = nanoid();
    userIds.push(id);
    insertUser.run(id, user.username, user.email, passwordHash, user.role, now);
    console.log(`  ✓ 用户 ${user.username} (ID: ${id})`);
  }

  console.log('正在插入靶标数据...');
  const targetIds: string[] = [];
  const insertTarget = db.prepare(`
    INSERT INTO targets (id, name, uniprot_id, pdb_id, description, is_paused, consecutive_deviations)
    VALUES (?, ?, ?, ?, ?, 0, 0)
  `);

  for (const target of TARGETS) {
    const id = nanoid();
    targetIds.push(id);
    insertTarget.run(id, target.name, target.uniprotId, target.pdbId, target.description);
    console.log(`  ✓ 靶标 ${target.name} (ID: ${id})`);
  }

  console.log('正在插入模拟任务数据...');
  const insertTask = db.prepare(`
    INSERT INTO simulation_tasks (
      id, name, target_id, created_by, assigned_to, status,
      force_field, temperature, salt_concentration, fe_method,
      rmsd_threshold, progress, current_step, estimated_time,
      binding_site, created_at, started_at, completed_at,
      retry_count, last_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const taskNames = [
    'EGFR 抑制剂 Gefitinib 结合自由能计算',
    'BRAF V600E 突变体抑制剂筛选',
    'KRAS G12C 共价抑制剂优化',
    'HER2 双特异性抗体设计',
    'CDK4/6 抑制剂耐药机制研究',
    'EGFR 第三代抑制剂 AZD9291 类似物',
    'BRAF 二聚体抑制剂设计',
    'KRAS 野生型抑制剂开发',
    'HER2 抗体药物偶联物研究',
    'CDK4 选择性抑制剂优化',
  ];

  for (let i = 0; i < 10; i++) {
    const id = nanoid();
    const targetId = targetIds[i % targetIds.length];
    const createdBy = userIds[i % userIds.length];
    const assignedTo = userIds[(i + 1) % userIds.length];
    const status = SIMULATION_STATUSES[i % SIMULATION_STATUSES.length];
    const feMethod = FE_METHODS[i % FE_METHODS.length];
    const forceField = FORCE_FIELDS[i % FORCE_FIELDS.length];
    const temperature = 300 + Math.random() * 10;
    const saltConcentration = 0.1 + Math.random() * 0.1;
    const rmsdThreshold = 2.0 + Math.random() * 1.0;
    const progress = status === SimulationStatus.COMPLETED ? 100 : Math.floor(Math.random() * 90);
    const estimatedTime = 3600 + Math.floor(Math.random() * 7200);

    const bindingSite = JSON.stringify({
      residues: [721, 723, 725, 726, 728, 729, 730, 731, 733, 734],
      center: { x: 12.5, y: 45.2, z: -32.1 },
      radius: 12.0,
      method: 'pocket',
    });

    let startedAt: string | null = null;
    let completedAt: string | null = null;
    let currentStep: string | null = null;
    let lastError: string | null = null;

    if (status !== SimulationStatus.PENDING_VALIDATION) {
      startedAt = new Date(Date.now() - 86400000 * (i + 1)).toISOString();
    }
    if (status === SimulationStatus.COMPLETED) {
      completedAt = new Date(Date.now() - 86400000 * i).toISOString();
    }
    if (status === SimulationStatus.ERROR_ROLLBACK) {
      lastError = 'RMSD 偏离阈值超过 3 倍，自动回退到能量最小化阶段';
    }
    if (status === SimulationStatus.FEP_CALCULATION) {
      currentStep = 'lambda window 5/12';
    }

    const retryCount = status === SimulationStatus.ERROR_ROLLBACK ? 2 : 0;

    insertTask.run(
      id,
      taskNames[i],
      targetId,
      createdBy,
      assignedTo,
      status,
      forceField,
      temperature,
      saltConcentration,
      feMethod,
      rmsdThreshold,
      progress,
      currentStep,
      estimatedTime,
      bindingSite,
      new Date(Date.now() - 86400000 * (i + 2)).toISOString(),
      startedAt,
      completedAt,
      retryCount,
      lastError
    );
    console.log(`  ✓ 任务 ${i + 1}: ${taskNames[i].substring(0, 30)}... [${status}]`);
  }

  console.log('\n数据库初始化完成！');
  console.log(`\n测试账户密码: password123`);

  closeDb();
}

initDatabase().catch((err) => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
