const { db } = require('../db/db');
const { ROLES } = require('../utils/constants');
const { ensureUser } = require('./debateService');

/**
 * Get a user's reputation row, creating it if needed.
 */
function getUser(guildId, userId) {
  ensureUser(guildId, userId);
  return db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

/**
 * Get top N users by points for leaderboard.
 */
function getLeaderboard(guildId, limit = 10) {
  return db.prepare(`
    SELECT * FROM users WHERE guild_id = ? ORDER BY points DESC, wins DESC LIMIT ?
  `).all(guildId, limit);
}

/**
 * Evaluate and assign/remove debate roles for a user based on their stats.
 * Requires the guild member object and the server's role config.
 */
async function syncRolesForUser(member, rolesConfig) {
  const userData = getUser(member.guild.id, member.user.id);
  if (!userData) return;

  for (const [key, threshold] of Object.entries(ROLES)) {
    const configRole = rolesConfig?.find(r => r.role_name === threshold.label);
    if (!configRole) continue;

    let shouldHave = false;
    if (threshold.debates && userData.debates_participated >= threshold.debates) shouldHave = true;
    if (threshold.wins && userData.wins >= threshold.wins) shouldHave = true;
    if (threshold.topics && userData.topics_created >= threshold.topics) shouldHave = true;

    const role = member.guild.roles.cache.get(configRole.role_id);
    if (!role) continue;

    const hasRole = member.roles.cache.has(role.id);
    if (shouldHave && !hasRole) {
      await member.roles.add(role).catch(() => {});
    } else if (!shouldHave && hasRole) {
      await member.roles.remove(role).catch(() => {});
    }
  }
}

/**
 * Get all role config rows for a guild.
 */
function getRolesConfig(guildId) {
  return db.prepare('SELECT * FROM roles_config WHERE guild_id = ?').all(guildId);
}

/**
 * Upsert a role config entry.
 */
function setRoleConfig(guildId, roleName, roleId) {
  db.prepare(`
    INSERT INTO roles_config (guild_id, role_name, role_id) VALUES (?, ?, ?)
    ON CONFLICT(guild_id, role_name) DO UPDATE SET role_id = excluded.role_id
  `).run(guildId, roleName, roleId);
}

module.exports = {
  getUser,
  getLeaderboard,
  syncRolesForUser,
  getRolesConfig,
  setRoleConfig,
};
