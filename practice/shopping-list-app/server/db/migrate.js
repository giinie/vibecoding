const fs = require('fs');
const path = require('path');
const { getDatabase, closeDatabase } = require('./connection');

function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  const db = getDatabase();

  try {
    db.exec(schema);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

if (require.main === module) {
  migrate();
  console.log('Migration completed successfully.');
}

module.exports = { migrate };
