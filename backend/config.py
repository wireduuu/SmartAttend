import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-key')
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'instance', 'geopresence.sqlite')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
