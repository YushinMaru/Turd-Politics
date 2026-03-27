const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../db/db');
const { isMod, requireServerConfig } = require('../../utils/permissions');
const { errorEmbed, successEmbed, tournamentEmbed } = require('../../utils/embeds');
const { auditLog, ensureUser } = require('../../services/debateService');
const { POINTS } = require('../../utils/constants');

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
        .addStringOption(o => o.setName('name').setDescription('Tournament name').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('winner')
        .setDescription('(Mod) Record the winner of a match')
        .addStringOption(o => o.setName('name').setDescription('Tournament name').setRequired(true))
        .addUserOption(o => o.setName('winner').setDescription('Who won this match?').setRequired(true))
        .addUserOption(o => o.setName('loser').setDescription('Who lost this match?').setRequired(true))),

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

    if (sub === 'winner') {
      if (!isMod(interaction.member)) return interaction.reply({ embeds: [errorEmbed('Mods only.')], ephemeral: true });
      if (tournament.status !== 'active') return interaction.reply({ embeds: [errorEmbed('Tournament is not active.')], ephemeral: true });

      const winner = interaction.options.getUser('winner');
      const loser = interaction.options.getUser('loser');

      if (winner.id === loser.id) {
        return interaction.reply({ embeds: [errorEmbed('Winner and loser cannot be the same person.')], ephemeral: true });
      }

      // Eliminate the loser
      const loserRow = db.prepare('SELECT * FROM tournament_participants WHERE tournament_id = ? AND user_id = ? AND eliminated = 0')
        .get(tournament.id, loser.id);
      if (!loserRow) {
        return interaction.reply({ embeds: [errorEmbed(`<@${loser.id}> is not an active participant in this tournament.`)], ephemeral: true });
      }

      db.prepare('UPDATE tournament_participants SET eliminated = 1 WHERE tournament_id = ? AND user_id = ?')
        .run(tournament.id, loser.id);

      // Check remaining active players
      const remaining = db.prepare('SELECT * FROM tournament_participants WHERE tournament_id = ? AND eliminated = 0').all(tournament.id);

      if (remaining.length === 1) {
        // Tournament over — crown the champion
        db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run('complete', tournament.id);

        // Award tournament win points
        ensureUser(interaction.guildId, remaining[0].user_id);
        db.prepare('UPDATE users SET points = points + ?, wins = wins + 1 WHERE guild_id = ? AND user_id = ?')
          .run(POINTS.TOURNAMENT_WIN, interaction.guildId, remaining[0].user_id);

        auditLog(interaction.guildId, 'tournament_complete', interaction.user.id, remaining[0].user_id, tournament.name);

        return interaction.reply({
          embeds: [successEmbed(
            `🏆 Tournament Complete: ${tournament.name}`,
            `<@${remaining[0].user_id}> is the **Champion**! They've been awarded **${POINTS.TOURNAMENT_WIN} points**!\n\n<@${loser.id}> has been eliminated.`,
          )],
        });
      }

      // Generate next round if all current-round matches are done
      const bracket = JSON.parse(tournament.bracket_json || '{}');
      const roundKey = `round${tournament.current_round}`;
      const currentMatchups = bracket[roundKey] || [];

      // Update bracket result for this match
      const matchIdx = currentMatchups.findIndex(
        m => (m.player1 === winner.id && m.player2 === loser.id) ||
             (m.player1 === loser.id && m.player2 === winner.id),
      );
      if (matchIdx !== -1) {
        currentMatchups[matchIdx].result = winner.id;
      }
      bracket[roundKey] = currentMatchups;

      // Check if all matches in current round have results
      const roundComplete = remaining.length <= Math.ceil(currentMatchups.length / 2);
      let replyText = `<@${winner.id}> defeats <@${loser.id}>! <@${loser.id}> is eliminated.\n\n**${remaining.length} player(s) remain.**`;

      if (roundComplete && remaining.length > 1) {
        // Generate next round matchups from remaining players
        const nextRound = tournament.current_round + 1;
        const shuffled = remaining.sort(() => Math.random() - 0.5);
        const nextMatchups = [];
        for (let i = 0; i < shuffled.length - 1; i += 2) {
          nextMatchups.push({ player1: shuffled[i].user_id, player2: shuffled[i + 1].user_id });
        }
        if (shuffled.length % 2 !== 0) {
          nextMatchups.push({ player1: shuffled[shuffled.length - 1].user_id, player2: 'bye' });
        }
        bracket[`round${nextRound}`] = nextMatchups;

        db.prepare('UPDATE tournaments SET bracket_json = ?, current_round = ? WHERE id = ?')
          .run(JSON.stringify(bracket), nextRound, tournament.id);

        const matchLines = nextMatchups.map((m, i) =>
          m.player2 === 'bye'
            ? `Match ${i + 1}: <@${m.player1}> — BYE (auto-advance)`
            : `Match ${i + 1}: <@${m.player1}> vs <@${m.player2}>`,
        ).join('\n');

        replyText += `\n\n**Round ${nextRound} Matchups:**\n${matchLines}`;
      } else {
        db.prepare('UPDATE tournaments SET bracket_json = ? WHERE id = ?')
          .run(JSON.stringify(bracket), tournament.id);
      }

      auditLog(interaction.guildId, 'tournament_match_result', interaction.user.id, null, `${tournament.name}: ${winner.id} beat ${loser.id}`);
      return interaction.reply({ embeds: [successEmbed(`Tournament: ${tournament.name}`, replyText)] });
    }
  },
};
