import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from .db.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    profile = relationship("UserProfile", back_populates="user", uselist=False)
    assumptions = relationship("UserAssumptions", back_populates="user", uselist=False)
    scenarios = relationship("Scenario", back_populates="user")


class UserProfile(Base):
    __tablename__ = "user_profiles"
    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    annual_income = Column(Float, nullable=False, default=0)
    annual_bonus = Column(Float, default=0)
    monthly_expenses = Column(Float, nullable=False, default=0)
    current_savings = Column(Float, default=0)
    investments = Column(Float, default=0)
    existing_monthly_mortgage = Column(Float, default=0)
    other_monthly_debt = Column(Float, default=0)
    age = Column(Integer, nullable=False, default=35)
    retirement_age = Column(Integer, nullable=False, default=65)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="profile")


class UserAssumptions(Base):
    __tablename__ = "user_assumptions"
    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    annual_investment_return = Column(Float, default=0.07)
    inflation_rate = Column(Float, default=0.03)
    home_appreciation_rate = Column(Float, default=0.04)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="assumptions")


class Scenario(Base):
    __tablename__ = "scenarios"
    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String, nullable=False, default="custom_build")
    name = Column(String)
    inputs = Column(JSON, nullable=False)
    result = Column(JSON)
    result_computed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="scenarios")
    scope_changes = relationship("ScopeChange", back_populates="scenario")


class ScopeChange(Base):
    __tablename__ = "scope_changes"
    id = Column(String, primary_key=True, default=gen_uuid)
    scenario_id = Column(String, ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    scope_increase = Column(Float, nullable=False)
    months_remaining = Column(Integer, nullable=False)
    result = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    scenario = relationship("Scenario", back_populates="scope_changes")


class LinkedAccount(Base):
    __tablename__ = "linked_accounts"
    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    access_token = Column(String, nullable=False)
    item_id = Column(String, nullable=False)
    institution_name = Column(String)
    last_synced_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
