const { recoverSchedules } = require('../services/schedulerService');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`[Bot] Logged in as ${client.user.tag}`);
    console.log(`[Bot] Serving ${client.guilds.cache.size} guild(s)`);

    // Recover any in-progress vote timers that were running before a restart
    await recoverSchedules(client);

    client.user.setActivity('political debates | /debate create', { type: 3 }); // Watching
  },
};
