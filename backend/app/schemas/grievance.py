from app.models.common import ComplaintDescription, MongoModel
from app.models.grievance import CitizenDetails, GrievanceDocument


class GrievanceCreateRequest(MongoModel):
    citizen_details: CitizenDetails
    complaint_description: ComplaintDescription


class GrievanceResponse(GrievanceDocument):
    pass
