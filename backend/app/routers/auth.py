from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from ..db.database import get_db
from .. import models, schemas
from ..auth import hash_password, verify_password, create_access_token
import uuid

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=schemas.TokenResponse)
def signup(req: schemas.SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        id=str(uuid.uuid4()),
        email=req.email,
        hashed_password=hash_password(req.password),
    )
    db.add(user)

    profile = models.UserProfile(id=str(uuid.uuid4()), user_id=user.id)
    assumptions = models.UserAssumptions(id=str(uuid.uuid4()), user_id=user.id)
    db.add(profile)
    db.add(assumptions)
    db.commit()

    return schemas.TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=schemas.TokenResponse)
def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return schemas.TokenResponse(access_token=create_access_token(user.id))
