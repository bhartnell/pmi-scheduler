# EMS Background Fields

## Purpose

Track incoming experience levels for Paramedic students to:
1. **Balance lab groups** by mixing experience levels
2. **Future data mining** - correlate experience with outcomes
3. **Research/QI/QA analysis**

## Fields Added

### 1. Prior Certification Level (`prior_cert_level`)
- **Type**: TEXT
- **Values**:
  - `'emt'` - EMT-Basic
  - `'aemt'` - AEMT (Advanced EMT)
  - `'other'` - Other certifications

### 2. Years of EMS Experience (`years_ems_experience`)
- **Type**: NUMERIC(4,1)
- **Range**: 0 to 50 years
- **Precision**: Allows decimals (e.g., 2.5 years)
- **Example**: `4.5` for 4.5 years of experience

### 3. Primary Work Setting (`prior_work_setting`)
- **Type**: TEXT
- **Values**:
  - `'911'` - 911/Fire Department
  - `'ift'` - Private/IFT (Interfacility Transfer)
  - `'hospital'` - Hospital-based
  - `'flight'` - Flight/Critical Care
  - `'volunteer'` - Volunteer EMS
  - `'none'` - Not currently working in EMS

### 4. Prior Employer (`prior_employer`)
- **Type**: TEXT (free text)
- **Purpose**: Track specific agencies/employers
- **Example**: "Henderson Fire Department", "AMR Las Vegas"

## Use Cases

### 1. Group Creation & Balancing
Mix experience levels in study groups:
```sql
-- Find students for balanced group formation
SELECT
  id,
  first_name || ' ' || last_name as name,
  prior_cert_level,
  years_ems_experience,
  prior_work_setting
FROM students
WHERE cohort_id = 'xxx'
  AND status = 'active'
ORDER BY years_ems_experience ASC;
```

Strategy:
- Mix EMTs with AEMTs
- Balance experienced (5+ years) with newer providers (<2 years)
- Pair high experience with low for peer mentoring

### 2. Cohort Overview Statistics
```sql
-- Get cohort experience composition
SELECT
  c.cohort_number,
  COUNT(*) as total_students,
  COUNT(CASE WHEN prior_cert_level = 'emt' THEN 1 END) as emt_count,
  COUNT(CASE WHEN prior_cert_level = 'aemt' THEN 1 END) as aemt_count,
  ROUND(AVG(years_ems_experience), 1) as avg_years_exp,
  MIN(years_ems_experience) as min_exp,
  MAX(years_ems_experience) as max_exp
FROM students s
JOIN cohorts c ON s.cohort_id = c.id
WHERE s.status = 'active'
  AND c.id = 'xxx'
GROUP BY c.cohort_number;
```

Example output:
```
PM Group 15: 20 students
- 12 EMTs, 8 AEMTs
- Average experience: 3.2 years
- Range: 0.5 to 12 years
```

### 3. Work Setting Distribution
```sql
-- Analyze work setting backgrounds
SELECT
  prior_work_setting,
  COUNT(*) as count,
  ROUND(AVG(years_ems_experience), 1) as avg_exp
FROM students
WHERE cohort_id = 'xxx'
  AND prior_work_setting IS NOT NULL
GROUP BY prior_work_setting
ORDER BY count DESC;
```

### 4. Future Data Analysis

#### Performance by Background
```sql
-- Correlate certification level with lab performance
SELECT
  s.prior_cert_level,
  COUNT(DISTINCT a.id) as assessment_count,
  ROUND(AVG(a.score), 2) as avg_score
FROM students s
JOIN assessments a ON s.id = a.student_id
WHERE s.cohort_id = 'xxx'
  AND s.prior_cert_level IS NOT NULL
GROUP BY s.prior_cert_level;
```

#### Experience vs Time to Competency
```sql
-- Does experience correlate with faster skill acquisition?
SELECT
  CASE
    WHEN years_ems_experience < 1 THEN '<1 year'
    WHEN years_ems_experience < 3 THEN '1-3 years'
    WHEN years_ems_experience < 5 THEN '3-5 years'
    WHEN years_ems_experience >= 5 THEN '5+ years'
  END as experience_bracket,
  COUNT(*) as student_count,
  AVG(skill_acquisition_days) as avg_days_to_competency
FROM student_competency_analysis
GROUP BY experience_bracket
ORDER BY MIN(years_ems_experience);
```

#### Work Setting Impact
```sql
-- Which work settings prepare students best?
SELECT
  s.prior_work_setting,
  COUNT(*) as students,
  ROUND(AVG(clinical_hours_total), 0) as avg_clinical_hours,
  ROUND(AVG(final_grade), 1) as avg_final_grade
FROM students s
JOIN student_performance sp ON s.id = sp.student_id
WHERE s.prior_work_setting IS NOT NULL
GROUP BY s.prior_work_setting
ORDER BY avg_final_grade DESC;
```

## Data Collection

### When to Collect
- **At enrollment** - Capture initial background
- **During orientation** - Verify and update
- **Optional updates** - Students can update if circumstances change

### UI Locations
1. **Student Detail Page** - Display EMS Background section (if data present)
2. **Student Edit Form** - Edit fields in "EMS Background (Optional)" section
3. **Bulk Import** - Include fields in student CSV import

## Privacy & Usage Notes

- **Optional fields** - Not required for all students
- **Program-specific** - Primarily for Paramedic program
- **Research consent** - If using for research, obtain IRB approval and student consent
- **Anonymization** - For published research, anonymize individual student data

## Migration

Run the migration SQL:
```bash
psql -d pmi_scheduler -f migrations/add_ems_background_fields.sql
```

Or in Supabase SQL Editor:
1. Copy contents of `add_ems_background_fields.sql`
2. Paste into SQL Editor
3. Click "Run"

## Verification

After migration, verify columns:
```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'students'
AND column_name IN ('prior_cert_level', 'years_ems_experience', 'prior_work_setting', 'prior_employer')
ORDER BY column_name;
```

Expected result: 4 new columns, all nullable (TEXT or NUMERIC).
