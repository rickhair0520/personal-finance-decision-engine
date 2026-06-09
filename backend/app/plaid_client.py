import os
import plaid
from plaid.api import plaid_api

_ENV_MAP = {
    "sandbox": plaid.Environment.Sandbox,
    "production": plaid.Environment.Production,
}

configuration = plaid.Configuration(
    host=_ENV_MAP.get(os.environ.get("PLAID_ENV", "sandbox"), plaid.Environment.Sandbox),
    api_key={
        "clientId": os.environ.get("PLAID_CLIENT_ID", ""),
        "secret": os.environ.get("PLAID_SECRET", ""),
    },
)

api_client = plaid.ApiClient(configuration)
client = plaid_api.PlaidApi(api_client)
