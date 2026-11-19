import sys
import os
from datetime import date, datetime, time, timedelta

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from app.models.models import (
    Department,
    Faculty,
    Subject,
    User,
    Attendance,
    Timetable,
    Absence,
    SubstitutionRequest,
    SubstitutionAssignment,
    Notification,
    faculty_subject,
)
from app.utils.helpers import get_day_of_week


def seed_database():
    app = create_app()
    with app.app_context():
        print("=" * 60)
        print("SEEDING SYNCORA DATABASE")
        print("=" * 60)
        
        # 1. Clean existing records (idempotent)
        print("[1/7] Cleaning existing data...")
        db.session.query(Notification).delete()
        db.session.query(SubstitutionAssignment).delete()
        db.session.query(SubstitutionRequest).delete()
        db.session.query(Absence).delete()
        db.session.query(Attendance).delete()
        db.session.query(Timetable).delete()
        db.session.execute(faculty_subject.delete())
        db.session.query(User).delete()
        db.session.query(Faculty).delete()
        db.session.query(Subject).delete()
        db.session.query(Department).delete()
        db.session.commit()
        
        # 2. Seed Departments
        print("[2/7] Seeding Departments...")
        cs_dept = Department(name="Computer Science", code="CS", description="Department of Computer Science & Engineering")
        ec_dept = Department(name="Electronics & Communication", code="EC", description="Department of Electronics & Communication Engineering")
        math_dept = Department(name="Mathematics", code="MATH", description="Department of Mathematics & Computational Sciences")
        phy_dept = Department(name="Physics", code="PHY", description="Department of Physics & Applied Sciences")
        
        db.session.add_all([cs_dept, ec_dept, math_dept, phy_dept])
        db.session.flush()
        
        # 3. Seed Subjects
        print("[3/7] Seeding Subjects...")
        subjects_data = {
            # CS
            'CS101': Subject(name="Data Structures", code="CS101", department_id=cs_dept.id, description="Core data structures and algorithms in C/Python"),
            'CS102': Subject(name="Algorithms", code="CS102", department_id=cs_dept.id, description="Design and analysis of computer algorithms"),
            'CS201': Subject(name="Database Systems", code="CS201", department_id=cs_dept.id, description="Relational DB, SQL, indexing and query processing"),
            'CS202': Subject(name="Computer Networks", code="CS202", department_id=cs_dept.id, description="TCP/IP protocol architecture and routing"),
            'CS203': Subject(name="Operating Systems", code="CS203", department_id=cs_dept.id, description="Processes, threads, memory management and file systems"),
            'CS301': Subject(name="Machine Learning", code="CS301", department_id=cs_dept.id, description="Supervised, unsupervised ML models and deep learning"),
            # EC
            'EC101': Subject(name="Digital Electronics", code="EC101", department_id=ec_dept.id, description="Boolean algebra, logic gates, sequential circuits"),
            'EC201': Subject(name="Signal Processing", code="EC201", department_id=ec_dept.id, description="DSP, Fourier transforms, digital filters"),
            'EC202': Subject(name="Microprocessors", code="EC202", department_id=ec_dept.id, description="8086 architecture, assembly language and interfacing"),
            # MATH
            'MATH101': Subject(name="Engineering Mathematics", code="MATH101", department_id=math_dept.id, description="Calculus, linear algebra, vector calculus"),
            'MATH201': Subject(name="Discrete Mathematics", code="MATH201", department_id=math_dept.id, description="Graph theory, combinatorics, formal proofs"),
            'MATH301': Subject(name="Statistics", code="MATH301", department_id=math_dept.id, description="Probability distributions, hypothesis testing"),
            # PHY
            'PHY101': Subject(name="Engineering Physics", code="PHY101", department_id=phy_dept.id, description="Optics, electromagnetism, wave physics"),
            'PHY201': Subject(name="Quantum Mechanics", code="PHY201", department_id=phy_dept.id, description="Schrodinger equation, wave functions, quantum states"),
        }
        for s in subjects_data.values():
            db.session.add(s)
        db.session.flush()
        
        # 4. Seed Faculty & Users
        print("[4/7] Seeding Faculty & Users...")
        faculty_definitions = [
            {
                'name': "Dr. Priya Sharma",
                'email': "priya.sharma@syncora.edu",
                'dept': cs_dept,
                'designation': "Associate Professor",
                'specialization': "Machine Learning & Neural Networks",
                'subjects': ['CS101', 'CS301', 'MATH201']
            },
            {
                'name': "Dr. Rahul Verma",
                'email': "rahul.verma@syncora.edu",
                'dept': cs_dept,
                'designation': "Professor",
                'specialization': "Algorithms & Database Systems",
                'subjects': ['CS102', 'CS201', 'CS203']
            },
            {
                'name': "Prof. Ananya Krishnan",
                'email': "ananya.krishnan@syncora.edu",
                'dept': cs_dept,
                'designation': "Assistant Professor",
                'specialization': "Computer Networks & Distributed Systems",
                'subjects': ['CS202', 'CS203']
            },
            {
                'name': "Dr. Meera Patel",
                'email': "meera.patel@syncora.edu",
                'dept': ec_dept,
                'designation': "Associate Professor",
                'specialization': "Digital Signal Processing",
                'subjects': ['EC101', 'EC201']
            },
            {
                'name': "Dr. Suresh Nair",
                'email': "suresh.nair@syncora.edu",
                'dept': ec_dept,
                'designation': "Professor",
                'specialization': "Microprocessors & Embedded Systems",
                'subjects': ['EC201', 'EC202']
            },
            {
                'name': "Prof. Kavitha Rao",
                'email': "kavitha.rao@syncora.edu",
                'dept': math_dept,
                'designation': "Associate Professor",
                'specialization': "Applied Statistics & Optimization",
                'subjects': ['MATH101', 'MATH201', 'MATH301']
            },
            {
                'name': "Dr. Arjun Singh",
                'email': "arjun.singh@syncora.edu",
                'dept': math_dept,
                'designation': "Assistant Professor",
                'specialization': "Discrete Mathematics & Graph Algorithms",
                'subjects': ['MATH201', 'MATH301']
            },
            {
                'name': "Dr. Deepa Menon",
                'email': "deepa.menon@syncora.edu",
                'dept': phy_dept,
                'designation': "Professor",
                'specialization': "Quantum Physics & Modern Optics",
                'subjects': ['PHY101', 'PHY201']
            },
            {
                'name': "Prof. Vikram Iyer",
                'email': "vikram.iyer@syncora.edu",
                'dept': cs_dept,
                'designation': "Lecturer",
                'specialization': "Programming & Data Structures",
                'subjects': ['CS101', 'CS102']
            },
            {
                'name': "Dr. Sunita Desai",
                'email': "sunita.desai@syncora.edu",
                'dept': ec_dept,
                'designation': "Assistant Professor",
                'specialization': "VLSI Design & Digital Electronics",
                'subjects': ['EC101', 'EC202']
            },
            {
                'name': "Prof. Ravi Kumar",
                'email': "ravi.kumar@syncora.edu",
                'dept': math_dept,
                'designation': "Lecturer",
                'specialization': "Computational Physics & Engineering Math",
                'subjects': ['MATH101', 'PHY101']
            },
            {
                'name': "Dr. Leela Nambiar",
                'email': "leela.nambiar@syncora.edu",
                'dept': cs_dept,
                'designation': "Associate Professor",
                'specialization': "Operating Systems & Systems Programming",
                'subjects': ['CS203', 'CS202', 'CS102']
            },
        ]
        
        # Create Admin User
        admin_user = User(
            name="System Administrator",
            email="admin@syncora.edu",
            role="admin",
            faculty_id=None,
            is_active=True
        )
        admin_user.set_password("Admin@123")
        db.session.add(admin_user)
        db.session.flush()
        
        faculty_objects = {}
        for fdef in faculty_definitions:
            faculty = Faculty(
                name=fdef['name'],
                email=fdef['email'],
                department_id=fdef['dept'].id,
                designation=fdef['designation'],
                specialization=fdef['specialization'],
                is_active=True
            )
            for scode in fdef['subjects']:
                if scode in subjects_data:
                    faculty.subjects.append(subjects_data[scode])
            db.session.add(faculty)
            db.session.flush()
            
            user = User(
                name=fdef['name'],
                email=fdef['email'],
                role="faculty",
                faculty_id=faculty.id,
                is_active=True
            )
            user.set_password("Faculty@123")
            db.session.add(user)
            faculty_objects[fdef['name']] = faculty
            
        db.session.flush()
        
        # 5. Seed Attendance for Today
        print("[5/7] Seeding Today's Attendance...")
        today = date.today()
        
        # 8 PRESENT
        present_configs = [
            ("Dr. Rahul Verma", time(8, 35)),
            ("Prof. Ananya Krishnan", time(8, 42)),
            ("Dr. Suresh Nair", time(8, 50)),
            ("Prof. Kavitha Rao", time(8, 30)),
            ("Dr. Arjun Singh", time(8, 55)),
            ("Dr. Deepa Menon", time(8, 45)),
            ("Prof. Vikram Iyer", time(9, 5)),
            ("Dr. Sunita Desai", time(9, 12)),
        ]
        for name, ltime in present_configs:
            f = faculty_objects[name]
            att = Attendance(faculty_id=f.id, date=today, login_time=ltime, status="PRESENT")
            db.session.add(att)
            
        # 2 ABSENT
        absent_configs = [
            ("Dr. Priya Sharma", "Medical appointment"),
            ("Dr. Meera Patel", "Personal leave"),
        ]
        for name, reason in absent_configs:
            f = faculty_objects[name]
            att = Attendance(faculty_id=f.id, date=today, status="ABSENT", notes=reason)
            db.session.add(att)
            
        # 2 LOGGED_OUT
        logged_out_configs = [
            ("Prof. Ravi Kumar", time(8, 30), time(10, 30)),
            ("Dr. Leela Nambiar", time(8, 40), time(11, 15)),
        ]
        for name, ltime, lotime in logged_out_configs:
            f = faculty_objects[name]
            att = Attendance(faculty_id=f.id, date=today, login_time=ltime, logout_time=lotime, status="LOGGED_OUT")
            db.session.add(att)
            
        db.session.flush()
        
        # 6. Seed Full Weekly Timetable
        print("[6/7] Seeding Weekly Timetable...")
        # Slots: 9:00-10:00, 10:00-11:00, 11:00-12:00, 12:00-13:00, 14:00-15:00, 15:00-16:00
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        today_day_name = get_day_of_week(today)
        if today_day_name not in days:
            days.append(today_day_name)
            
        timetable_entries_spec = [
            # Dr. Priya Sharma (Absent today)
            ("Dr. Priya Sharma", "CS101", "CS-A", "101", time(9, 0), time(10, 0), ["Monday", "Wednesday", "Friday"]),
            ("Dr. Priya Sharma", "CS301", "CS-Final", "Lab-3", time(11, 0), time(12, 0), ["Tuesday", "Thursday"]),
            ("Dr. Priya Sharma", "MATH201", "CS-B", "204", time(14, 0), time(15, 0), ["Monday", "Thursday"]),
            
            # Dr. Rahul Verma
            ("Dr. Rahul Verma", "CS102", "CS-A", "102", time(10, 0), time(11, 0), ["Monday", "Wednesday", "Friday"]),
            ("Dr. Rahul Verma", "CS201", "CS-B", "201", time(11, 0), time(12, 0), ["Tuesday", "Thursday"]),
            ("Dr. Rahul Verma", "CS203", "CS-A", "Lab-1", time(14, 0), time(15, 0), ["Wednesday", "Friday"]),
            
            # Prof. Ananya Krishnan
            ("Prof. Ananya Krishnan", "CS202", "CS-A", "202", time(9, 0), time(10, 0), ["Tuesday", "Thursday"]),
            ("Prof. Ananya Krishnan", "CS203", "CS-B", "Lab-2", time(11, 0), time(12, 0), ["Monday", "Wednesday"]),
            ("Prof. Ananya Krishnan", "CS202", "CS-B", "202", time(15, 0), time(16, 0), ["Thursday", "Friday"]),
            
            # Dr. Meera Patel (Absent today)
            ("Dr. Meera Patel", "EC101", "EC-A", "301", time(10, 0), time(11, 0), ["Monday", "Wednesday"]),
            ("Dr. Meera Patel", "EC201", "EC-B", "302", time(14, 0), time(15, 0), ["Tuesday", "Thursday"]),
            
            # Dr. Suresh Nair
            ("Dr. Suresh Nair", "EC202", "EC-A", "Lab-EC1", time(9, 0), time(10, 0), ["Monday", "Thursday"]),
            ("Dr. Suresh Nair", "EC201", "EC-A", "303", time(11, 0), time(12, 0), ["Wednesday", "Friday"]),
            
            # Prof. Kavitha Rao
            ("Prof. Kavitha Rao", "MATH101", "CS-A", "101", time(11, 0), time(12, 0), ["Monday", "Wednesday", "Friday"]),
            ("Prof. Kavitha Rao", "MATH301", "EC-A", "301", time(14, 0), time(15, 0), ["Tuesday", "Thursday"]),
            
            # Dr. Arjun Singh
            ("Dr. Arjun Singh", "MATH201", "EC-B", "205", time(9, 0), time(10, 0), ["Wednesday", "Friday"]),
            ("Dr. Arjun Singh", "MATH301", "CS-A", "103", time(12, 0), time(13, 0), ["Monday", "Thursday"]),
            
            # Dr. Deepa Menon
            ("Dr. Deepa Menon", "PHY101", "CS-A", "PHY-Lab", time(10, 0), time(11, 0), ["Tuesday", "Thursday"]),
            ("Dr. Deepa Menon", "PHY201", "EC-A", "PHY-1", time(15, 0), time(16, 0), ["Monday", "Wednesday"]),
            
            # Prof. Vikram Iyer
            ("Prof. Vikram Iyer", "CS101", "CS-B", "104", time(12, 0), time(13, 0), ["Tuesday", "Thursday"]),
            ("Prof. Vikram Iyer", "CS102", "CS-B", "104", time(15, 0), time(16, 0), ["Wednesday", "Friday"]),
            
            # Dr. Sunita Desai
            ("Dr. Sunita Desai", "EC101", "EC-B", "304", time(12, 0), time(13, 0), ["Monday", "Wednesday"]),
            ("Dr. Sunita Desai", "EC202", "EC-B", "Lab-EC2", time(14, 0), time(15, 0), ["Tuesday", "Friday"]),
            
            # Prof. Ravi Kumar
            ("Prof. Ravi Kumar", "MATH101", "EC-A", "302", time(9, 0), time(10, 0), ["Tuesday", "Saturday"]),
            ("Prof. Ravi Kumar", "PHY101", "EC-B", "PHY-2", time(11, 0), time(12, 0), ["Thursday", "Saturday"]),
            
            # Dr. Leela Nambiar
            ("Dr. Leela Nambiar", "CS203", "CS-Final", "Lab-1", time(10, 0), time(11, 0), ["Monday", "Thursday"]),
            ("Dr. Leela Nambiar", "CS102", "CS-C", "105", time(14, 0), time(15, 0), ["Wednesday", "Saturday"]),
        ]
        
        # Ensure absent faculty have classes on today's day of week so substitution requests are testable!
        if today_day_name not in ["Monday", "Wednesday", "Friday"]:
            timetable_entries_spec.append(
                ("Dr. Priya Sharma", "CS101", "CS-Special", "101", time(10, 0), time(11, 0), [today_day_name])
            )
        if today_day_name not in ["Monday", "Wednesday"]:
            timetable_entries_spec.append(
                ("Dr. Meera Patel", "EC101", "EC-Special", "301", time(14, 0), time(15, 0), [today_day_name])
            )
            
        seeded_timetable_entries = []
        for fac_name, sub_code, cname, room, stime, etime, day_list in timetable_entries_spec:
            fac = faculty_objects[fac_name]
            sub = subjects_data[sub_code]
            for day in day_list:
                t_entry = Timetable(
                    faculty_id=fac.id,
                    subject_id=sub.id,
                    department_id=sub.department_id,
                    class_name=cname,
                    section="A",
                    classroom=f"Room-{room}",
                    day_of_week=day,
                    start_time=stime,
                    end_time=etime,
                    is_active=True
                )
                db.session.add(t_entry)
                seeded_timetable_entries.append(t_entry)
                
        db.session.flush()
        
        # 7. Seed Historical Absences and Substitutions
        print("[7/7] Seeding Historical Absences & Substitutions...")
        # 3 historical completed absences:
        historical_records = [
            {
                'days_ago': 5,
                'faculty': faculty_objects["Dr. Deepa Menon"],
                'reason': "International conference presentation",
                'substitute': faculty_objects["Prof. Ravi Kumar"],
                'slot_index': 0
            },
            {
                'days_ago': 3,
                'faculty': faculty_objects["Dr. Suresh Nair"],
                'reason': "Faculty development programme",
                'substitute': faculty_objects["Dr. Sunita Desai"],
                'slot_index': 1
            },
            {
                'days_ago': 2,
                'faculty': faculty_objects["Prof. Vikram Iyer"],
                'reason': "Personal emergency",
                'substitute': faculty_objects["Dr. Rahul Verma"],
                'slot_index': 2
            },
            {
                'days_ago': 1,
                'faculty': faculty_objects["Dr. Leela Nambiar"],
                'reason': "University inspection duty",
                'substitute': faculty_objects["Prof. Ananya Krishnan"],
                'slot_index': 3
            }
        ]
        
        for h in historical_records:
            hist_date = today - timedelta(days=h['days_ago'])
            abs_rec = Absence(
                faculty_id=h['faculty'].id,
                date=hist_date,
                reason=h['reason'],
                remarks="Completed substitution",
                reported_by=admin_user.id
            )
            db.session.add(abs_rec)
            db.session.flush()
            
            # Find a timetable entry for this faculty
            t_slot = Timetable.query.filter_by(faculty_id=h['faculty'].id).first()
            if not t_slot:
                t_slot = seeded_timetable_entries[0]
                
            sub_req = SubstitutionRequest(
                absence_id=abs_rec.id,
                timetable_id=t_slot.id,
                date=hist_date,
                recommended_faculty_id=h['substitute'].id,
                recommendation_score=85.0,
                ai_explanation=f"Assigned {h['substitute'].name} based on department alignment and zero conflicting lectures.",
                status='APPROVED'
            )
            db.session.add(sub_req)
            db.session.flush()
            
            assignment = SubstitutionAssignment(
                request_id=sub_req.id,
                assigned_faculty_id=h['substitute'].id,
                assigned_by=admin_user.id,
                assigned_at=datetime.utcnow() - timedelta(days=h['days_ago']),
                is_acknowledged=True,
                acknowledged_at=datetime.utcnow() - timedelta(days=h['days_ago'], hours=-1),
                notes="Completed successfully."
            )
            db.session.add(assignment)
            
        db.session.commit()
        
        print("\n" + "=" * 60)
        print("SEEDING COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        print("DEMO CREDENTIALS:")
        print("  Admin:")
        print("    Email:    admin@syncora.edu")
        print("    Password: Admin@123")
        print("    Role:     admin")
        print("\n  Faculty Accounts (Password for all: Faculty@123):")
        for f in faculty_definitions[:5]:
            print(f"    - {f['name']}: {f['email']}")
        print(f"    ... and 7 more faculty members.")
        print("=" * 60)


if __name__ == '__main__':
    seed_database()
