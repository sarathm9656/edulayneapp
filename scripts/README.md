# Database Seeding Scripts

This directory contains database seeding scripts for the TeamLMS application.

## Unified Seed Script

### `seedDatabase.js`

This is the main unified seed script that combines all seeding operations into a single script. It handles:

1. **Lesson Types**: Seeds basic lesson types (video, pdf, quiz, live, assignment, text)
2. **Superadmin Role**: Creates or updates the superadmin role with a specific ID
3. **Superadmin User**: Creates a superadmin user with the appropriate role

### Usage

```bash
# Run the unified seed script
npm run seed

# Or run directly
node scripts/seedDatabase.js
```

### Environment Variables

The script uses the following environment variables (with defaults):

- `SUPERADMIN_EMAIL`: Email for superadmin (default: "superadmin@lms.com")
- `SUPERADMIN_PASSWORD`: Password for superadmin (default: "Admin@123")
- `SUPERADMIN_PHONE`: Phone number for superadmin (default: "1234567890")
- `MONGO_USER`: MongoDB username
- `MONGO_PASS`: MongoDB password
- `DB_NAME`: Database name

### Features

- **Idempotent**: Can be run multiple times safely
- **Dependency Order**: Seeds data in the correct order (lesson types → role → user)
- **Error Handling**: Comprehensive error handling with proper cleanup
- **Logging**: Clear console output with emojis for better readability
- **Database Connection**: Uses the centralized database connection utility

## Legacy Scripts

The following individual scripts are still available but deprecated in favor of the unified script:

- `createDefaultRole.js`: Creates only the superadmin role
- `../seed/superAdmin.seed.js`: Creates superadmin user and role
- `../seed/seedLessonTypes.js`: Seeds only lesson types

### Usage (Legacy)

```bash
# Individual scripts (deprecated)
npm run create-default-role
npm run seed:superadmin
npm run seed:lesson-types
```

## What Gets Seeded

### Lesson Types
- video
- pdf
- quiz
- live
- assignment
- text

### Superadmin Role
- ID: `682c0541089c54ce890db8b3`
- Name: "superadmin"
- Description: "Super administrator with full system access"

### Superadmin User
- Name: "Super Admin"
- Email: From environment or default "superadmin@lms.com"
- Password: From environment or default "Admin@123"
- Phone: From environment or default "1234567890"
- Role: Linked to the superadmin role

## Troubleshooting

1. **Connection Issues**: Ensure your `.env` file has the correct MongoDB credentials
2. **Permission Errors**: Make sure the MongoDB user has write permissions
3. **Duplicate Key Errors**: The script handles duplicates gracefully, but check if data already exists
4. **Model Import Errors**: Ensure all model files exist and have correct export statements 