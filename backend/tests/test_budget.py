def test_budget_models_importable():
    from app.models import BudgetVersion, BudgetLine
    assert BudgetVersion.__tablename__ == "budget_versions"
    assert BudgetLine.__tablename__ == "budget_lines"
