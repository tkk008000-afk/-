const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { Client: SelfClient } = require('discord.js-selfbot-v13');

const BOT_TOKEN = process.env.TOKEN;
if (!BOT_TOKEN) {
  console.error('[ERROR] لم يتم تعيين متغير البيئة TOKEN (توكن البوت).');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.on('ready', () => {
  console.log(`[+] البوت دخل كـ ${client.user.tag}`);
  console.log('[+] جاهز، اكتب !copy في أي شات.');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.content.toLowerCase() === '!copy') {
    const embed = new EmbedBuilder()
      .setTitle('🔄 أداة نسخ السيرفرات')
      .setDescription('اضغط الزر أدناه لبدء عملية النسخ.\nسيُطلب منك إدخال توكن حسابك الشخصي، آيدي المصدر، وآيدي الهدف.')
      .setColor('#2b2d31')
      .setFooter({ text: 'البوت لا يخزن بياناتك' });
    const row = new ActionRowBuilder()
      .addComponents(new ButtonBuilder().setCustomId('open_copy_modal').setLabel('📋 نسخ السيرفر').setStyle(ButtonStyle.Primary));
    await message.channel.send({ embeds: [embed], components: [row] });
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton() && interaction.customId === 'open_copy_modal') {
    const modal = new ModalBuilder().setCustomId('copy_modal_submit').setTitle('بيانات النسخ');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('token').setLabel('توكن حسابك الشخصي (Self-Bot)').setStyle(TextInputStyle.Short).setPlaceholder('يبدأ بـ NDU... أو MTA...').setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('source').setLabel('آيدي السيرفر المصدر').setStyle(TextInputStyle.Short).setPlaceholder('123456789012345678').setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('target').setLabel('آيدي السيرفر الهدف').setStyle(TextInputStyle.Short).setPlaceholder('876543210987654321').setRequired(true)
      )
    );
    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'copy_modal_submit') {
    await interaction.deferReply({ ephemeral: true });
    const token = interaction.fields.getTextInputValue('token').trim();
    const sourceId = interaction.fields.getTextInputValue('source').trim();
    const targetId = interaction.fields.getTextInputValue('target').trim();

    if (!token) {
      await interaction.editReply({ content: '❌ يجب إدخال توكن صالح.' });
      return;
    }

    // تحقق أولي من صيغة التوكن (يجب أن يبدأ بـ NDU أو MTA)
    if (!token.startsWith('NDU') && !token.startsWith('MTA')) {
      await interaction.editReply({
        content: '❌ **التوكن غير صالح لتسجيل الدخول بحساب شخصي.**\n\n' +
                 'تأكد من:\n' +
                 '• التوكن يبدأ بـ `NDU...` أو `MTA...` (علامة أنه توكن مستخدم وليس بوت).\n' +
                 '• تم نسخه بالكامل (بدون مسافات أو أحرف إضافية).\n' +
                 '• هذا التوكن خاص بحسابك الشخصي وليس بتطبيق بوت.'
      });
      return;
    }

    const progressEmbed = new EmbedBuilder()
      .setTitle('⏳ جاري نسخ السيرفر...')
      .setColor('#f1c40f')
      .setDescription('**التقدم:** ░░░░░░░░░░ 0%\n\n**الحالة:** جارٍ التحضير...')
      .addFields({ name: '📌 التفاصيل', value: 'سيتم حذف الرتب والإيموجيات والملصقات في الهدف أولاً.', inline: false });

    await interaction.editReply({ embeds: [progressEmbed] });
    await runCopy(token, sourceId, targetId, interaction, progressEmbed);
  }
});

async function runCopy(token, sourceIdStr, targetIdStr, interaction, embed) {
  const sourceId = BigInt(sourceIdStr);
  const targetId = BigInt(targetIdStr);

  // إنشاء العميل مع التوكن في المُنشئ (لضمان توفر التوكن لجميع الطلبات)
  const copyClient = new SelfClient({ token: token });

  let done = false;

  copyClient.on('ready', async () => {
    console.log(`[+] جلسة النسخ دخلت كـ ${copyClient.user.tag}`);
    const source = copyClient.guilds.cache.get(sourceId.toString());
    const target = copyClient.guilds.cache.get(targetId.toString());

    if (!source || !target) {
      await interaction.editReply({ content: '❌ تأكد من الآيديات وصحة التوكن.' });
      copyClient.destroy();
      done = true;
      return;
    }

    try {
      // 1. حذف الرتب القديمة
      await updateProgress(interaction, embed, '🗑️ حذف الرتب القديمة...', 10);
      const everyone = target.roles.everyone;
      for (const role of target.roles.cache.filter(r => r.id !== everyone.id).values()) {
        try { await role.delete(); } catch (e) {}
        await sleep(200);
      }

      // 2. حذف الإيموجيات
      await updateProgress(interaction, embed, '🗑️ حذف الإيموجيات القديمة...', 20);
      for (const emoji of target.emojis.cache.values()) {
        try { await emoji.delete(); } catch (e) {}
        await sleep(200);
      }

      // 3. حذف الملصقات
      await updateProgress(interaction, embed, '🗑️ حذف الملصقات القديمة...', 30);
      for (const sticker of target.stickers.cache.values()) {
        try { await sticker.delete(); } catch (e) {}
        await sleep(200);
      }

      // 4. نسخ الرتب الجديدة
      await updateProgress(interaction, embed, '📋 نسخ الرتب الجديدة...', 40);
      const roleMap = new Map();
      for (const role of [...source.roles.cache.values()].reverse()) {
        if (role.id === source.roles.everyone.id) continue;
        try {
          const newRole = await target.roles.create({
            name: role.name,
            permissions: role.permissions,
            color: role.color,
            hoist: role.hoist,
            mentionable: role.mentionable
          });
          roleMap.set(role.id, newRole.id);
        } catch (e) { console.log(`فشل نسخ رتبة ${role.name}: ${e.message}`); }
        await sleep(300);
      }

      // 5. نسخ الإيموجيات
      await updateProgress(interaction, embed, '😀 نسخ الإيموجيات...', 60);
      for (const emoji of source.emojis.cache.values()) {
        try {
          const ext = emoji.animated ? 'gif' : 'png';
          const url = `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=128`;
          const buffer = await fetch(url).then(r => r.arrayBuffer());
          await target.emojis.create({ attachment: Buffer.from(buffer), name: emoji.name });
        } catch (e) { console.log(`فشل نسخ إيموجي ${emoji.name}: ${e.message}`); }
        await sleep(300);
      }

      // 6. نسخ الملصقات
      await updateProgress(interaction, embed, '📎 نسخ الملصقات...', 70);
      for (const sticker of source.stickers.cache.values()) {
        try {
          const buffer = await fetch(sticker.url).then(r => r.arrayBuffer());
          await target.stickers.create({
            name: sticker.name,
            description: sticker.description || '',
            tags: sticker.tags || '',
            file: Buffer.from(buffer)
          });
        } catch (e) { console.log(`فشل نسخ ملصق ${sticker.name}: ${e.message}`); }
        await sleep(300);
      }

      // 7. نسخ الفئات
      await updateProgress(interaction, embed, '📁 نسخ الفئات...', 80);
      const categoryMap = new Map();
      for (const channel of source.channels.cache.values()) {
        if (channel.type === 'GUILD_CATEGORY') {
          const existing = target.channels.cache.find(c => c.type === 'GUILD_CATEGORY' && c.name === channel.name);
          if (existing) {
            categoryMap.set(channel.id, existing.id);
            continue;
          }
          const newCat = await target.channels.create({ name: channel.name, type: 'GUILD_CATEGORY' });
          categoryMap.set(channel.id, newCat.id);
          await sleep(300);
        }
      }

      // 8. نسخ القنوات
      await updateProgress(interaction, embed, '📝 نسخ القنوات النصية والصوتية...', 90);
      for (const channel of source.channels.cache.values()) {
        const parentId = channel.parentId ? categoryMap.get(channel.parentId) : null;
        const parent = parentId ? target.channels.cache.get(parentId) : null;

        if (channel.type === 'GUILD_TEXT') {
          const existing = target.channels.cache.find(
            c => c.type === 'GUILD_TEXT' && c.name === channel.name && c.parentId === (parent ? parent.id : null)
          );
          if (existing) continue;
          const newCh = await target.channels.create({
            name: channel.name,
            type: 'GUILD_TEXT',
            parent: parent,
            topic: channel.topic,
            rateLimitPerUser: channel.rateLimitPerUser,
            nsfw: channel.nsfw
          });
          for (const [overwriteId, overwrite] of channel.permissionOverwrites.cache) {
            const newRoleId = roleMap.get(overwriteId);
            if (newRoleId) {
              const targetRole = target.roles.cache.get(newRoleId);
              if (targetRole) await newCh.permissionOverwrites.create(targetRole, overwrite);
            }
          }
          await sleep(300);
        }

        if (channel.type === 'GUILD_VOICE') {
          const existing = target.channels.cache.find(
            c => c.type === 'GUILD_VOICE' && c.name === channel.name && c.parentId === (parent ? parent.id : null)
          );
          if (existing) continue;
          const newVc = await target.channels.create({
            name: channel.name,
            type: 'GUILD_VOICE',
            parent: parent,
            bitrate: channel.bitrate,
            userLimit: channel.userLimit
          });
          for (const [overwriteId, overwrite] of channel.permissionOverwrites.cache) {
            const newRoleId = roleMap.get(overwriteId);
            if (newRoleId) {
              const targetRole = target.roles.cache.get(newRoleId);
              if (targetRole) await newVc.permissionOverwrites.create(targetRole, overwrite);
            }
          }
          await sleep(300);
        }
      }

      // 9. نسخ اسم وأيقونة
      await updateProgress(interaction, embed, '🖼️ نسخ اسم وأيقونة السيرفر...', 95);
      await target.setName(source.name);
      if (source.iconURL()) {
        const iconData = await fetch(source.iconURL({ dynamic: true, format: 'png', size: 1024 }))
          .then(res => res.arrayBuffer());
        await target.setIcon(Buffer.from(iconData));
      }

      await updateProgress(interaction, embed, '✅ **اكتمل النسخ بنجاح!** (تم حذف القديم ونسخ الجديد مع الصلاحيات)', 100);
      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      await updateProgress(interaction, embed, `❌ حدث خطأ: ${err.message}`, 100);
    }

    copyClient.destroy();
    done = true;
  });

  // محاولة تسجيل الدخول باستخدام login(token) (كإجراء إضافي للتوافق)
  copyClient.login(token).catch(async (e) => {
    let errorMsg = `❌ فشل تسجيل الدخول بالتوكن الشخصي: ${e.message}`;
    if (e.message.includes('invalid token')) {
      errorMsg += '\n\n⚠️ **تأكد من:**\n• التوكن يخص حساب **شخصي** وليس بوت (يبدأ بـ NDU... أو MTA...).\n• التوكن صحيح ولم ينتهِ صلاحيته.\n• تم نسخه بدون مسافات أو أحرف إضافية.';
    }
    await interaction.editReply({ content: errorMsg });
    done = true;
  });

  setTimeout(() => {
    if (!done) {
      copyClient.destroy();
      interaction.editReply({ content: '⏰ انتهت المهلة، حاول مرة أخرى.' }).catch(() => {});
    }
  }, 120000);
}

async function updateProgress(interaction, embed, status, percent) {
  const filled = Math.floor(percent / 10);
  const empty = 10 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  embed.setDescription(`**التقدم:** ${bar} ${percent}%\n\n**الحالة:** ${status}`);
  embed.setColor(percent >= 100 ? '#2ecc71' : '#f1c40f');
  embed.spliceFields(0, 1, { name: '📌 التفاصيل', value: status, inline: false });
  await interaction.editReply({ embeds: [embed] });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

client.login(BOT_TOKEN).catch(err => {
  console.error('[ERROR] فشل تسجيل الدخول بالتوكن:', err.message);
  process.exit(1);
});
