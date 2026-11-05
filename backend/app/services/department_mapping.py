from app.models.department import Department, DepartmentReference


def _normalize_category(category: str) -> str:
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


def recommend_department(category: str | None) -> DepartmentReference | None:
    if category is None or not category.strip():
        return None
    department = _CATEGORY_TO_DEPARTMENT.get(_normalize_category(category))
    if department is None:
        return None
    return DepartmentReference(code=department.code, name=department.name)
