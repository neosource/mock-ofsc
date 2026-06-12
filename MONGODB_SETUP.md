# MongoDB Setup Guide

This application expects an existing MongoDB database with service request data. This document describes the required setup.

## Database Requirements

### Database Name
Default: `service_requests` (configurable via `MONGO_URI` in `.env`)

### Collection Name
**Required:** `serviceRequests`

This collection must exist and contain service ticket documents.

## Document Schema

Each document in the `serviceRequests` collection should follow this structure:

```javascript
{
  caseNumber: "SR-20260514-00001",        // Unique case identifier
  status: "open",                          // Status: open, in_progress, resolved, closed
  equipment: {
    serialNumber: "SN-001",               // Equipment serial number
    productModel: "AX-200",               // Product model name
    purchaseDate: "2024-01-15",           // Optional: Purchase date (ISO format)
    issueDescription: "Will not power on" // Description of the issue
  },
  customer: {
    name: "Jane Doe",                     // Customer full name
    phone: "+1-555-010-0100",             // Customer phone number
    email: "jane.doe@example.com",        // Optional: Customer email
    address: "123 Main St, City, State"   // Optional: Customer address
  },
  createdBy: {                            // Optional: Agent who created the ticket
    username: "agent@contoso.com",
    name: "Agent Name"
  },
  createdAt: ISODate("2026-05-14T10:30:00Z"),  // Timestamp when ticket was created
  updatedAt: ISODate("2026-05-14T10:30:00Z")   // Timestamp when ticket was last updated
}
```

## Recommended Indexes

For optimal performance, create the following indexes:

```javascript
// Unique index on caseNumber
db.serviceRequests.createIndex({ caseNumber: 1 }, { unique: true, name: "uniq_caseNumber" });

// Index for sorting by creation date (newest first)
db.serviceRequests.createIndex({ createdAt: -1 }, { name: "recent_first" });

// Index for searching by customer phone
db.serviceRequests.createIndex({ "customer.phone": 1 }, { name: "by_phone" });

// Optional: Index for filtering by status
db.serviceRequests.createIndex({ status: 1 }, { name: "by_status" });
```

## Database User Permissions

The application user must have at least `read` permission on the `serviceRequests` collection. If you want to support status updates via the PATCH endpoint, the user needs `readWrite` permission.

Example user creation:

```javascript
use service_requests

db.createUser({
  user: "srapp",
  pwd: "your-secure-password",
  roles: [
    { role: "read", db: "service_requests" }
    // Use "readWrite" if you need status update functionality
  ]
});
```

## Connection String Format

Update your `.env` file with the MongoDB connection string:

```bash
MONGO_URI=mongodb://username:password@host:port/service_requests?authSource=service_requests
```

### Examples:

**Local MongoDB:**
```bash
MONGO_URI=mongodb://srapp:password@localhost:27017/service_requests?authSource=service_requests
```

**MongoDB Atlas:**
```bash
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/service_requests?retryWrites=true&w=majority
```

**MongoDB with replica set:**
```bash
MONGO_URI=mongodb://username:password@host1:27017,host2:27017/service_requests?replicaSet=rs0&authSource=service_requests
```

## Sample Data

To populate your database with sample data for testing, you can use this script:

```javascript
use service_requests

db.serviceRequests.insertMany([
  {
    caseNumber: "SR-20260612-00001",
    status: "open",
    equipment: {
      serialNumber: "SN-12345",
      productModel: "Model-X100",
      issueDescription: "Device not powering on"
    },
    customer: {
      name: "John Smith",
      phone: "+1-555-0100",
      email: "john.smith@example.com"
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    caseNumber: "SR-20260612-00002",
    status: "in_progress",
    equipment: {
      serialNumber: "SN-12346",
      productModel: "Model-X200",
      issueDescription: "Display flickering"
    },
    customer: {
      name: "Jane Doe",
      phone: "+1-555-0101",
      email: "jane.doe@example.com"
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);
```

## Troubleshooting

### Connection Issues

1. **Authentication failed**: Verify username, password, and `authSource` parameter
2. **Cannot connect**: Check if MongoDB is running and accessible from your network
3. **Database not found**: Ensure the database name in the connection string matches your setup
4. **Collection not found**: Create the `serviceRequests` collection if it doesn't exist

### Testing Connection

You can test your MongoDB connection using `mongosh`:

```bash
mongosh "mongodb://username:password@host:port/service_requests?authSource=service_requests"
```

Then verify the collection exists:

```javascript
show collections
db.serviceRequests.countDocuments()
```
