const { Client, Intents, MessageEmbed, MessageActionRow, MessageButton, Modal, TextInputComponent } = require('discord.js');
const { Client: SelfClient } = require('discord.js-selfbot-v13');

const BOT_TOKEN = process.env.TOKEN;
if (!BOT_TOKEN) {
  console.error('[ERROR] لم يتم تعيين متغير البيئة TOKEN (توكن البوت).');
  process.exit(1);
}

// العميل الرئيسي (بوت عادي)
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.MESSAGE_CONTENT // لقراءة محتوى الرسائل
  ]
});

client.on('ready', () => {
  console.log(`[+] البوت دخل كـ ${client.user.tag}`);
  console.log('[+] جاهز، اكتب !copy في أي شات.');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.content.toLowerCase() === '!copy') {
    const embed = new MessageEmbed()
      .setTitle('🔄 أداة نسخ السيرفرات')
      .setDescription('اضغط الزر أدناه لبدء عملية النسخ.\nسيُطلب منك إدخال توكن حسابك الشخصي، آيدي المصدر، وآيدي الهدف.')
      .setColor('#2b2d31')
      .setFooter({ text: 'البوت لا يخزن بياناتك' });

    const row = new MessageActionRow()
      .addComponents(
        new MessageButton()
          .setCustomId('open_copy_modal')
          .setLabel('📋 نسخ السيرفر')
          .setStyle('PRIMARY')
      );

    await message.channel.send({ embeds: [embed], components: [row] });
  }
});

// التعامل مع الأزرار
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== 'open_copy_modal') return;

  const modal = new Modal()
    .setCustomId('copy_modal_submit')
    .setTitle('بيانات النسخ');

  const tokenInput = new TextInputComponent()
    .setCustomId('token')
    .setLabel('توكن حسابك الشخصي (Self-Bot)')
    .setStyle('SHORT')
    .setPlaceholder('أدخل توكن حسابك')
    .setRequired(true);

  const sourceInput = new TextInputComponent()
    .setCustomId('source')
    .setLabel('آيدي السيرفر المصدر')
    .setStyle('SHORT')
    .setPlaceholder('123456789012345678')
    .setRequired(true);

  const targetInput = new TextInputComponent()
    .setCustomId('target')
    .setLabel('آيدي السيرفر الهدف')
    .setStyle('SHORT')
    .setPlaceholder('876543210987654321')
    .setRequired(true);

  modal.addComponents(
    new MessageActionRow().addComponents(tokenInput),
    new MessageActionRow().addComponents(sourceInput),
    new MessageActionRow().addComponents(targetInput)
  );

  await interaction.showModal(modal);
});

// التعامل مع إرسال المودال
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  if (interaction.customId !== 'copy_modal_submit') return;

  await interaction.deferReply({ ephemeral: true });

  const userToken = interaction.fields.getTextInputValue('token');
  const sourceId = interaction.fields.getTextInputValue('source');
  const targetId = interaction.fields.getTextInputValue('target');

  await interaction.editReply({ content: '⏳ جارٍ البدء في النسخ... سأبلغك عند الانتهاء.' });

  // تشغيل عملية النسخ باستخدام التوكن الشخصي
  await runCopy(userToken, sourceId, targetId, interaction);
});

// دالة النسخ
async function runCopy(token, sourceIdStr, targetIdStr, interaction) {
  const sourceId = BigInt(sourceIdStr);
  const targetId = BigInt(targetIdStr);

  const copyClient = new SelfClient(); // عميل Self-Bot

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
      // 1. نسخ الاسم والأيقونة
      await target.setName(source.name);
      if (source.iconURL()) {
        const iconData = await fetch(source.iconURL({ dynamic: true, format: 'png', size: 1024 }))
          .then(res => res.arrayBuffer());
        await target.setIcon(Buffer.from(iconData));
      }

      // 2. نسخ الرتب (مع تجنب التكرار)
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

      // 3. نسخ الفئات
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

      // 4. نسخ القنوات النصية والصوتية
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
      await interaction.editReply({ content: `❌ حدث خطأ: ${err.message}` });
    }

    copyClient.destroy();
    done = true;
  });

  copyClient.login(token).catch(async (e) => {
    await interaction.editReply({ content: `❌ فشل تسجيل الدخول بالتوكن الشخصي: ${e.message}` });
    done = true;
  });

  // مهلة 60 ثانية
  setTimeout(() => {
    if (!done) {
      copyClient.destroy();
      interaction.editReply({ content: '⏰ انتهت المهلة، حاول مرة أخرى.' }).catch(() => {});
    }
  }, 60000);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// تسجيل الدخول بالتوكن الخاص بالبوت
client.login(BOT_TOKEN).catch(err => {
  console.error('[ERROR] فشل تسجيل الدخول بالتوكن:', err.message);
  process.exit(1);
});
