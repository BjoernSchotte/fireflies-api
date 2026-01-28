---
name: ff-users
description: User management for Fireflies.ai. Use when getting current user info, listing team members, or managing roles.
allowed-tools: Bash(npx -y fireflies-api users *)
---

# Fireflies Users

User management for Fireflies.ai.

## Commands

### Get Current User
```bash
npx -y fireflies-api users me
```

### List Users
```bash
npx -y fireflies-api users list [options]
```

**Options:**
- `-o, --output <format>` - Output format: json, jsonl, table, tsv, plain

### Get User by ID
```bash
npx -y fireflies-api users get <id>
```

### Set User Role
```bash
npx -y fireflies-api users set-role <id> --role <role>
```

**Roles:** admin, member, etc.

## Examples

```bash
# Get current user info
npx -y fireflies-api users me

# List all users in team
npx -y fireflies-api users list

# Get specific user
npx -y fireflies-api users get "user_123"

# Set user role
npx -y fireflies-api users set-role "user_123" --role admin
```

## Instructions

1. Verify API key is set:
   ```bash
   test -n "$FIREFLIES_API_KEY" && echo "Ready" || echo "ERROR: Set FIREFLIES_API_KEY"
   ```

2. For `me`, show current user details including team info.

3. For role changes, confirm with user before executing as this affects permissions.
