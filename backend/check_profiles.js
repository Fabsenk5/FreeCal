const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    try {
        const res = await pool.query('SELECT COUNT(*) FROM profiles');
        console.log("Profiles count:", res.rows[0].count);
        const res2 = await pool.query('SELECT id, email FROM profiles LIMIT 5');
        console.log("Sample profiles:", res2.rows);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
