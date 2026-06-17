from app.engine.budget_import import match_category, parse_excel_bytes
from io import BytesIO
import openpyxl


def make_xlsx(rows: list) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_match_known_categories():
    assert match_category("Site Work / Foundation") == ("Foundation", "high")
    assert match_category("Wood Framing") == ("Framing", "high")
    assert match_category("Roof System") == ("Roofing", "high")
    assert match_category("Kitchen Cabinets & Appliances") == ("Kitchen", "high")
    assert match_category("HVAC System") == ("HVAC", "high")
    assert match_category("General Contractor Fee") == ("General Contractor Fee", "high")


def test_match_unknown_returns_low():
    category, confidence = match_category("Miscellaneous Custom Work")
    assert confidence == "low"
    assert category is None


def test_parse_excel_two_columns():
    data = make_xlsx([
        ["Category", "Cost"],
        ["Foundation", 68500],
        ["Framing", 118000],
        ["Unknown Trade", 25000],
    ])
    rows = parse_excel_bytes(data)
    assert len(rows) == 3
    assert rows[0]["raw_label"] == "Foundation"
    assert rows[0]["amount"] == 68500.0
    assert rows[0]["detected_category"] == "Foundation"
    assert rows[0]["confidence"] == "high"
    assert rows[2]["confidence"] == "low"
    assert rows[2]["detected_category"] is None


def test_parse_excel_skips_header_row():
    data = make_xlsx([
        ["Item", "Amount"],
        ["Roofing", 55000],
    ])
    rows = parse_excel_bytes(data)
    assert len(rows) == 1
    assert rows[0]["raw_label"] == "Roofing"


def test_parse_excel_skips_zero_amount_rows():
    data = make_xlsx([
        ["Category", "Cost"],
        ["Framing", 120000],
        ["", 0],
        ["Electrical", 0],
    ])
    rows = parse_excel_bytes(data)
    # Zero amount rows are included (spec says $0 is valid)
    assert len(rows) == 3
