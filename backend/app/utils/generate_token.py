import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from app import create_app
from flask_jwt_extended import create_access_token

# Modify this based on what identity you want to simulate
user_type = 'admin'       # options: 'admin', 'course_rep', 'student'
user_id = 1               # replace with actual ID in your DB

identity = f"{user_type}:{user_id}"

app = create_app()

with app.app_context():
    token = create_access_token(identity=identity)
    print(f"\nGenerated token for {identity}:\n")
    print(token)