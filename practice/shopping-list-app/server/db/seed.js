const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { getDatabase, closeDatabase } = require('./connection');
const { migrate } = require('./migrate');

const DEFAULT_PASSWORD = 'password123';
const passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

const SAMPLE_USERS = [
  { id: uuidv4(), name: 'Alice', email: 'alice@example.com' },
  { id: uuidv4(), name: 'Bob', email: 'bob@example.com' },
  { id: uuidv4(), name: 'Charlie', email: 'charlie@example.com' },
];

function seed() {
  migrate();

  const db = getDatabase();

  try {
    const insertUser = db.prepare(
      'INSERT OR IGNORE INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)'
    );

    const insertNotification = db.prepare(
      'INSERT OR IGNORE INTO notifications (id, user_id, type, title, message, is_read, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    const seedTransaction = db.transaction(() => {
      for (const user of SAMPLE_USERS) {
        insertUser.run(user.id, user.name, user.email, passwordHash);
      }

      const notifications = [
        {
          userId: SAMPLE_USERS[0].id,
          type: 'item_added',
          title: 'New item added',
          message: 'Milk was added to your shopping list.',
          isRead: 0,
          metadata: JSON.stringify({ itemName: 'Milk', listId: 'list-1' }),
        },
        {
          userId: SAMPLE_USERS[0].id,
          type: 'item_purchased',
          title: 'Item purchased',
          message: 'Bread has been marked as purchased.',
          isRead: 1,
          metadata: JSON.stringify({ itemName: 'Bread', listId: 'list-1' }),
        },
        {
          userId: SAMPLE_USERS[1].id,
          type: 'list_shared',
          title: 'List shared with you',
          message: 'Alice shared "Weekly Groceries" with you.',
          isRead: 0,
          metadata: JSON.stringify({ sharedBy: SAMPLE_USERS[0].id, listName: 'Weekly Groceries' }),
        },
        {
          userId: SAMPLE_USERS[2].id,
          type: 'reminder',
          title: 'Shopping reminder',
          message: 'Don\'t forget to buy eggs today!',
          isRead: 0,
          metadata: JSON.stringify({ itemName: 'Eggs', dueDate: '2026-02-10' }),
        },
      ];

      for (const n of notifications) {
        insertNotification.run(
          uuidv4(),
          n.userId,
          n.type,
          n.title,
          n.message,
          n.isRead,
          n.metadata
        );
      }
    });

    seedTransaction();
    console.log(`Seeded ${SAMPLE_USERS.length} users and 4 notifications.`);
    if (process.env.NODE_ENV === 'development') {
      console.log(`Default password for all users: ${DEFAULT_PASSWORD}`);
    }
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
