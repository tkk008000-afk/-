const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { Client: SelfClient } = require('discord.js-selfbot-v13');

const BOT_TOKEN = process.env.TOKEN;
if (!BOT_TOKEN) {
  console.error('[ERROR] لم يتم تعيين متغير البيئة TOKEN (توكن البوت).');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
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
      .addComponents(
        new ButtonBuilder()
          .setCustomId('open_copy_modal')
          .setLabel('📋 نسخ السيرفر')
          .setStyle(ButtonStyle.Primary)
      );

    await message.channel.send({ embeds: [embed], components: [row] });
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== 'open_copy_modal') return;

  const modal = new ModalBuilder()
    .setCustomId('copy_modal_submit')
    .setTitle('بيانات النسخ');

  const tokenInput = new TextInputBuilder()
    .setCustomId('token')
    .setLabel('توكن حسابك الشخصي (Self-Bot)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('أدخل توكن حسابك الشخصي - يبدأ بـ NDU...')
    .setRequired(true);

  const sourceInput = new TextInputBuilder()
    .setCustomId('source')
    .setLabel('آيدي السيرفر المصدر')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('123456789012345678')
    .setRequired(true);

  const targetInput = new TextInputBuilder()
    .setCustomId('target')
    .setLabel('آيدي السيرفر الهدف')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('876543210987654321')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(tokenInput),
    new ActionRowBuilder().addComponents(sourceInput),
    new ActionRowBuilder().addComponents(targetInput)
  );

  await interaction.showModal(modal);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  if (interaction.customId !== 'copy_modal_submit') return;

  await interaction.deferReply({ ephemeral: true });

  const userToken = interaction.fields.getTextInputValue('token').trim();
  const sourceId = interaction.fields.getTextInputValue('source').trim();
  const targetId = interaction.fields.getTextInputValue('target').trim();

  if (!userToken) {
    await interaction.editReply({ content: '❌ يجب إدخال توكن صالح.' });
    return;
  }

  await interaction.editReply({ content: '⏳ جارٍ البدء في النسخ... سأبلغك عند الانتهاء.' });
  await runCopy(userToken, sourceId, targetId, interaction);
});

async function runCopy(token, sourceIdStr, targetIdStr, interaction) {
  const sourceId = BigInt(sourceIdStr);
  const targetId = BigInt(targetIdStr);

  // إنشاء عميل Self-Bot بدون تمرير توكن في المُنشئ
  const copyClient = new SelfClient();

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
      // نسخ الاسم والأيقونة
      await target.setName(source.name);
      if (source.iconURL()) {
        const iconData = await fetch(source.iconURL({ dynamic: true, format: 'png', size: 1024 }))
          .then(res => res.arrayBuffer());
        await target.setIcon(Buffer.from(iconData));
      }

      // نسخ الرتب
      const roleMap = new Map();
      for (const role of [...source.roles.cache.values()].reverse()) {
        if (role.id === source.roles.everyone.id) continue;
        const existing = target.roles.cache.find(r => r.name === role.name);
        if (existing) {
          roleMap.set(role.id, existing.id);
          continue;
        }
        const newRole = await target.roles.create({
          name: role.name,
          permissions: role.permissions,
          color: role.color,
          hoist: role.hoist,
          mentionable: role.mentionable
        });
        roleMap.set(role.id, newRole.id);
        await sleep(500);
      }

      // نسخ الفئات
      const categoryMap = new Map();
      for (const channel of source.channels.cache.values()) {
        if (channel.type === 'GUILD_CATEGORY') {
          const existingCat = target.channels.cache.find(
            c => c.type === 'GUILD_CATEGORY' && c.name === channel.name
          );
          if (existingCat) {
            categoryMap.set(channel.id, existingCat.id);
            continue;
          }
          const newCat = await target.channels.create(channel.name, { type: 'GUILD_CATEGORY' });
          categoryMap.set(channel.id, newCat.id);
          await sleep(500);
        }
      }

      // نسخ القنوات
      for (const channel of source.channels.cache.values()) {
        const parentId = channel.parentId ? categoryMap.get(channel.parentId) : null;
        const parent = parentId ? target.channels.cache.get(parentId) : null;

        if (channel.type === 'GUILD_TEXT') {
          const existing = target.channels.cache.find(
            c => c.type === 'GUILD_TEXT' && c.name === channel.name && c.parentId === (parent ? parent.id : null)
          );
          if (existing) continue;
          const newCh = await target.channels.create(channel.name, {
            type: 'GUILD_TEXT',
            parent: parent,
            topic: channel.topic,
            rateLimitPerUser: channel.rateLimitPerUser,
            nsfw: channel.nsfw
          });
          await sleep(500);
        }

        if (channel.type === 'GUILD_VOICE') {
          const existing = target.channels.cache.find(
            c => c.type === 'GUILD_VOICE' && c.name === channel.name && c.parentId === (parent ? parent.id : null)
          );
          if (existing) continue;
          const newVc = await target.channels.create(channel.name, {
            type: 'GUILD_VOICE',
            parent: parent,
            bitrate: channel.bitrate,
            userLimit: channel.userLimit
          });
          await sleep(500);
        }
      }

      await interaction.editReply({ content: '✅ **تم النسخ بنجاح!** (تم تخطي الموجود مسبقاً)' });
    } catch (err) {
      await interaction.editReply({ content: `❌ حدث خطأ أثناء النسخ: ${err.message}` });
    }

    copyClient.destroy();
    done = true;
  });

  // تسجيل الدخول بالتوكن مباشرةً
  copyClient.login(token).catch(async (e) => {
    let errorMsg = `❌ فشل تسجيل الدخول بالتوكن الشخصي: ${e.message}`;
    if (e.message.includes('invalid token')) {
      errorMsg += '\n\n⚠️ **تأكد من:**\n• التوكن يخص حساب **شخصي** وليس بوت (يبدأ بـ NDU... أو MTA...).\n• التوكن صحيح ولم ينتهِ صلاحيته.\n• لا توجد مسافات قبل أو بعد التوكن.';
    }
    await interaction.editReply({ content: errorMsg });
    done = true;
  });

  // مهلة 90 ثانية
  setTimeout(() => {
    if (!done) {
      copyClient.destroy();
      interaction.editReply({ content: '⏰ انتهت المهلة، حاول مرة أخرى.' }).catch(() => {});
    }
  }, 90000);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

client.login(BOT_TOKEN).catch(err => {
  console.error('[ERROR] فشل تسجيل الدخول بالتوكن:', err.message);
  process.exit(1);
});
