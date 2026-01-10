# Marketing Module - Migration Instructions

## Important: Run Prisma Migration First

The TypeScript errors you see are because Prisma Client hasn't been regenerated with the new models yet. Follow these steps:

### 1. Generate Prisma Migration

```bash
cd "/Users/saqibnasir/Downloads/Medical CRM"
npx prisma migrate dev --name add_marketing_module
```

This will:
- Create a migration file with all the new models
- Apply the migration to your database
- Regenerate Prisma Client with the new models

### 2. Regenerate Prisma Client (if migration doesn't do it automatically)

```bash
npx prisma generate
```

### 3. Verify Everything Works

After running the migration, the TypeScript errors should be resolved. The Prisma Client will include:
- `prisma.brandProfile`
- `prisma.marketingTemplate`
- `prisma.marketingTemplateVersion`
- `prisma.marketingTemplateAsset`
- `prisma.marketingAuditLog`

### 4. Run Seed (Optional)

```bash
npx prisma db seed
```

This will create demo data including:
- Brand profile for your practice
- 2 email templates
- 3 SMS templates

### 5. Start Development Server

```bash
npm run dev
```

Navigate to `/marketing` to see the marketing dashboard.

## If Migration Fails

If you encounter any issues during migration:

1. **Check Database Connection**: Ensure your `DATABASE_URL` in `.env` is correct
2. **Check Existing Schema**: The migration should be compatible with your existing schema
3. **Manual Migration**: If needed, you can manually create the tables using the SQL in the migration file

## Models Added

The following models were added to your Prisma schema:

- `BrandProfile` - Brand settings and configuration
- `MarketingTemplate` - Email and SMS templates
- `MarketingTemplateVersion` - Version history for templates
- `MarketingTemplateAsset` - Uploaded assets (images/files)
- `MarketingAuditLog` - Audit trail for marketing actions

All models are tenant-scoped using `tenantId` (which maps to `practiceId`).

## Next Steps

After running the migration:

1. ✅ Prisma Client will be regenerated with all new models
2. ✅ TypeScript errors will be resolved
3. ✅ You can start using the Marketing Module APIs
4. ✅ UI pages will be able to fetch data from the database

## Troubleshooting

### Error: "Property 'brandProfile' does not exist"
- **Solution**: Run `npx prisma generate` to regenerate Prisma Client

### Error: "Table 'brand_profiles' does not exist"
- **Solution**: Run `npx prisma migrate dev` to apply migrations

### Error: "Migration failed"
- **Solution**: Check your database connection and ensure you have the necessary permissions