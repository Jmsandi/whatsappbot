# Role System Integration with Special Contacts

## Overview

The role system now integrates with the existing `special_contacts` table in the admin dashboard. This allows administrators to assign health worker roles to special guests directly through the admin interface.

## How It Works

### Priority System

When determining a user's role, the system checks in this order:

1. **Special Contacts Table** (highest priority)
   - If the user's phone number exists in `special_contacts` with `status='active'`
   - The role from this table is used
   - This allows admins to override default roles

2. **Users Table** (fallback)
   - If not found in special_contacts
   - Uses the role from the `users` table
   - Defaults to 'support' if no role is set

### Admin Dashboard Integration

Administrators can now assign roles through the existing **Special Contacts** section:

1. Navigate to **Settings → Special Contacts**
2. Click **Add Contact** or edit an existing contact
3. Fill in:
   - **Name**: Contact's full name
   - **Phone**: WhatsApp phone number (with country code)
   - **Email**: Optional email address
   - **Role**: Select from dropdown:
     - `support` - Support Staff (basic health education)
     - `health_worker` - Health Worker (frontline medical assistant)
     - `supervisor` - Supervisor (program coordinator)
     - `admin` - Admin/Clinical Expert (advanced medical practitioner)
   - **Status**: Set to `active` for role to take effect

4. Save the contact

### Example Use Cases

#### Scenario 1: Designating Health Workers
```
Admin adds a health worker to special_contacts:
- Name: "Dr. Amara Kamara"
- Phone: "+23276123456"
- Role: "health_worker"
- Status: "active"

Result: When Dr. Kamara sends messages via WhatsApp, they receive
health_worker-level prompts and can provide basic clinical guidance.
```

#### Scenario 2: Promoting a Supervisor
```
Admin adds a supervisor to special_contacts:
- Name: "Nurse Fatu Sesay"
- Phone: "+23277234567"
- Role: "supervisor"
- Status: "active"

Result: Nurse Sesay can handle facility protocols, outbreak response,
and program-level questions.
```

#### Scenario 3: Temporary Role Assignment
```
Admin can temporarily elevate a user's role by:
1. Adding them to special_contacts with elevated role
2. Setting status to "active"

To revoke:
1. Set status to "inactive" or delete the contact
2. User reverts to their default role from users table
```

## Database Schema

### special_contacts Table
```sql
CREATE TABLE special_contacts (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL CHECK (role IN ('support', 'health_worker', 'supervisor', 'admin')),
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### users Table
```sql
ALTER TABLE users 
ADD COLUMN role TEXT DEFAULT 'support' 
CHECK (role IN ('support', 'health_worker', 'supervisor', 'admin'));
```

## API Endpoints

The existing special contacts endpoints now fully support role management:

### GET /api/contacts
List all special contacts with their assigned roles

### POST /api/contacts
Create a new special contact with role assignment
```json
{
  "name": "Dr. Amara Kamara",
  "phone": "+23276123456",
  "email": "amara@example.com",
  "role": "health_worker"
}
```

### PUT /api/contacts/:id
Update a special contact's role
```json
{
  "role": "supervisor"
}
```

### DELETE /api/contacts/:id
Remove a special contact (user reverts to default role)

## Benefits

1. **Admin Control**: Admins can assign and revoke roles without database access
2. **Flexibility**: Temporary role assignments for training or coverage
3. **Audit Trail**: All role assignments tracked in special_contacts table
4. **No Migration Required**: Works with existing admin dashboard
5. **Backward Compatible**: Users without special contact entries use default roles

## Testing

### Test Role Assignment
1. Add a contact via admin dashboard with role "health_worker"
2. Send a WhatsApp message from that phone number
3. Verify the response uses health_worker-level guidance

### Test Role Priority
1. Create a user in users table with role "support"
2. Add same phone to special_contacts with role "admin"
3. Verify admin role takes priority

### Test Role Revocation
1. Set special contact status to "inactive"
2. Verify user reverts to users table role

## Notes

- Phone numbers must match exactly (including country code)
- Status must be "active" for special_contacts role to apply
- Role changes take effect immediately on next message
- Invalid roles default to "support" for safety
