# Users & Teams

Manage users and team members in your Fireflies workspace.

## Get Current User

Fetch the authenticated user's profile:

```typescript
const me = await client.users.me();

console.log(`Name: ${me.name}`);
console.log(`Email: ${me.email}`);
console.log(`Role: ${me.role}`);
console.log(`Plan: ${me.plan}`);
```

## List Team Members

Get all users in your team:

```typescript
const users = await client.users.list();

for (const user of users) {
  console.log(`${user.name} (${user.email}) - ${user.role}`);
}
```

## Get User by ID

Fetch a specific user:

```typescript
const user = await client.users.get('user-id');

console.log(`Name: ${user.name}`);
console.log(`Email: ${user.email}`);
```

## Set User Role

Change a user's role (admin only):

```typescript
try {
  await client.users.setRole('user-id', 'admin');
  console.log('User promoted to admin');
} catch (error) {
  console.error('Failed to set role:', error);
}
```

Roles: `'admin'` or `'user'`

## User Profile Fields

The user profile includes:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | User ID |
| `name` | `string` | Display name |
| `email` | `string` | Email address |
| `role` | `'admin' \| 'user'` | Team role |
| `plan` | `string` | Subscription plan |
| `integrations` | `string[]` | Connected integrations |
| `minutes_consumed` | `number` | Minutes used this period |
| `num_transcripts` | `number` | Total transcript count |
| `recent_meeting` | `string` | Most recent meeting ID |
| `is_admin` | `boolean` | Admin flag |

## Complete Example

```typescript
import { FirefliesClient } from 'fireflies-api';

const client = new FirefliesClient({
  apiKey: process.env.FIREFLIES_API_KEY!,
});

async function main() {
  // Get current user
  const me = await client.users.me();
  console.log(`Logged in as: ${me.name}`);
  console.log(`Minutes used: ${me.minutes_consumed}`);

  // List team if admin
  if (me.is_admin) {
    console.log('\nTeam Members:');
    const team = await client.users.list();

    for (const user of team) {
      const role = user.is_admin ? 'admin' : 'member';
      console.log(`  ${user.name} - ${role}`);
    }
  }
}

main().catch(console.error);
```

## Next Steps

- [Transcripts](transcripts.md) - Access team transcripts
- [Meetings](meetings.md) - Manage active meetings
- [Bites](bites.md) - Share clips with team members
