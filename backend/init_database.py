"""
Script to initialize the database tables.
Run this if the database tables are not created automatically.
"""
from database import init_db

if __name__ == "__main__":
    print("Initializing database...")
    init_db()
    print("Database initialized successfully!")







