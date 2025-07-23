# Centralized Authentication Service - Design & Implementation

## 🎯 Problem Analysis

### Current Authentication Scatter:
- **Frontend**: AuthContext, Login component, API service calls
- **Backend**: Multiple route handlers, middleware, service methods
- **Database**: Multiple queries across different files
- **Testing**: Repeated authentication logic in test scripts

### Issues Identified:
- **Inconsistent credential handling** (username vs email confusion)
- **Repeated authentication logic** across components
- **Multiple database query patterns** for user validation
- **Test scripts with hardcoded credentials**
- **No single source of truth** for authentication state

## 🏗️ Centralized Authentication Architecture

### Single Authentication Service (Shared)
```typescript
// src/services/unifiedAuth.ts
export class UnifiedAuthService {
  // Single method for all authentication needs
  // Handles frontend, backend, testing, and database consistently
  // Returns standardized auth objects across all components
}
```

### Standardized Auth Objects
```typescript
interface AuthUser {
  id: string;
  username: string;
  tenant_id: string;
  role: 'admin' | 'user';
  permissions: string[];
  available_tenants: string[];  // For admin cross-tenant access
  email?: string;
  email_verified: boolean;
}

interface AuthToken {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
}

interface AuthCredentials {
  username: string;  // ALWAYS username, never email
  password: string;
  tenant_id?: string;
}
```

## 🔧 Implementation Plan

### 1. Create Unified Auth Service
### 2. Update All Components to Use Service
### 3. Standardize Test Credentials
### 4. Create Auth State Manager
### 5. Implement Cross-Component Consistency

---

## Implementation Details Below...
