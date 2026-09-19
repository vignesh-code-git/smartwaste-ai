"""Reference data shared by models, migrations and the seed command."""

# code (ISO 3166-2:IN suffix), name, kind, capital, latitude, longitude
STATES = [
    ("AN", "Andaman and Nicobar Islands", "ut", "Port Blair", 11.6234, 92.7265),
    ("AP", "Andhra Pradesh", "state", "Amaravati", 16.5131, 80.5165),
    ("AR", "Arunachal Pradesh", "state", "Itanagar", 27.0844, 93.6053),
    ("AS", "Assam", "state", "Dispur", 26.1433, 91.7898),
    ("BR", "Bihar", "state", "Patna", 25.5941, 85.1376),
    ("CH", "Chandigarh", "ut", "Chandigarh", 30.7333, 76.7794),
    ("CT", "Chhattisgarh", "state", "Raipur", 21.2514, 81.6296),
    ("DH", "Dadra and Nagar Haveli and Daman and Diu", "ut", "Daman", 20.3974, 72.8328),
    ("DL", "Delhi", "ut", "New Delhi", 28.6139, 77.2090),
    ("GA", "Goa", "state", "Panaji", 15.4909, 73.8278),
    ("GJ", "Gujarat", "state", "Gandhinagar", 23.2156, 72.6369),
    ("HR", "Haryana", "state", "Chandigarh", 30.7333, 76.7794),
    ("HP", "Himachal Pradesh", "state", "Shimla", 31.1048, 77.1734),
    ("JK", "Jammu and Kashmir", "ut", "Srinagar", 34.0837, 74.7973),
    ("JH", "Jharkhand", "state", "Ranchi", 23.3441, 85.3096),
    ("KA", "Karnataka", "state", "Bengaluru", 12.9716, 77.5946),
    ("KL", "Kerala", "state", "Thiruvananthapuram", 8.5241, 76.9366),
    ("LA", "Ladakh", "ut", "Leh", 34.1526, 77.5771),
    ("LD", "Lakshadweep", "ut", "Kavaratti", 10.5669, 72.6420),
    ("MP", "Madhya Pradesh", "state", "Bhopal", 23.2599, 77.4126),
    ("MH", "Maharashtra", "state", "Mumbai", 19.0760, 72.8777),
    ("MN", "Manipur", "state", "Imphal", 24.8170, 93.9368),
    ("ML", "Meghalaya", "state", "Shillong", 25.5788, 91.8933),
    ("MZ", "Mizoram", "state", "Aizawl", 23.7271, 92.7176),
    ("NL", "Nagaland", "state", "Kohima", 25.6751, 94.1086),
    ("OD", "Odisha", "state", "Bhubaneswar", 20.2961, 85.8245),
    ("PY", "Puducherry", "ut", "Puducherry", 11.9416, 79.8083),
    ("PB", "Punjab", "state", "Chandigarh", 30.7333, 76.7794),
    ("RJ", "Rajasthan", "state", "Jaipur", 26.9124, 75.7873),
    ("SK", "Sikkim", "state", "Gangtok", 27.3389, 88.6065),
    ("TN", "Tamil Nadu", "state", "Chennai", 13.0827, 80.2707),
    ("TG", "Telangana", "state", "Hyderabad", 17.3850, 78.4867),
    ("TR", "Tripura", "state", "Agartala", 23.8315, 91.2868),
    ("UP", "Uttar Pradesh", "state", "Lucknow", 26.8467, 80.9462),
    ("UK", "Uttarakhand", "state", "Dehradun", 30.3165, 78.0322),
    ("WB", "West Bengal", "state", "Kolkata", 22.5726, 88.3639),
]

# Other spellings and codes seen in map data, mapped to the codes above
STATE_ALIASES = {
    "OR": "OD",
    "TS": "TG",
    "UT": "UK",
    "UL": "UK",
    "CG": "CT",
    "DD": "DH",
    "DN": "DH",
    "orissa": "OD",
    "pondicherry": "PY",
    "uttaranchal": "UK",
    "national capital territory of delhi": "DL",
    "nct of delhi": "DL",
    "dadra and nagar haveli": "DH",
    "daman and diu": "DH",
}

MATERIAL_CHOICES = [
    ("plastic", "Plastic"),
    ("paper", "Paper"),
    ("metal", "Metal"),
    ("other", "Other"),
]

# Waste types the detector reports, and their material
WASTE_MATERIALS = {
    "Bottle / Can": "plastic",
    "Plastic Bag": "plastic",
    "Garbage Bag": "plastic",
    "Chips / Snack Packet": "plastic",
    "Plastic Cup": "plastic",
    "Beverage Can": "metal",
    "Carton": "paper",
    "Carton / Tetra Pack": "paper",
    "Paper Litter": "paper",
}


def material_for(waste_type):
    return WASTE_MATERIALS.get(waste_type, "other")


def state_code(value):
    """Resolve a state name, ISO code (``IN-KL``) or alias to one of our codes."""

    if not value:
        return None

    value = value.strip()
    code = value.upper().removeprefix("IN-")

    codes = {state[0] for state in STATES}
    if code in codes:
        return code
    if code in STATE_ALIASES:
        return STATE_ALIASES[code]

    lowered = value.lower()
    for state in STATES:
        if state[1].lower() == lowered:
            return state[0]
    return STATE_ALIASES.get(lowered)
