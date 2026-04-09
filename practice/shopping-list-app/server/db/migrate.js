const fs = require('fs');
const path = require('path');
const { getDatabase, closeDatabase } = require('./connection');

function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  const db = getDatabase();

  try {
    db.exec(schema);

    // Add purchased_at column to existing shopping_items tables
    const columns = db.pragma('table_info(shopping_items)');
    const hasPurchasedAt = columns.some(col => col.name === 'purchased_at');
    if (!hasPurchasedAt) {
      db.exec('ALTER TABLE shopping_items ADD COLUMN purchased_at TEXT');
      // Backfill: existing purchased items need purchased_at for recommendation queries
      db.exec(`UPDATE shopping_items SET purchased_at = created_at WHERE is_purchased = 1 AND purchased_at IS NULL`);
    }
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  migrate();
  closeDatabase();
  console.log('Migration completed successfully.');
}

module.exports = { migrate };
