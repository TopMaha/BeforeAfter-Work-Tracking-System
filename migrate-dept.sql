-- เพิ่มแผนก/หมายเลขเครื่อง + ข้อมูลเดิมทั้งหมด = VSM4 (ตามที่ผู้ใช้สั่ง)
ALTER TABLE tasks ADD COLUMN dept TEXT DEFAULT 'VSM4';
ALTER TABLE tasks ADD COLUMN machine TEXT DEFAULT '';
UPDATE tasks SET dept='VSM4' WHERE dept IS NULL OR dept='';
INSERT INTO app_config (key,value) VALUES ('departments','["VSM1","VSM2","VSM3","VSM4","QC"]')
  ON CONFLICT(key) DO NOTHING;
INSERT INTO app_config (key,value) VALUES ('machines','[]')
  ON CONFLICT(key) DO NOTHING;
