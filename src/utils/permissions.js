const { PermissionFlagsBits } = require('discord.js');
const { db } = require('../db/db');

/**
 * Returns true if the member has Manage Guild or Administrator permission (server mod/admin).
 */
function isMod(member) {
  return (
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

/**
 * Returns true if the user is banned from debates in this guild.
 */
function isDebateBanned(guildId, userId) {
  const row = db.prepare('SELECT 1 FROM bans WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
  return !!row;
}

/**
 * Returns the server config row, or null if not set up.
 */
function getServerConfig(guildId) {
  return db.prepare('SELECT * FROM servers WHERE guild_id = ?').get(guildId) || null;
}

/**
 * Checks that the server has been configured.
 * Returns the config object or null.
 */
function requireServerConfig(guildId) {
  return getServerConfig(guildId);
}

module.exports = { isMod, isDebateBanned, getServerConfig, requireServerConfig };
