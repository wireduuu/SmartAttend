import random
import string
from app.models import SessionCode

def generate_unique_session_code(length: int = 6) -> str:
    """
    Generate a unique short alphanumeric session code.
    """
    characters = string.ascii_uppercase + string.digits
    while True:
        code = ''.join(random.choices(characters, k=length))
        if not SessionCode.query.filter_by(code=code).first():
            return code

def generate_long_session_code(length: int = 8) -> str:
    """
    Generate a unique longer alphanumeric session code.
    """
    characters = string.ascii_uppercase + string.digits
    while True:
        code = ''.join(random.choices(characters, k=length))
        if not SessionCode.query.filter_by(code=code).first():
            return code
