const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const dbService = require('../../../services/dbService');
const backupService = require('../../../services/backupService');
const restoreQueue = require('../../../services/restoreQueue');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Manage server snapshots and structural configuration backups')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a secure configuration backup of this server')
        .addStringOption(option => 
          option.setName('name')
            .setDescription('Name of this backup snapshot')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all saved snapshots for this server')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('restore')
        .setDescription('Restore server layout structure from a backup snapshot')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('The Backup ID to restore (e.g. RAGE_A9B8C7D6)')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a saved backup snapshot')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('The Backup ID to delete')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: true });
    
    const { guild, user } = interaction;

    if (subcommand === 'create') {
      const name = interaction.options.getString('name') || `Backup - ${new Date().toLocaleDateString()}`;
      try {
        const captured = await backupService.captureGuild(guild);
        const backupId = 'RAGE_' + Math.random().toString(36).substring(2, 10).toUpperCase();

        const backupData = {
          backupId,
          ownerId: guild.ownerId,
          creatorId: user.id,
          creatorName: user.username,
          backupName: name,
          name: name,
          backupData: captured
        };

        const newBackup = await dbService.addBackup(guild.id, backupData);

        // Security Log
        await dbService.addSecurityLog(guild.id, {
          action: 'BACKUP_CREATE',
          executorId: user.id,
          executorName: user.username,
          severity: 'info',
          details: `Created server configuration backup: ${name} (${backupId})`
        });

        const embed = new EmbedBuilder()
          .setColor('#ff003c')
          .setTitle('🛡️ Server Backup Created')
          .setDescription(`Successfully captured server settings snapshot. You can manage and restore this using the Dashboard website.`)
          .addFields(
            { name: 'Backup Name', value: name, inline: true },
            { name: 'Backup ID', value: `\`${backupId}\``, inline: true },
            { name: 'Channels Saved', value: (captured.channels.length + captured.categories.length).toString(), inline: true },
            { name: 'Roles Saved', value: captured.roles.length.toString(), inline: true }
          )
          .setFooter({ text: 'RAGE OPTIMIZER Auto-Backup Module' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('[Backup Command Create Error]', err);
        await interaction.editReply({ content: '❌ Failed to generate configuration backup. Please check console logs.' });
      }
    }

    else if (subcommand === 'list') {
      try {
        const backups = await dbService.getBackups(guild.id);
        if (backups.length === 0) {
          return await interaction.editReply({ content: 'ℹ️ No configuration backups found for this guild. Create one with `/backup create`.' });
        }

        const embed = new EmbedBuilder()
          .setColor('#ff003c')
          .setTitle(`🛡️ Server Backups (${backups.length})`)
          .setDescription('Here is a list of your saved server layout configurations. Restores can be initiated via `/backup restore <id>` or the web dashboard.')
          .setTimestamp();

        // List top 10 backups
        const listSlice = backups.slice(0, 10);
        listSlice.forEach((b, index) => {
          const channelsCount = b.backupData ? (b.backupData.channels?.length + b.backupData.categories?.length || 0) : (b.channels?.length || 0);
          const rolesCount = b.backupData ? (b.backupData.roles?.length || 0) : (b.roles?.length || 0);
          
          embed.addFields({
            name: `${index + 1}. ${b.backupName || b.name}`,
            value: `ID: \`${b.backupId}\` • Roles: \`${rolesCount}\` • Channels: \`${channelsCount}\` • Created: <t:${Math.floor(new Date(b.createdAt).getTime() / 1000)}:R>`
          });
        });

        if (backups.length > 10) {
          embed.setFooter({ text: `Showing 10 of ${backups.length} backups. View all in the Admin Panel.` });
        } else {
          embed.setFooter({ text: 'RAGE OPTIMIZER Backup System' });
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('[Backup Command List Error]', err);
        await interaction.editReply({ content: '❌ Failed to retrieve backups list.' });
      }
    }

    else if (subcommand === 'restore') {
      const backupId = interaction.options.getString('id').toUpperCase();

      try {
        // Double-check permissions: must be owner or administrator
        const isOwner = guild.ownerId === user.id;
        const member = await guild.members.fetch(user.id);
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isOwner && !isAdmin) {
          return await interaction.editReply({ content: '❌ Security Access Denied: Only the server Owner or Administrators can perform restorations.' });
        }

        const backup = await dbService.getBackupById(guild.id, backupId);
        if (!backup) {
          return await interaction.editReply({ content: `❌ Backup snapshot with ID \`${backupId}\` not found for this server.` });
        }

        if (restoreQueue.isActive(guild.id)) {
          return await interaction.editReply({ content: '❌ A restoration is already running for this server.' });
        }

        const remainingCooldown = restoreQueue.getCooldown(guild.id);
        if (remainingCooldown > 0) {
          return await interaction.editReply({ content: `❌ Cooldown Active: Please wait ${Math.ceil(remainingCooldown / 60000)} minutes to prevent API spam.` });
        }

        // Trigger queue restore
        await restoreQueue.startRestore(guild, backup.backupData || backup, user);

        const embed = new EmbedBuilder()
          .setColor('#ff003c')
          .setTitle('🛡️ Restoration Initiated')
          .setDescription(`Restoration queue has successfully started. The bot will now recreate roles, categories, and channels.`)
          .addFields(
            { name: 'Backup Name', value: backup.backupName || backup.name, inline: true },
            { name: 'Target Server', value: guild.name, inline: true },
            { name: 'Action Executor', value: `${user}`, inline: true }
          )
          .setFooter({ text: 'Check real-time progress in the Web Dashboard!' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('[Backup Command Restore Error]', err);
        await interaction.editReply({ content: `❌ Failed to execute restore: ${err.message}` });
      }
    }

    else if (subcommand === 'delete') {
      const backupId = interaction.options.getString('id').toUpperCase();

      try {
        const backup = await dbService.getBackupById(guild.id, backupId);
        if (!backup) {
          return await interaction.editReply({ content: `❌ Backup snapshot with ID \`${backupId}\` was not found.` });
        }

        await dbService.deleteBackup(guild.id, backupId);

        // Security Log
        await dbService.addSecurityLog(guild.id, {
          action: 'BACKUP_DELETE',
          executorId: user.id,
          executorName: user.username,
          severity: 'info',
          details: `Deleted backup snapshot: ${backup.backupName || backup.name} (${backupId})`
        });

        await interaction.editReply({ content: `✅ Successfully deleted backup snapshot \`${backupId}\` (${backup.backupName || backup.name}).` });
      } catch (err) {
        console.error('[Backup Command Delete Error]', err);
        await interaction.editReply({ content: '❌ Failed to delete backup snapshot.' });
      }
    }
  }
};
