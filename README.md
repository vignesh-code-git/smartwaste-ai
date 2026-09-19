# SmartWaste AI

Roadside plastic-waste detection and cleanup coordination. Footage is
analysed with an open-vocabulary detector (YOLOE-26L), every piece of litter
is tracked and counted, and the results feed a command centre for reports,
hotspot mapping, cleanup tasks and citizen complaints across India.

## Features

- **Live Detection**: demo footage, uploaded video or a live camera, with
  item outlines, a per-item register and material breakdown
- **Detection Reports**: saved analyses with review status and cleanup assignment
- **Waste Map**: monitoring sites across India, coloured by priority
- **Cleanup Tasks**: work orders for field teams, tracked to completion
- **Priority Areas** and **Solutions**: sites ranked by uncleared litter and complaints
- **Citizen services**: report an issue, track it by reference, helplines and FAQs
- **Search**: global search (Ctrl K) and location search for any place in India

## Stack

| Part | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Leaflet (OpenStreetMap tiles) |
| Backend | Django 6, Django REST Framework |
| Database | PostgreSQL |
| Detection | Ultralytics YOLOE-26L segmentation |
| Places | OpenStreetMap Photon (search) and Nominatim (district lookup) |

## Data model

```
State → District → Site → Report → ReportItem
                     ├──→ CleanupTask ←── FieldTeam
                     └──→ CitizenIssue
SystemSettings · HelplineContact · FaqEntry
```

## Setup

### Backend

```bash
cd backend
python -m venv env
env\Scripts\activate          # Windows; use `source env/bin/activate` elsewhere
pip install -r requirements.txt
copy .env.example .env        # then fill in SECRET_KEY and DB_PASSWORD
python manage.py migrate
python manage.py seed_demo_data
python manage.py runserver 127.0.0.1:8000
```

Create an empty PostgreSQL database matching the `DB_*` values in `.env`
before running `migrate`.

**Model weights** are not in the repository. On the first start the backend
loads `backend/weights/yoloe-26l-seg.pt` (Ultralytics downloads it if it is
missing), bakes the waste vocabulary into `smartwaste-yoloe.pt` and reuses
that file afterwards.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. The backend must allow this origin; it is set
in `backend/config/settings`.

### Demo analysis

The demo video ships with a precomputed analysis so it opens instantly. To
regenerate it:

```bash
cd backend
python manage.py analyse_video test_videos/clean_Roadside.mp4 ../frontend/public/demo/clean_Roadside.analysis.json --step 0.2
```

## Notes

Detection is AI-assisted and not perfect; verify results before field action.
Footage is analysed only by your own backend. Place search sends the search
text to OpenStreetMap services.
