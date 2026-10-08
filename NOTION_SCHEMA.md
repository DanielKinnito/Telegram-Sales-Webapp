# Notion Relational Database Specification

All 6 databases must be created under the integration root page with exact property names and data types.

## 1. Sales Reps DB
- `Telegram ID` (Title / Text, Unique Index)
- `Full Name` (Text)
- `Phone` (Phone number)
- `Role` (Select: `Sales Rep`, `Front Desk`, `Manager`)
- `Status` (Select: `Pending Approval`, `Active`, `Inactive`)
- `Total Sales Count` (Rollup or Number)
- **Relations:**
  - `Accounts` (Relation to Accounts DB)
  - `Deals` (Relation to Deals DB)
  - `Sales Logs` (Relation to Sales Logs DB)

## 2. Accounts (Customers) DB
- `Company Name` (Title)
- `TIN Number` (Text, Unique Index - indexed for fast lookup. Strictly 10 numeric digits: `^\d{10}$`)
- `TIN Format Valid` (Formula: `if(length(prop("TIN Number")) == 10 and test(prop("TIN Number"), "^[0-9]{10}$"), "✅ Valid (10 Digits)", "❌ Invalid (Must be 10 digits)")`)
- `Address` (Text)
- `Industry` (Select)
- `Assigned Date` (Date)
- **Relations:**
  - `Owner` (Relation to Sales Reps DB - 1 Rep)
  - `Contacts` (Relation to Contacts DB)
  - `Deals` (Relation to Deals DB)

## 3. Deals / Pipeline DB
- `Deal Title` (Title)
- `Stage` (Select: `New`, `Contacted`, `Proposal`, `Payment Pending Verification`, `Won`, `Lost`)
- `Amount` (Number, Currency)
- `Deposit Ref #` (Text)
- `Payment Proof URL` (URL / Files & media)
- **Relations:**
  - `Account` (Relation to Accounts DB)
  - `Assigned Rep` (Relation to Sales Reps DB)
  - `Sales Logs` (Relation to Sales Logs DB)

## 4. Contacts DB
- `Contact Name` (Title)
- `Phone` (Phone number)
- `Email` (Email)
- `Position` (Text)
- `Primary Contact Flag` (Checkbox)
- **Relations:**
  - `Account` (Relation to Accounts DB)

## 5. Sales Logs DB
- `Log Title / ID` (Title)
- `Interaction Type` (Select: `Call`, `Meeting`, `Note`)
- `Activity Date` (Date)
- `Note Content` (Text)
- `Location` (Text)
- **Relations:**
  - `Deal` (Relation to Deals DB)
  - `Logged By` (Relation to Sales Reps DB)

## 6. Rotational Queue DB
- `Rep ID` (Title / Relation to Sales Reps DB)
- `Order Position` (Number)
- `Availability Status` (Select: `Available`, `Busy`, `Offline`)
- `Last Assigned Timestamp` (Date / Created Time)