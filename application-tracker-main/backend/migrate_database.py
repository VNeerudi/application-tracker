"""
Migration script to add image_path column to existing database.
Run this once to update your database schema.
"""
import sqlite3
import os
from pathlib import Path

# Database path - check multiple possible locations
db_path = None
possible_paths = [
    Path("job_applications.db"),
    Path("backend/job_applications.db"),
    Path("./job_applications.db"),
    Path("../job_applications.db"),
]

for path in possible_paths:
    if path.exists():
        db_path = path
        break

if not db_path.exists():
    print("Database not found. It will be created automatically on next server start.")
    exit(0)

print(f"Updating database: {db_path}")

try:
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Check if column already exists
    cursor.execute("PRAGMA table_info(applications)")
    columns = [column[1] for column in cursor.fetchall()]
    
    if 'image_path' not in columns:
        print("Adding image_path column...")
        cursor.execute("ALTER TABLE applications ADD COLUMN image_path VARCHAR")
        conn.commit()
        print("Successfully added image_path column!")
    else:
        print("image_path column already exists.")
    
    # Also check for salary_range if it's missing
    if 'salary_range' not in columns:
        print("Adding salary_range column...")
        cursor.execute("ALTER TABLE applications ADD COLUMN salary_range VARCHAR")
        conn.commit()
        print("Successfully added salary_range column!")
    else:
        print("salary_range column already exists.")
    
    # Check for resume_path column
    if 'resume_path' not in columns:
        print("Adding resume_path column...")
        cursor.execute("ALTER TABLE applications ADD COLUMN resume_path VARCHAR")
        conn.commit()
        print("Successfully added resume_path column!")
    else:
        print("resume_path column already exists.")
    
    conn.close()
    print("\nDatabase migration completed successfully!")
    
except Exception as e:
    print(f"Error migrating database: {e}")
    exit(1)

