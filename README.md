# Mock OFSC Application

A web application for **service agents** to view and manage service tickets stored in MongoDB. The application reads service requests from an existing MongoDB database and displays them in a table format for agents to review and work on.

## Features
- **Sign-in with Microsoft Entra ID (Azure AD)** using MSAL.js — only authenticated agents can view tickets.
- **Service ticket listing** displaying all tickets from the MongoDB `serviceRequests` collection in a sortable table.
- **Ticket details view** showing complete equipment and customer information for each service request.
- **"Chat with Support" button** that opens a new Microsoft Teams chat pre-titled with the case number for collaboration.
- **MongoDB integration** reading from an existing MongoDB database with the `serviceRequests` collection.
- **Container runtime** with a simple Node.js container that connects to your MongoDB instance.
- **Test suite** covering auth middleware, the Teams deep-link builder, and the HTTP API.

## Repository layout

```
mock-ofsc/
├── docs/
│   └── ARCHITECTURE.md          # design notes & data model
├── backend/
│   ├── src/                     # Express API
│   │   ├── server.js            # entry point
│   │   ├── app.js               # express app factory
│   │   ├── routes.cases.js      # /api/cases router (read-only)
│   │   ├── auth.js              # Entra JWT verification middleware
│   │   ├── teamsLink.js         # Teams deep-link builder
│   │   ├── db.js                # MongoDB connection
│   │   └── config.js            # env loader
│   ├── tests/                   # Jest tests
│   ├── package.json
│   └── .env.example
├── frontend/                    # static SPA (served by the API)
│   ├── index.html
│   ├── styles.css
│   ├── auth.js                  # MSAL.js wrapper
│   └── app.js                   # UI logic
└── Containerfile                # builds backend + bundles frontend
```

## Quick start

### 1. Prerequisites

You need an existing MongoDB instance with:
- A database (default: `service_requests`)
- A collection named `serviceRequests` containing service ticket documents
- Appropriate authentication credentials

### 2. Configure and run the backend

```bash
cd backend
cp .env.example .env
# Edit .env to set:
#   - MONGO_URI (connection string to your MongoDB)
#   - ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_AUDIENCE (for authentication)
npm install
npm start
```

**Required environment variables:**
- `MONGO_URI` - MongoDB connection string (e.g., `mongodb://username:password@host:port/service_requests`)
- `ENTRA_TENANT_ID` - Azure AD tenant ID
- `ENTRA_CLIENT_ID` - App registration client ID
- `ENTRA_AUDIENCE` - Expected audience claim (typically `api://<CLIENT_ID>`)

For local development without Entra, set `DISABLE_AUTH=true` in `.env`. The API will impersonate a `dev@local` user.

The backend serves the SPA from `/` and the API under `/api/*`, so a single port hosts everything.

### 3. Open the app

Visit <http://localhost:3000>. Sign in with a Microsoft account to view the list of service tickets. Click on "View Details" to see complete ticket information, and use the **Chat with Support** button to open Microsoft Teams with a pre-configured chat about the ticket.

### Entra app registrations
You need two Entra app registrations (or one with both an SPA platform and an exposed API):

1. **SPA** — used by the browser. Redirect URI: `http://localhost:3000` (or wherever you host the frontend). Add a permission for the API scope below.
2. **API** — exposes a scope such as `access_as_user`. The token's `aud` claim must match `ENTRA_AUDIENCE` on the backend (typically `api://<API_CLIENT_ID>`).

Then update:
- `frontend/auth.js` → `tenantId`, `clientId`, `apiScope`
- `backend/.env` → `MONGO_URI`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_AUDIENCE`

## MongoDB Collection Structure

The application expects documents in the `serviceRequests` collection with the following structure:

```javascript
{
  caseNumber: "SR-20260514-00001",
  status: "open",
  equipment: {
    serialNumber: "SN-001",
    productModel: "AX-200",
    purchaseDate: "2024-01-15",
    issueDescription: "Will not power on"
  },
  customer: {
    name: "Jane Doe",
    phone: "+1-555-010-0100",
    email: "jane.doe@example.com",
    address: "123 Main St, City, State"
  },
  createdBy: {
    username: "agent@contoso.com",
    name: "Agent Name"
  },
  createdAt: ISODate("2026-05-14T10:30:00Z"),
  updatedAt: ISODate("2026-05-14T10:30:00Z")
}
```

## Tests

```bash
cd backend
npm test
```

Test files:
- `tests/auth.test.js` — auth middleware with stubbed verifier
- `tests/teamsLink.test.js` — Teams deep-link construction
- `tests/cases.api.test.js` — full HTTP integration via supertest + an in-memory MongoDB

The integration suite uses [`mongodb-memory-server`](https://github.com/typegoose/mongodb-memory-server), which downloads a MongoDB binary on first run. On networks where `fastdl.mongodb.org` is blocked, set `MONGO_TEST_URI` to an externally provided MongoDB and the suite will use that instead:

```bash
MONGO_TEST_URI="mongodb://localhost:27017/srtest" npm test
```

## API summary

| Method | Path                       | Auth | Purpose                          |
|--------|----------------------------|------|----------------------------------|
| GET    | `/api/health`              | No   | Liveness                         |
| GET    | `/api/config`              | No   | Non-secret runtime config        |
| GET    | `/api/cases`               | Yes  | List cases, newest first         |
| GET    | `/api/cases/:caseNumber`   | Yes  | Fetch one case                   |
| PATCH  | `/api/cases/:caseNumber`   | Yes  | Update status                    |

Sample request:

```bash
curl -X GET http://localhost:3000/api/cases \
  -H "Authorization: Bearer $TOKEN"
```

Sample response (excerpt):

```json
{
  "items": [
    {
      "caseNumber": "SR-20260514-00001",
      "status": "open",
      "equipment": {
        "serialNumber": "SN-001",
        "productModel": "AX-200",
        "issueDescription": "Will not power on"
      },
      "customer": {
        "name": "Jane Doe",
        "phone": "+1-555-010-0100"
      },
      "createdAt": "2026-05-14T10:30:00.000Z"
    }
  ],
  "total": 42,
  "limit": 25,
  "skip": 0
}
```

## Container Deployment

To build and run the application in a container:

```bash
# Build the container image
podman build -t mock-ofsc:latest -f Containerfile .

# Run the container (requires existing MongoDB)
podman run -d \
  --name mock-ofsc \
  -p 3000:3000 \
  -e MONGO_URI="mongodb://username:password@mongodb-host:27017/service_requests" \
  -e ENTRA_TENANT_ID="your-tenant-id" \
  -e ENTRA_CLIENT_ID="your-client-id" \
  -e ENTRA_AUDIENCE="api://your-client-id" \
  mock-ofsc:latest
```

Replace `mongodb-host` with your MongoDB server hostname or IP address.

## Notes & next steps
- The application is read-only by default - service tickets are displayed but not created through the UI.
- The Teams deep link uses the public `/l/chat/0/0` format, which works for one-to-one or small group chats. For larger orchestration (Teams channels, tabs), use the Microsoft Graph API.
- For production, put the API behind HTTPS, set `CORS_ORIGIN` to the real SPA origin, and run with `DISABLE_AUTH` unset.
- Ensure your MongoDB database has appropriate indexes for performance:
  - `{ caseNumber: 1 }` (unique)
  - `{ createdAt: -1 }`
  - `{ "customer.phone": 1 }`
