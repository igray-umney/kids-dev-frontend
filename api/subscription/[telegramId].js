const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { telegramId } = req.query;

  if (!telegramId) {
    return res.status(400).json({ error: 'Missing telegramId parameter' });
  }

  try {
    const result = await pool.query(`
      SELECT s.*, u.child_name, u.child_age_months
      FROM subscriptions s 
      JOIN users u ON s.user_id = u.id 
      WHERE u.telegram_id = $1 
      AND s.status = 'active' 
      AND s.expires_at > CURRENT_TIMESTAMP
      ORDER BY s.expires_at DESC 
      LIMIT 1
    `, [telegramId]);

    const hasPremium = result.rows.length > 0;
    const subscription = hasPremium ? result.rows[0] : null;

    res.status(200).json({
      hasPremium,
      telegramId,
      subscription: subscription ? {
        plan: subscription.plan_type,
        expiresAt: subscription.expires_at,
        childName: subscription.child_name,
        childAgeMonths: subscription.child_age_months
      } : null
    });

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      hasPremium: false
    });
  }
}
