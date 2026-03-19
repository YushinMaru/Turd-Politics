const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../db/db');
const { isMod, requireServerConfig } = require('../../utils/permissions');
const { errorEmbed, successEmbed, tournamentEmbed } = require('../../utils/embeds');
const { auditLog } = require('../../services/debateService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tournament')
    .setDescription('Debate tournament commands')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('(Mod) Create a new debate tournament')
        .addStringOption(o => o.setName('name').setDescription('Tournament name').setRequired(true).setMaxLength(50)))
    .addSubcommand(sub =>
      sub.setName('join')
        .setDescription('Sign up for an upcoming tournament')
        .addStringOption(o => o.setName('name').setDescription('Tournament name').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('(Mod) Lock signups and generate round 1 matchups')
        .addStringOption(o => o.setName('name').setDescription('Tournament name').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('bracket')
        .setDescription('Show the current tournament bracket')
        .addStringOption(o => o.setName('name').setDescription('Tournament name').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const name = interaction.options.getString('name');
    const config = requireServerConfig(interaction.guildId);

    if (!config) return interaction.reply({ embeds: [errorEmbed('Server not configured.')], ephemeral: true });

    if (sub === 'create') {
      if (!isMod(interaction.member)) {
        return interaction.reply({ embeds: [errorEmbed('Mods only.')], ephemeral: true });
      }

      try {
        db.prepare('INSERT INTO tournaments (guild_id, name) VALUES (?, ?)').run(interaction.guildId, name);
      } catch {
        return interaction.reply({ embeds: [errorEmbed(`A tournament named "${name}" already exists.`)], ephemeral: true });
      }

      auditLog(interaction.guildId, 'tournament_created', interaction.user.id, null, name);
      return interaction.reply({ embeds: [successEmbed('Tournament Created!', `**${name}** is now open for signups! Use \`/tournament join ${name}\` to enter.`)] });
    }

    const tournament = db.prepare('SELECT * FROM tournaments WHERE guild_id = ? AND name = ?').get(interaction.guildId, name);
    if (!tournament) return interaction.reply({ embeds: [errorEmbed(`Tournament "${name}" not found.`)], ephemeral: true });

    if (sub === 'join') {
      if (tournament.status !== 'signup') {
        return interaction.reply({ embeds: [errorEmbed(`"${name}" is no longer accepting signups.`)], ephemeral: true });
      }
      try {
        db.prepare('INSERT INTO tournament_participants (tournament_id, user_id) VALUES (?, ?)').run(tournament.id, interaction.user.id);
      } catch {
        return interaction.reply({ embeds: [errorEmbed('You are already signed up for this tournament.')], ephemeral: true });
      }
      return interaction.reply({ embeds: [successEmbed('Signed Up!', `You've entered **${name}**! Good luck!`)] });
    }

    if (sub === 'start') {
      if (!isMod(interaction.member)) return interaction.reply({ embeds: [errorEmbed('Mods only.')], ephemeral: true });
      if (tournament.status !== 'signup') return interaction.reply({ embeds: [errorEmbed('Tournament has already started.')], ephemeral: true });

      const participants = db.prepare('SELECT * FROM tournament_participants WHERE tournament_id = ?').all(tournament.id);
      if (participants.length < 2) return interaction.reply({ embeds: [errorEmbed('Need at least 2 participants to start a tournament.')], ephemeral: true });

      // Shuffle and generate round 1 matchups
      const shuffled = participants.sort(() => Math.random() - 0.5);
      const matchups = [];
      for (let i = 0; i < shuffled.length - 1; i += 2) {
        matchups.push({ player1: shuffled[i].user_id, player2: shuffled[i + 1].user_id });
      }
      if (shuffled.length % 2 !== 0) {
        matchups.push({ player1: shuffled[shuffled.length - 1].user_id, player2: 'bye' });
      }

      const bracket = { round1: matchups };
      db.prepare('UPDATE tournaments SET status = ?, bracket_json = ?, current_round = 1 WHERE id = ?')
        .run('active', JSON.stringify(bracket), tournament.id);

      const matchupLines = matchups.map((m, i) =>
        m.player2 === 'bye' ? `Match ${i + 1}: <@${m.player1}> — BYE (auto-advance)` : `Match ${i + 1}: <@${m.player1}> vs <@${m.player2}>`
      ).join('\n');

      auditLog(interaction.guildId, 'tournament_started', interaction.user.id, null, name);
      return interaction.reply({ embeds: [successEmbed(`Tournament "${name}" — Round 1`, matchupLines)] });
    }

    if (sub === 'bracket') {
      const participants = db.prepare('SELECT * FROM tournament_participants WHERE tournament_id = ?').all(tournament.id);
      return interaction.reply({ embeds: [tournamentEmbed(tournament, participants)] });
    }
  },
};
