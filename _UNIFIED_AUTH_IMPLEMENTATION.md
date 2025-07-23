# Unified Authentication Implementation Guide

## 🎯 Problem Solved
This document addresses the recurring issue of authentication confusion, rework, and inconsistency across frontend, backend, API, and test components.

## 🏗️ Solution: Single Source of Truth
We've implemented a **UnifiedAuthService** that provides:
- ✅ Centralized authentication logic
- ✅ Standardized user objects and types
- ✅ Consistent test credentials across all scripts
- ✅ Unified API headers and token management
- ✅ Cross-component compatibility

## 📁 Key Files

### Core Authentication Service
- `src/services/unifiedAuth.ts` - **MAIN AUTH SERVICE** (single source of truth)
- `src/contexts/AuthContext.unified.tsx` - New frontend context using unified auth
- `src/middleware/auth.ts` - Updated to use UnifiedAuthService
- `src/routes/auth.ts` - Updated to use UnifiedAuthService

### Test Scripts (Updated)
- `test-unified-auth-complete.cjs` - Comprehensive test of all authentication flows
- `test-unified-auth.cjs` - Original unified auth test

### Legacy Files (To Be Replaced)
- `src/services/authService.backend.ts` - Replace with UnifiedAuthService
- `src/services/authService.ts` - Replace with UnifiedAuthClient
- `src/contexts/AuthContext.tsx` - Replace with AuthContext.unified.tsx

## 🔄 Migration Steps

### 1. Backend Routes (COMPLETED)
```typescript
// OLD
import { AuthService } from '../services/authService.backend';
const authService = new AuthService(database.getPool());

// NEW  
import { UnifiedAuthService } from '../services/unifiedAuth';
const authService = new UnifiedAuthService(database.getPool(), process.env.JWT_SECRET);
```

### 2. Frontend Context (READY TO DEPLOY)
```bash
# Replace the old AuthContext
mv src/contexts/AuthContext.tsx src/contexts/AuthContext.legacy.tsx
mv src/contexts/AuthContext.unified.tsx src/contexts/AuthContext.tsx
```

### 3. Test Scripts (TEMPLATE READY)
```javascript
// OLD
const authService = require('./src/services/authService.ts');

// NEW
const { UnifiedAuthClient, TEST_CREDENTIALS } = require('./src/services/unifiedAuth.ts');
const authClient = new UnifiedAuthClient();

// Centralized credentials
const bennieCredentials = TEST_CREDENTIALS.BENNIE;
const result = await authClient.loginWithCredentials(bennieCredentials);
```

## 📊 Centralized Test Credentials

### Available Test Users
```typescript
TEST_CREDENTIALS = {
  BENNIE: {
    username: 'bennie',
    password: 'password', 
    tenant_id: 'visualizehr',
    role: 'admin' // Root admin - can access all tenants
  },
  JEREMY: {
    username: 'jeremy',
    password: 'password',
    tenant_id: 'coligos', 
    role: 'admin' // Tenant admin - should be restricted to coligos hierarchy
  },
  DEMO: {
    username: 'demo',
    password: 'demo',
    tenant_id: 'demo-tenant',
    role: 'user' // Regular user - own tenant only
  }
}
```

### Usage in Scripts
```javascript
// Instead of hardcoding credentials everywhere
const authClient = new UnifiedAuthClient();
const result = await authClient.login('BENNIE'); // Uses TEST_CREDENTIALS.BENNIE
```

## 🔐 Authentication Flow

### 1. Login Process
```
User Input → UnifiedAuthService.authenticate() → Database Query → JWT Token → Frontend Storage
```

### 2. API Requests
```
Frontend → AuthClient.createAuthHeaders() → Bearer Token → Backend Middleware → Route Handler
```

### 3. Cross-Tenant Access
```
Admin User → Request with ?tenant_id=X → UnifiedAuthService.canAccessTenant() → Allow/Deny
```

## 🚫 Security Features

### Tenant Hierarchy Validation (IN PROGRESS)
```typescript
// Current: Any admin can access any tenant (SECURITY GAP)
const isAdmin = user.role === 'admin';

// Needed: Tenant hierarchy validation  
const canAccess = authService.canAccessTenant(user, requestedTenantId);
```

### Available Tenants Logic
```typescript
// Root admin (visualizehr)
available_tenants: ['visualizehr', 'coligos', 'coligosclient1', 'coligosclient2', 'demo-tenant']

// Tenant admin (coligos)  
available_tenants: ['coligos', 'coligosclient1', 'coligosclient2']

// Regular user
available_tenants: ['demo-tenant'] // Own tenant only
```

## 🧪 Testing Commands

### Comprehensive Authentication Test
```bash
node test-unified-auth-complete.cjs
```

### Individual Component Tests
```bash
# Backend authentication
node debug-bennie-roles.cjs

# Cross-tenant data access
node test-tenant-specific-data.cjs

# Service parameters
node check-service-params-tables.cjs
```

## 🔄 Deployment Process

### Step 1: Validate Current System
```bash
# Ensure backend and frontend servers are running
npm run dev:server  # Terminal 1
npm run dev        # Terminal 2

# Run unified auth test
node test-unified-auth-complete.cjs
```

### Step 2: Switch Frontend Context
```bash
# Backup current context
cp src/contexts/AuthContext.tsx src/contexts/AuthContext.backup.tsx

# Deploy unified context
cp src/contexts/AuthContext.unified.tsx src/contexts/AuthContext.tsx

# Restart frontend
# Ctrl+C in Terminal 2, then npm run dev
```

### Step 3: Update Test Scripts
```bash
# Update each script to use UnifiedAuthService
# Template: test-unified-auth-complete.cjs
# Pattern: Replace authService with UnifiedAuthClient
```

### Step 4: Remove Legacy Files (After Validation)
```bash
rm src/services/authService.backend.ts
rm src/services/authService.ts  
rm src/contexts/AuthContext.backup.tsx
```

## 🎯 Benefits Achieved

### ✅ No More Authentication Confusion
- Single `unifiedAuth.ts` file contains ALL authentication logic
- Consistent user objects across frontend, backend, and tests
- Centralized test credentials prevent hardcoding errors

### ✅ Rapid Development Restart
- `TEST_CREDENTIALS` object provides instant access to test users
- No need to remember or lookup usernames/passwords/tenants
- Unified API headers prevent token format mistakes

### ✅ Cross-Component Compatibility
- Backend routes use `UnifiedAuthService.authenticate()`
- Frontend uses `UnifiedAuthClient.loginWithCredentials()`
- Tests use `TEST_CREDENTIALS.BENNIE/JEREMY/DEMO`
- All generate compatible JWT tokens and user objects

### ✅ Security Consistency
- Token validation logic centralized in `UnifiedAuthService.validateToken()`
- Tenant access rules in `canAccessTenant()` method
- Admin hierarchy defined in `getAvailableTenants()`

## 🚨 Known Issues & Next Steps

### 1. Security Gap (HIGH PRIORITY)
**Issue**: Jeremy (coligos admin) can access visualizehr data  
**Fix**: Implement tenant hierarchy validation in service parameters route  
**File**: `src/routes/serviceParams.ts`

### 2. Legacy Code Cleanup (MEDIUM)
**Issue**: Old authService files still exist  
**Fix**: Remove after unified auth is fully validated  
**Files**: `src/services/authService.*.ts`

### 3. Health Check Endpoint (MEDIUM)
**Issue**: Missing `/api/health` for ECS deployment  
**Fix**: Add simple health check route  
**Implementation**: Return database connection status

## 📝 Success Metrics

- ✅ Zero authentication-related rework cycles
- ✅ Consistent login behavior across all components  
- ✅ Single place to update authentication logic
- ✅ Test scripts use same credentials as manual testing
- ✅ Cross-tenant access working for authorized users
- ⚠️ Security validation for unauthorized access (in progress)
