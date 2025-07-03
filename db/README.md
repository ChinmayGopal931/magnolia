# Database Structure

This directory contains all database-related files for the Magnolia DEX Position Management service.

## Directory Structure

```
db/
├── README.md           # This file - database documentation
├── schema.sql          # Complete current database schema
├── migrations/         # Database migration files
│   └── 001_initial_schema.sql
├── seeds/              # Sample/test data files
│   └── sample_data.sql
└── scripts/            # Database utility scripts (future)
```

## Files Description

### `schema.sql`
Contains the complete current database schema. This file represents the final state of the database after all migrations have been applied. It's useful for:
- Quick reference to the current database structure
- Setting up fresh database instances
- Understanding table relationships

### `migrations/`
Contains numbered migration files that define incremental changes to the database schema:
- `001_initial_schema.sql` - Initial database setup with all tables and indexes

### `seeds/`
Contains sample data files for development and testing:
- `sample_data.sql` - Sample users, agents, positions, and alerts for testing

## Database Schema Overview

The database consists of the following main tables:

- **users** - User accounts with email and optional Telegram ID
- **agents** - Trading agents/wallets associated with users
- **positions** - Individual trading positions (long/short)
- **position_pairs** - Pairs of positions for delta-neutral strategies
- **alerts** - Notifications and alerts for users

## Usage

### Running Migrations
```bash
# Create database (if not exists)
npm run migrate:create-db

# Run migrations
npm run migrate
```

### Loading Sample Data
```bash
# Load sample data for testing
docker exec -i magnolia-postgres-1 psql -U postgres -d position_manager < db/seeds/sample_data.sql
```

### Database Connection
The database connection is configured in `src/config/database.ts` using PostgreSQL connection pooling.

## Migration Guidelines

When adding new migrations:
1. Create a new file with incremental numbering: `002_add_new_feature.sql`
2. Update the `schema.sql` file to reflect the new complete schema
3. Test migrations on a copy of production data before deployment
4. Always include rollback instructions in comments