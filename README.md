## 3. API Integration & Backend Automation *(Active Development)*

**GitHub:** https://github.com/tacujanairo

### Key Features
- **Shopify Webhook Processing**  
  Handles orders, customer events, and inventory updates.

- **HMAC Signature Verification**  
  Validates incoming requests using Shopify's webhook verification flow.

- **Idempotent Database Logic**  
  Prevents duplicate inserts during webhook retries or repeated delivery attempts.

- **Lightweight Architecture**  
  Designed for low-resource, event-driven server environments.

### Technical Overview

#### Backend
- Node.js
- Sqlite

#### Integrations
- Shopify Admin API
- HubSpot API
- Airtable API

#### Infrastructure
- Debian Linux
- Git/GitHub
- UFW Firewall

#### Security
- HMAC verification
- Raw payload validation