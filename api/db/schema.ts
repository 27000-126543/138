export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS targets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  uniprot_id TEXT,
  pdb_id TEXT,
  description TEXT,
  is_paused INTEGER NOT NULL DEFAULT 0,
  pause_reason TEXT,
  paused_at TEXT,
  paused_by TEXT REFERENCES users(id),
  consecutive_deviations INTEGER NOT NULL DEFAULT 0,
  last_deviation_check TEXT
);

CREATE TABLE IF NOT EXISTS simulation_tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_id TEXT NOT NULL REFERENCES targets(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  assigned_to TEXT REFERENCES users(id),
  status TEXT NOT NULL,
  force_field TEXT NOT NULL,
  temperature REAL NOT NULL,
  salt_concentration REAL NOT NULL,
  fe_method TEXT NOT NULL,
  rmsd_threshold REAL NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  current_step TEXT,
  estimated_time REAL,
  protein_file_path TEXT,
  ligand_file_path TEXT,
  binding_site TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS monitoring_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL REFERENCES simulation_tasks(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL,
  rmsd REAL NOT NULL,
  potential_energy REAL NOT NULL,
  temperature REAL NOT NULL,
  pressure REAL NOT NULL,
  volume REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES simulation_tasks(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  metric TEXT,
  value REAL,
  threshold REAL,
  timestamp TEXT NOT NULL,
  reviewed_by TEXT REFERENCES users(id),
  review_comment TEXT,
  review_action TEXT,
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES simulation_tasks(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  status TEXT NOT NULL,
  approver_id TEXT NOT NULL REFERENCES users(id),
  comment TEXT,
  signed_at TEXT
);

CREATE TABLE IF NOT EXISTS free_energy_results (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES simulation_tasks(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  total_binding_energy REAL NOT NULL,
  standard_error REAL NOT NULL,
  interaction_fingerprint TEXT,
  calculated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS energy_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  result_id TEXT NOT NULL REFERENCES free_energy_results(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value REAL NOT NULL,
  error REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS residue_contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  result_id TEXT NOT NULL REFERENCES free_energy_results(id) ON DELETE CASCADE,
  residue_number INTEGER NOT NULL,
  residue_name TEXT NOT NULL,
  energy_contribution REAL NOT NULL,
  interaction_type TEXT
);

CREATE TABLE IF NOT EXISTS parameter_adjustments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES simulation_tasks(id) ON DELETE CASCADE,
  adjusted_by TEXT NOT NULL REFERENCES users(id),
  parameter_name TEXT NOT NULL,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  adjusted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS simulation_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES simulation_tasks(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES simulation_tasks(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_stats (
  date TEXT PRIMARY KEY,
  total_tasks INTEGER NOT NULL DEFAULT 0,
  completed_tasks INTEGER NOT NULL DEFAULT 0,
  failed_tasks INTEGER NOT NULL DEFAULT 0,
  completion_rate REAL NOT NULL DEFAULT 0,
  average_error REAL NOT NULL DEFAULT 0,
  total_compute_hours REAL NOT NULL DEFAULT 0,
  average_simulation_time REAL NOT NULL DEFAULT 0,
  alerts_generated INTEGER NOT NULL DEFAULT 0,
  approvals_processed INTEGER NOT NULL DEFAULT 0
);
`;

export const CREATE_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_simulation_tasks_target_id ON simulation_tasks(target_id);
CREATE INDEX IF NOT EXISTS idx_simulation_tasks_created_by ON simulation_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_simulation_tasks_assigned_to ON simulation_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_simulation_tasks_status ON simulation_tasks(status);
CREATE INDEX IF NOT EXISTS idx_simulation_tasks_created_at ON simulation_tasks(created_at);

CREATE INDEX IF NOT EXISTS idx_monitoring_data_task_id ON monitoring_data(task_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_data_timestamp ON monitoring_data(timestamp);

CREATE INDEX IF NOT EXISTS idx_alerts_task_id ON alerts(task_id);
CREATE INDEX IF NOT EXISTS idx_alerts_level ON alerts(level);
CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_reviewed_by ON alerts(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_approvals_task_id ON approvals(task_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver_id ON approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);

CREATE INDEX IF NOT EXISTS idx_free_energy_results_task_id ON free_energy_results(task_id);
CREATE INDEX IF NOT EXISTS idx_energy_components_result_id ON energy_components(result_id);
CREATE INDEX IF NOT EXISTS idx_residue_contributions_result_id ON residue_contributions(result_id);

CREATE INDEX IF NOT EXISTS idx_parameter_adjustments_task_id ON parameter_adjustments(task_id);
CREATE INDEX IF NOT EXISTS idx_simulation_logs_task_id ON simulation_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_simulation_logs_timestamp ON simulation_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_reports_task_id ON reports(task_id);

CREATE INDEX IF NOT EXISTS idx_targets_is_paused ON targets(is_paused);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
`;

export const DROP_TABLES_SQL = `
DROP TABLE IF EXISTS energy_components;
DROP TABLE IF EXISTS residue_contributions;
DROP TABLE IF EXISTS free_energy_results;
DROP TABLE IF EXISTS monitoring_data;
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS approvals;
DROP TABLE IF EXISTS parameter_adjustments;
DROP TABLE IF EXISTS simulation_logs;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS simulation_tasks;
DROP TABLE IF EXISTS targets;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS daily_stats;
`;
