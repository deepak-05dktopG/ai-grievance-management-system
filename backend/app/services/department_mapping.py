"""Deterministic category-to-department rules; AI output never chooses the department."""
# Exercise through grievance submission: python -m uvicorn app.main:app --reload (from backend).

from app.models.department import Department, DepartmentReference


def _normalize_category(category: str) -> str:
    """Fold case and collapse repeated whitespace for deterministic comparisons."""
    return " ".join(category.casefold().split())


# Illustrative mappings for a hypothetical district; adjust these centrally for
# the prototype's intended deployment context. They are not district-specific.
ILLUSTRATIVE_DEPARTMENTS = (
    Department(
        code="PWD",
        name="Public Works",
        supported_categories=["Roads and Infrastructure"],
    ),
    Department(
        code="WSD",
        name="Water Supply",
        supported_categories=["Water Supply"],
    ),
    Department(
        code="SWM",
        name="Sanitation and Waste Management",
        supported_categories=["Sanitation and Waste Management"],
    ),
    Department(
        code="ED",
        name="Electricity",
        supported_categories=["Electricity"],
    ),
    Department(
        code="HD",
        name="Public Health",
        supported_categories=["Public Health"],
    ),
    Department(
        code="FCS",
        name="Food and Civil Supplies",
        supported_categories=["Public Distribution System"],
    ),
    Department(
        code="RD",
        name="Revenue",
        supported_categories=["Land and Revenue"],
    ),
)

_CATEGORY_TO_DEPARTMENT = {
    _normalize_category(category): department
    for department in ILLUSTRATIVE_DEPARTMENTS
    for category in department.supported_categories
}
_CANONICAL_CATEGORY = {
    _normalize_category(category): category
    for department in ILLUSTRATIVE_DEPARTMENTS
    for category in department.supported_categories
}
_DEPARTMENT_BY_CODE = {
    department.code.casefold(): department for department in ILLUSTRATIVE_DEPARTMENTS
}


def recommend_department(category: str | None) -> DepartmentReference | None:
    """Map only a configured category; return ``None`` for manual routing.

    Steps: reject blank input, normalize case/spacing, look up the fixed mapping,
    and return a typed department reference. Unknown categories return ``None``
    so the caller can request human review. The model never chooses a department.
    """
    if category is None or not category.strip():
        return None
    department = _CATEGORY_TO_DEPARTMENT.get(_normalize_category(category))
    if department is None:
        return None
    return DepartmentReference(code=department.code, name=department.name)


def get_department_by_code(code: str) -> DepartmentReference | None:
    """Resolve a configured department code without accepting unknown values."""
    department = _DEPARTMENT_BY_CODE.get(code.strip().casefold())
    if department is None:
        return None
    return DepartmentReference(code=department.code, name=department.name)


def canonicalize_supported_category(category: str) -> str | None:
    """Return the configured display label for a matching category, if supported."""
    return _CANONICAL_CATEGORY.get(_normalize_category(category))
