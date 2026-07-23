from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, func
from app.core.database import Base


class User(Base):
    __tablename__ = "tblUsers"

    uid = Column("UID", Integer, primary_key=True, index=True)
    email_address = Column("EmailAddress", String(255), unique=True, nullable=False, index=True)
    password_hash = Column("PasswordHash", Text, nullable=False)
    full_name = Column("FullName", String(150), nullable=True)
    role_code = Column("RoleCode", String(50), nullable=False, default="USER")
    is_active = Column("IsActive", Boolean, nullable=False, default=True)
    last_login_at = Column("LastLoginAt", DateTime, nullable=True)
    created_at = Column("CreatedAt", DateTime, nullable=False, server_default=func.now())
    updated_at = Column("UpdatedAt", DateTime, nullable=True)
