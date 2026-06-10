-- =========================================================================
-- Before/After Work Tracking — Cloudflare D1 schema
-- สร้างด้วย:  wrangler d1 execute ba-track --file=./schema.sql
-- =========================================================================

-- ผู้ใช้ (whitelist) ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,        -- รหัสพนักงาน (ใช้ login)
  name         TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'staff', -- 'supervisor' | 'staff'
  line_user_id TEXT,                         -- สำหรับ @mention
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- หมวดหมู่ -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#2563eb',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- งาน -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,        -- BA-0001
  category_id  TEXT,
  area         TEXT NOT NULL,
  detail       TEXT,
  dept         TEXT DEFAULT 'VSM4',          -- แผนก (VSM1-4, QC, ...)
  machine      TEXT DEFAULT '',              -- หมายเลขเครื่อง
  assignee_id  TEXT,
  created_by   TEXT,
  due_date     TEXT,                         -- YYYY-MM-DD
  status       TEXT NOT NULL DEFAULT 'open', -- open | pending | closed
  before_key   TEXT,                         -- R2 object key
  after_key    TEXT,
  compare_key  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at TEXT,
  closed_at    TEXT,
  closed_by    TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (assignee_id) REFERENCES users(id),
  FOREIGN KEY (created_by)  REFERENCES users(id),
  FOREIGN KEY (closed_by)   REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_tasks_status   ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created  ON tasks(created_at);

-- audit trail / comments -----------------------------------------------------
CREATE TABLE IF NOT EXISTS task_logs (
  id        TEXT PRIMARY KEY,
  task_id   TEXT NOT NULL,
  type      TEXT NOT NULL,                   -- open|submit|close|reopen|comment
  user_id   TEXT,
  user_name TEXT,
  text      TEXT,                            -- ใช้กับ comment
  at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_logs_task ON task_logs(task_id);

-- คอนฟิก LINE + ตัวนับเลขงาน (key/value) -------------------------------------
CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- กลุ่ม LINE ที่ดักได้จาก webhook --------------------------------------------
CREATE TABLE IF NOT EXISTS line_groups (
  group_id  TEXT PRIMARY KEY,
  name      TEXT,
  seen_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- seed เริ่มต้น --------------------------------------------------------------
INSERT OR IGNORE INTO categories (id,name,color) VALUES
  ('c1','5ส','#2563eb'),
  ('c2','Improvement','#16a34a'),
  ('c3','Safety','#dc2626');

-- รายชื่อพนักงาน (whitelist) นำเข้าจากไฟล์แยก:
--   wrangler d1 execute ba-track --remote --file=./seed-employees.sql
-- (ไม่มีการแยกสิทธิ์หัวหน้า/ลูกน้อง — role เก็บเป็น 'staff' ทั้งหมด)

INSERT OR IGNORE INTO app_config (key,value) VALUES
  ('task_counter','0'),
  ('line_group_id',''),
  ('notify_on_close','1');
