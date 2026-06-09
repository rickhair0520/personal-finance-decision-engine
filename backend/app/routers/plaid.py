import uuid
from datetime import datetime, date, timedelta, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db.database import get_db
from .. import models
from ..auth import get_current_user
from ..plaid_client import client

from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.accounts_balance_get_request import AccountsBalanceGetRequest
from plaid.model.transactions_get_request import TransactionsGetRequest
from plaid.model.transactions_get_request_options import TransactionsGetRequestOptions
from plaid.model.sandbox_public_token_create_request import SandboxPublicTokenCreateRequest
from plaid.model.products import Products as PlaidProducts

router = APIRouter(prefix="/plaid", tags=["plaid"])

EXPENSE_CATEGORIES = {
    "Food and Drink", "Shops", "Recreation", "Healthcare",
    "Personal Care", "Service", "Community", "Entertainment",
}


class ExchangeRequest(BaseModel):
    public_token: str
    institution_name: str = "Unknown"


@router.post("/link-token")
def create_link_token(
    user: models.User = Depends(get_current_user),
):
    try:
        req = LinkTokenCreateRequest(
            user=LinkTokenCreateRequestUser(
                client_user_id=user.id,
                phone_number="+14155550132",
                phone_number_verified_time=datetime.now(timezone.utc),
            ),
            client_name="Finance Decision Engine",
            products=[Products("transactions")],
            country_codes=[CountryCode("US")],
            language="en",
        )
        resp = client.link_token_create(req)
        return {"link_token": resp["link_token"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exchange-token")
def exchange_token(
    req: ExchangeRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        exchange_req = ItemPublicTokenExchangeRequest(public_token=req.public_token)
        resp = client.item_public_token_exchange(exchange_req)
        access_token = resp["access_token"]
        item_id = resp["item_id"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Upsert — one linked account per user for MVP
    existing = db.query(models.LinkedAccount).filter(
        models.LinkedAccount.user_id == user.id
    ).first()
    if existing:
        existing.access_token = access_token
        existing.item_id = item_id
        existing.institution_name = req.institution_name
    else:
        db.add(models.LinkedAccount(
            id=str(uuid.uuid4()),
            user_id=user.id,
            access_token=access_token,
            item_id=item_id,
            institution_name=req.institution_name,
        ))
    db.commit()
    return {"ok": True, "institution": req.institution_name}


@router.get("/sync")
def sync_account(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    linked = db.query(models.LinkedAccount).filter(
        models.LinkedAccount.user_id == user.id
    ).first()
    if not linked:
        raise HTTPException(status_code=404, detail="No linked account")

    # Balances
    try:
        bal_resp = client.accounts_balance_get(
            AccountsBalanceGetRequest(access_token=linked.access_token)
        )
        accounts = bal_resp["accounts"]
        checking = next(
            (a for a in accounts if a["subtype"] in ("checking",)),
            accounts[0] if accounts else None,
        )
        balance = float(checking["balances"]["current"]) if checking else 0.0
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Balance fetch failed: {e}")

    # Transactions — last 60 days
    try:
        end = date.today()
        start = end - timedelta(days=60)
        txn_resp = client.transactions_get(
            TransactionsGetRequest(
                access_token=linked.access_token,
                start_date=start,
                end_date=end,
                options=TransactionsGetRequestOptions(count=500),
            )
        )
        transactions = txn_resp["transactions"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transaction fetch failed: {e}")

    # Derive monthly expenses — exclude income, transfers, payments
    EXCLUDE = {"Transfer", "Payment", "Deposit", "Income"}
    expense_txns = [
        t for t in transactions
        if not t.get("pending", False)
        and t["amount"] > 0
        and not any(cat in EXCLUDE for cat in (t.get("category") or []))
    ]
    total_expenses = sum(t["amount"] for t in expense_txns)
    monthly_expenses = round(total_expenses / 2, 2)  # 60 days → monthly avg

    # Top 20 transactions for display (all non-pending, sorted by absolute amount)
    display_txns = [t for t in transactions if not t.get("pending", False)]
    top_txns = sorted(display_txns, key=lambda t: abs(t["amount"]), reverse=True)[:20]
    txn_list = [
        {
            "name": t["name"],
            "amount": round(float(t["amount"]), 2),
            "date": str(t["date"]),
            "category": (t.get("category") or ["Uncategorized"])[-1],
        }
        for t in top_txns
    ]

    # Mark sync time
    linked.last_synced_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "institution": linked.institution_name,
        "checking_balance": round(balance, 2),
        "monthly_expenses_estimate": monthly_expenses,
        "transaction_count": len(expense_txns),
        "date_range": {"start": str(start), "end": str(end)},
        "transactions": txn_list,
    }


@router.post("/sandbox-connect")
def sandbox_connect(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bypass Plaid Link UI entirely — creates a test Wells Fargo connection directly."""
    try:
        req = SandboxPublicTokenCreateRequest(
            institution_id="ins_3",  # Wells Fargo sandbox
            initial_products=[PlaidProducts("transactions")],
        )
        resp = client.sandbox_public_token_create(req)
        public_token = resp["public_token"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sandbox token failed: {e}")

    try:
        exchange_req = ItemPublicTokenExchangeRequest(public_token=public_token)
        exchange_resp = client.item_public_token_exchange(exchange_req)
        access_token = exchange_resp["access_token"]
        item_id = exchange_resp["item_id"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Exchange failed: {e}")

    existing = db.query(models.LinkedAccount).filter(
        models.LinkedAccount.user_id == user.id
    ).first()
    if existing:
        existing.access_token = access_token
        existing.item_id = item_id
        existing.institution_name = "Wells Fargo (sandbox)"
    else:
        db.add(models.LinkedAccount(
            id=str(uuid.uuid4()),
            user_id=user.id,
            access_token=access_token,
            item_id=item_id,
            institution_name="Wells Fargo (sandbox)",
        ))
    db.commit()
    return {"ok": True, "institution": "Wells Fargo (sandbox)"}


@router.get("/status")
def link_status(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    linked = db.query(models.LinkedAccount).filter(
        models.LinkedAccount.user_id == user.id
    ).first()
    if not linked:
        return {"connected": False}
    return {
        "connected": True,
        "institution": linked.institution_name,
        "last_synced_at": linked.last_synced_at.isoformat() if linked.last_synced_at else None,
    }
