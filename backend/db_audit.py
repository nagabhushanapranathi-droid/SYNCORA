import sqlite3

conn = sqlite3.connect('instance/syncora.db')
cursor = conn.cursor()

print("=== SAMPLE DATA ===")

# Users
cursor.execute("SELECT id, name, email, role, faculty_id FROM user LIMIT 15")
rows = cursor.fetchall()
print("\n  Users:")
for r in rows:
    print(f"    id={r[0]}, name={r[1]}, email={r[2]}, role={r[3]}, faculty_id={r[4]}")

# Faculty  
cursor.execute("SELECT id, name, email, department_id, designation FROM faculty LIMIT 15")
rows = cursor.fetchall()
print(f"\n  Faculty:")
for r in rows:
    print(f"    id={r[0]}, name={r[1]}, email={r[2]}, dept_id={r[3]}, desig={r[4]}")

# Departments
cursor.execute("SELECT id, name, code FROM department")
rows = cursor.fetchall()
print(f"\n  Departments:")
for r in rows:
    print(f"    id={r[0]}, name={r[1]}, code={r[2]}")

# Subjects
cursor.execute("SELECT id, name, code, department_id FROM subject")
rows = cursor.fetchall()
print(f"\n  Subjects:")
for r in rows:
    print(f"    id={r[0]}, name={r[1]}, code={r[2]}, dept_id={r[3]}")

# Faculty-User links
cursor.execute("""
    SELECT f.id as fid, f.name as fname, u.id as uid, u.name as uname, u.faculty_id
    FROM faculty f 
    LEFT JOIN user u ON u.faculty_id = f.id 
""")
rows = cursor.fetchall()
print(f"\n  Faculty-User links:")
for r in rows:
    linked = "LINKED" if r[2] else "BROKEN"
    print(f"    Faculty(id={r[0]}, name={r[1]}) -> User(id={r[2]}, name={r[3]}, faculty_id={r[4]}) [{linked}]")

# Attendance
cursor.execute("SELECT id, faculty_id, date, status, login_time, logout_time FROM attendance")
rows = cursor.fetchall()
print(f"\n  Attendance ({len(rows)} records):")
for r in rows:
    print(f"    id={r[0]}, faculty_id={r[1]}, date={r[2]}, status={r[3]}, login={r[4]}, logout={r[5]}")

# Timetable count by day
cursor.execute("SELECT day_of_week, COUNT(*) FROM timetable GROUP BY day_of_week")
rows = cursor.fetchall()
print(f"\n  Timetable entries by day:")
for r in rows:
    print(f"    {r[0]}: {r[1]} entries")

# Absences
cursor.execute("SELECT id, faculty_id, date, reason FROM absence")
rows = cursor.fetchall()
print(f"\n  Absences ({len(rows)} records):")
for r in rows:
    print(f"    id={r[0]}, faculty_id={r[1]}, date={r[2]}, reason={r[3]}")

# Substitution requests
cursor.execute("SELECT id, absence_id, timetable_id, date, status FROM substitution_request")
rows = cursor.fetchall()
print(f"\n  Substitution requests ({len(rows)} records):")
for r in rows:
    print(f"    id={r[0]}, absence_id={r[1]}, timetable_id={r[2]}, date={r[3]}, status={r[4]}")

# Substitution assignments
cursor.execute("SELECT id, request_id, assigned_faculty_id, is_acknowledged FROM substitution_assignment")
rows = cursor.fetchall()
print(f"\n  Substitution assignments ({len(rows)} records):")
for r in rows:
    print(f"    id={r[0]}, request_id={r[1]}, assigned_faculty_id={r[2]}, acknowledged={r[3]}")

conn.close()
