# Azure AD App Registration Setup - Operational Excellence App

## App Registration Redirect URIs

Add the following **Redirect URIs** to your Azure AD App Registration:

### UAT Environment
```
https://oeapp-uat.gmrlapps.com/auth/callback
```

### Production Environment
```
https://oeapp.gmrlapps.com/auth/callback
```

---

## Step-by-Step Setup

### 1. Go to Azure Portal
Navigate to: [Azure Portal](https://portal.azure.com) → **Azure Active Directory** → **App Registrations**

### 2. Create New Registration (if needed)
- Click **"New registration"**
- Name: `Operational Excellence App`
- Supported account types: **Single tenant** (or as per your organization)
- Click **Register**

### 3. Add Redirect URIs
1. Go to **Authentication** in the left menu
2. Click **"Add a platform"** → Select **"Web"**
3. Add both redirect URIs:
   - `https://oeapp-uat.gmrlapps.com/auth/callback`
   - `https://oeapp.gmrlapps.com/auth/callback`
4. Check **"ID tokens"** under Implicit grant
5. Click **Configure**

### 4. Create Client Secret
1. Go to **Certificates & secrets**
2. Click **"New client secret"**
3. Add description: `OEApp Secret`
4. Choose expiry: **24 months** (recommended)
5. Click **Add**
6. **COPY THE SECRET VALUE NOW** - you won't see it again!

### 5. Get Your IDs
From the **Overview** page, copy:
- **Application (client) ID** → Use as `AZURE_CLIENT_ID`
- **Directory (tenant) ID** → Use as `AZURE_TENANT_ID`

---

## Environment Configuration Summary

| Setting | UAT | Production |
|---------|-----|------------|
| APP_URL | https://oeapp-uat.gmrlapps.com | https://oeapp.gmrlapps.com |
| REDIRECT_URI | https://oeapp-uat.gmrlapps.com/auth/callback | https://oeapp.gmrlapps.com/auth/callback |
| SQL_DATABASE | OEApp_UAT | OEApp_Live |

---

## Database Setup

Run the SQL scripts to create the databases:

```powershell
# For UAT
sqlcmd -S your-server.database.windows.net -U admin -P password -i sql/create-database-uat.sql

# For Production
sqlcmd -S your-server.database.windows.net -U admin -P password -i sql/create-database-live.sql
```

---

## Quick Start

1. Copy the appropriate `.env` file:
   ```powershell
   # For UAT
   Copy-Item .env.uat .env

   # For Production
   Copy-Item .env.live .env
   ```

2. Edit `.env` with your Azure AD credentials

3. Run the database script

4. Start the app:
   ```powershell
   npm install
   npm start
   ```
