from datetime import datetime
from app.models import db, SessionCode

def delete_expired_sessions():
    now = datetime.utcnow()
    expired = SessionCode.query.filter(SessionCode.expires_at < now).all()
    for s in expired:
        db.session.delete(s)
    db.session.commit()
    return len(expired)
