const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const dbService = require('../../../services/dbService');
const restoreQueue = require('../../../services/restoreQueue');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('template')
    .setDescription('Create, share, and apply server layout templates')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Convert a server backup snapshot into a reusable layout template')
        .addStringOption(option =>
          option.setName('backup_id')
            .setDescription('The source backup ID (e.g. RAGE_XXXXXXXX)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('template_id')
            .setDescription('Unique identifier slug (e.g. rage-scrim-v1)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Name of this template layout')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Short description of what is included in this layout')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('category')
            .setDescription('Category of the layout template')
            .setRequired(false)
            .addChoices(
              { name: 'Esports & Gaming', value: 'Esports' },
              { name: 'Marketplace', value: 'Marketplace' },
              { name: 'Community Hub', value: 'Community' },
              { name: 'Development', value: 'Development' },
              { name: 'General Support', value: 'General' }
            )
        )
        .addBooleanOption(option =>
          option.setName('public')
            .setDescription('Publish this template to the public Marketplace')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('load')
        .setDescription('Apply a layout template directly to this server (recreates layout)')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('The Template ID slug to load (e.g. rage-scrim-v1)')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('search')
        .setDescription('Search for template layouts in the RAGE Marketplace')
        .addStringOption(option =>
          option.setName('query')
            .setDescription('Keywords to search name or description')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('category')
            .setDescription('Filter by marketplace category')
            .setRequired(false)
            .addChoices(
              { name: 'Esports & Gaming', value: 'Esports' },
              { name: 'Marketplace', value: 'Marketplace' },
              { name: 'Community Hub', value: 'Community' },
              { name: 'Development', value: 'Development' },
              { name: 'General Support', value: 'General' }
            )
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: true });
    
    const { guild, user } = interaction;

    if (subcommand === 'create') {
      const backupId = interaction.options.getString('backup_id').toUpperCase();
      const templateId = interaction.options.getString('template_id').toLowerCase();
      const name = interaction.options.getString('name');
      const description = interaction.options.getString('description') || '';
      const category = interaction.options.getString('category') || 'General';
      const isPublic = interaction.options.getBoolean('public') ?? false;

      // Validate ID formatting
      const slugRegex = /^[a-z0-9-_]+$/;
      if (!slugRegex.test(templateId)) {
        return await interaction.editReply({ content: '❌ Invalid Template ID: Slug can only contain lowercase letters, numbers, dashes (-), and underscores (_).' });
      }

      try {
        // Check if ID is taken
        const existing = await dbService.getTemplateById(templateId);
        if (existing) {
          return await interaction.editReply({ content: `❌ Template ID \`${templateId}\` is already taken. Please choose a unique identifier.` });
        }

        const backup = await dbService.getBackupById(guild.id, backupId);
        if (!backup) {
          return await interaction.editReply({ content: `❌ Source backup snapshot \`${backupId}\` not found for this server.` });
        }

        const template = await dbService.addTemplate({
          templateId,
          name,
          description,
          creatorId: user.id,
          creatorName: user.username,
          isPublic,
          category,
          backupData: backup.backupData || {
            channels: backup.channels || [],
            roles: backup.roles || [],
            categories: backup.categories || [],
            emojis: backup.emojis || [],
            serverSettings: backup.serverSettings || {}
          }
        });

        // Security Log
        await dbService.addSecurityLog(guild.id, {
          action: 'TEMPLATE_CREATE',
          executorId: user.id,
          executorName: user.username,
          severity: 'info',
          details: `Saved backup ${backupId} as template: ${name} (${templateId})`
        });

        const embed = new EmbedBuilder()
          .setColor('#ff003c')
          .setTitle('✨ Template Created Successfully')
          .setDescription(`Your layout configuration is saved. It is now reusable across any guild.`)
          .addFields(
            { name: 'Template Name', value: name, inline: true },
            { name: 'Template ID', value: `\`${templateId}\``, inline: true },
            { name: 'Visibility', value: isPublic ? 'Public Marketplace' : 'Private', inline: true },
            { name: 'Category', value: category, inline: true }
          )
          .setFooter({ text: 'RAGE OPTIMIZER Templates Engine' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

      } catch (err) {
        console.error('[Template Command Create Error]', err);
        await interaction.editReply({ content: `❌ Failed to create template: ${err.message}` });
      }
    }

    else if (subcommand === 'load') {
      const templateId = interaction.options.getString('id').toLowerCase();

      try {
        const isOwner = guild.ownerId === user.id;
        const member = await guild.members.fetch(user.id);
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isOwner && !isAdmin) {
          return await interaction.editReply({ content: '❌ Security Access Denied: Only the server Owner or Administrators can apply templates.' });
        }

        const template = await dbService.getTemplateById(templateId);
        if (!template) {
          return await interaction.editReply({ content: `❌ Template layout with ID \`${templateId}\` not found in RAGE Marketplace.` });
        }

        if (restoreQueue.isActive(guild.id)) {
          return await interaction.editReply({ content: '❌ A restoration is already in progress for this server.' });
        }

        const remainingCooldown = restoreQueue.getCooldown(guild.id);
        if (remainingCooldown > 0) {
          return await interaction.editReply({ content: `❌ Cooldown Active: Please wait ${Math.ceil(remainingCooldown / 60000)} minutes to apply layouts.` });
        }

        // Trigger restore queue
        await restoreQueue.startRestore(guild, template.backupData, user);

        // Update installs
        await dbService.updateTemplate(templateId, {
          installCount: (template.installCount || 0) + 1,
          downloadCount: (template.downloadCount || 0) + 1
        });

        const embed = new EmbedBuilder()
          .setColor('#ff003c')
          .setTitle('✨ Applying Server Layout Template')
          .setDescription(`The structural layout template is being queued and applied. Old channels and configurable roles are being deleted.`)
          .addFields(
            { name: 'Template Name', value: template.name, inline: true },
            { name: 'Template ID', value: `\`${templateId}\``, inline: true },
            { name: 'Executor', value: `${user}`, inline: true }
          )
          .setFooter({ text: 'Monitor progress live on the Web Dashboard!' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

      } catch (err) {
        console.error('[Template Command Load Error]', err);
        await interaction.editReply({ content: `❌ Failed to apply template: ${err.message}` });
      }
    }

    else if (subcommand === 'search') {
      const search = interaction.options.getString('query') || '';
      const category = interaction.options.getString('category') || '';

      try {
        const templates = await dbService.getTemplates({
          isPublic: true,
          search,
          category
        });

        if (templates.length === 0) {
          return await interaction.editReply({ content: 'ℹ️ No matching templates found in the RAGE Marketplace.' });
        }

        const embed = new EmbedBuilder()
          .setColor('#ff003c')
          .setTitle('🛒 RAGE Template Marketplace')
          .setDescription(`Found ${templates.length} layout templates matching search filters. Apply using \`/template load <id>\`.`)
          .setTimestamp();

        const listSlice = templates.slice(0, 10);
        listSlice.forEach((t, idx) => {
          embed.addFields({
            name: `${idx + 1}. ${t.name} (Category: ${t.category})`,
            value: `ID: \`${t.templateId}\` • Installs: \`${t.installCount || 0}\` • Creator: \`${t.creatorName}\`\n*${t.description || 'No description provided.'}*`
          });
        });

        if (templates.length > 10) {
          embed.setFooter({ text: `Showing 10 of ${templates.length} layouts. View complete list on Dashboard Marketplace.` });
        } else {
          embed.setFooter({ text: 'RAGE OPTIMIZER Template System' });
        }

        await interaction.editReply({ embeds: [embed] });

      } catch (err) {
        console.error('[Template Command Search Error]', err);
        await interaction.editReply({ content: '❌ Failed to search marketplace.' });
      }
    }
  }
};
