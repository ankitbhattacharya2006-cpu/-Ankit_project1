# Frontend Integration Guide

## Overview
This implementation adds complete patient history, analysis results, and admin dashboard features to the INNER_EYE frontend.

## Components Created

### 1. **PatientHistory** (`components/PatientHistory.js`)
- Displays patient profile with statistics (medical records, critical findings, analyses)
- Paginated medical records with pagination controls
- Form to add new medical records (hospital_admin/system_admin only)
- Color-coded severity levels (normal, moderate, critical)

### 2. **PatientAnalysis** (`components/PatientAnalysis.js`)
- Displays AI analysis results for a patient
- Shows prediction, confidence, volume, diameter, dice score
- Displays detailed analysis report
- Card-based grid layout

### 3. **AdminDashboard** (`components/AdminDashboard.js`)
- Login history viewer with IP tracking and status
- Critical patients monitor (system_admin only)
- Tabbed interface for different views
- Sortable login history and patient list

### 4. **PatientDashboard** (`pages/PatientDashboard.js`)
- Main integration page combining all components
- Search by patient ID
- Role-based access control
- Tab navigation between views

## API Utilities (`utils/api.js`)
Centralized API functions grouped by feature:
- `apiPatient.*` - Patient history, analysis, records
- `apiAdmin.*` - Login history, critical patients
- `apiAuth.*` - Authentication
- `apiHospital.*` - Hospital operations

## Integration Steps

### Option 1: Add to Existing React App (App.js)
```javascript
// 1. Add import at top of App.js
import PatientDashboard from './pages/PatientDashboard';

// 2. Add route/state in App component
const [currentPage, setCurrentPage] = useState('scan');

// 3. In JSX, add conditional rendering:
{currentPage === 'patient-dashboard' && (
  <PatientDashboard token={token} userRole={userRole} />
)}

// 4. Add navigation button
<button onClick={() => setCurrentPage('patient-dashboard')}>
  Patient Dashboard
</button>
```

### Option 2: Standalone React Router Setup
```javascript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PatientDashboard from './pages/PatientDashboard';
import ScanApp from './App';

function Main() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/scan" element={<ScanApp />} />
        <Route path="/patients" element={<PatientDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
```

## Styling
All components include dedicated CSS files:
- `styles/PatientHistory.css`
- `styles/PatientAnalysis.css`
- `styles/AdminDashboard.css`
- `styles/PatientDashboard.css`

Styling uses consistent color scheme:
- Primary Blue: `#4ea8ff`
- Critical Red: `#ff2f2f`
- Moderate Orange: `#ff9a2a`
- Success Green: `#2ecc71`

## Authentication
All API calls require Bearer token in Authorization header:
```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
}
```

CSRF tokens required for POST/DELETE operations:
```javascript
headers: {
  'X-CSRF-Token': csrfToken,
}
```

## Role-Based Access
- **patient**: View own history, analysis
- **hospital_admin**: View/add all patient records, view login history
- **system_admin**: Full access (login history, critical patients, all records)

## API Endpoints Used

### Patient Management
- `GET /patient/{patient_id}` - Patient details
- `GET /patient/{patient_id}/history` - Medical records
- `GET /patient/{patient_id}/analysis` - Analysis results
- `POST /patient/{patient_id}/record` - Add medical record

### Admin Functions
- `GET /user/{username}/login-history` - Login audit trail
- `GET /patients/critical` - Critical patients list

## Usage Examples

### Fetch Patient History
```javascript
import { apiPatient } from './utils/api';

const data = await apiPatient.getHistory(patientId, token, limit=50, offset=0);
// Returns: { patient_id, records: [...], pagination: {...} }
```

### Add Medical Record
```javascript
await apiPatient.addRecord(
  patientId,
  {
    record_type: 'CT Scan',
    title: 'Chest CT',
    organ: 'Lungs',
    modality: 'CT',
    severity: 'MODERATE',
    findings: { nodule_count: 2 }
  },
  token,
  csrfToken
);
```

### Get Admin Login History
```javascript
const loginData = await apiAdmin.getLoginHistory(username, token, limit=50);
// Returns: { username, user_id, login_history: [...] }
```

### Monitor Critical Patients
```javascript
const criticalData = await apiAdmin.getCriticalPatients(token, limit=50);
// Returns: { status, total_critical, critical_patients: [...] }
```

## Performance Optimizations
- Paginated queries (default 50 records per page)
- Lazy loading of components
- React.memo on PatientAnalysis to prevent re-renders
- Efficient API caching patterns
- CSS Grid for responsive layouts

## Known Limitations
- Login history limited to last 50 records per query
- Critical patients limited to last 50 across system
- Admin console requires system_admin role for full functionality

## Future Enhancements
- Real-time WebSocket updates for critical patients
- Advanced filtering and search
- Export patient data to CSV/PDF
- Advanced analytics dashboard
- Integration with external DICOM viewers
