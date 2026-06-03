require("dotenv").config();
const pool = require("./db");

async function run() {
  const [topics] = await pool.query("SELECT topic_id, session_name, topic_name FROM topics ORDER BY created_at DESC");
  const seen = new Set();
  const toDelete = [];
  
  for (const t of topics) {
    const key = `${t.session_name}-${t.topic_name}`;
    if (seen.has(key)) {
      toDelete.push(t.topic_id);
    } else {
      seen.add(key);
    }
  }
  
  if (toDelete.length > 0) {
    console.log("Deleting duplicate topic IDs:", toDelete);
    await pool.query("DELETE FROM topics WHERE topic_id IN (?)", [toDelete]);
    console.log(`Deleted ${toDelete.length} duplicate topics.`);
  } else {
    console.log("No duplicates found.");
  }
  process.exit(0);
}

run();
