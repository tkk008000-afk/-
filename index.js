const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ---------- CONFIG ----------
const CONFIG_FILE = path.join(__dirname, 'config.json');
const DEFAULT_CONFIG = {
  faq_title: 'الأسئلة الشائعة',
  faq_desc: 'اختر سؤالك من القائمة',
  faq_banner: 'https://example.com/faq_banner.png',
  control_title: 'لوحة التحكم',
  control_desc: 'تتبع تقدم الخادم',
  control_banner: 'https://example.com/control_banner.png',
  store_title: 'المتجر',
  store_desc: 'اختر منتجاً من القائمة',
  store_banner: 'https://example.com/store_banner.png',
  review_channel_id: null,
  review_image: 'https://example.com/review_default.png',
  faqs: [],
  products: []
};

if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 4), 'utf-8');
}

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 4), 'utf-8');
}

// ---------- BOT ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const EMBED_COLOR = 0x1a0b2e;

// ---------- HELPERS ----------
function buildBaseEmbed(title, desc, banner) {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(title || ' ')
    .setDescription(desc || ' ')
    .setImage(banner || null);
  return embed;
}

// ---------- UI COMPONENTS (Builders) ----------
function getFAQView(faqs) {
  if (!faqs || faqs.length === 0) {
    return new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('faq_dropdown')
        .setPlaceholder('لا توجد أسئلة حالياً')
        .setDisabled(true)
        .addOptions([{ label: 'لا شيء', value: 'none' }])
    );
  }
  const options = faqs.map((faq, i) => ({
    label: faq.question.length > 100 ? faq.question.substring(0, 100) : faq.question,
    // تم حذف الجواب من الوصف - الآن لا يظهر أي نص تحت السؤال في القائمة
    description: ' ',
    value: String(i)
  }));
  const menu = new StringSelectMenuBuilder()
    .setCustomId('faq_dropdown')
    .setPlaceholder('اختر سؤالاً...')
    .addOptions(options);
  return new ActionRowBuilder().addComponents(menu);
}

function getControlView() {
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ctrl_boost')
        .setLabel('📊 البوستات (Boosts)')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ctrl_nitro')
        .setLabel('🎮 النيترو (Nitro)')
        .setStyle(ButtonStyle.Success)
    );
  return row;
}

function getStoreView(products) {
  if (!products || products.length === 0) {
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('store_dropdown')
        .setPlaceholder('لا توجد منتجات')
        .setDisabled(true)
        .addOptions([{ label: 'لا شيء', value: 'none' }])
    );
    return row;
  }
  const options = products.map((prod, i) => ({
    label: prod.name.length > 100 ? prod.name.substring(0, 100) : prod.name,
    description: `السعر: ${prod.price || 'غير محدد'}`,
    value: String(i)
  }));
  const menu = new StringSelectMenuBuilder()
    .setCustomId('store_dropdown')
    .setPlaceholder('اختر منتجاً...')
    .addOptions(options);
  return new ActionRowBuilder().addComponents(menu);
}

// ---------- MODALS ----------
function buildFAQModal() {
  const modal = new ModalBuilder()
    .setCustomId('add_faq_modal')
    .setTitle('إضافة سؤال جديد');
  const qInput = new TextInputBuilder()
    .setCustomId('faq_question')
    .setLabel('السؤال')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(200);
  const aInput = new TextInputBuilder()
    .setCustomId('faq_answer')
    .setLabel('الجواب')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);
  modal.addComponents(
    new ActionRowBuilder().addComponents(qInput),
    new ActionRowBuilder().addComponents(aInput)
  );
  return modal;
}

function buildProductModal() {
  const modal = new ModalBuilder()
    .setCustomId('add_product_modal')
    .setTitle('إضافة منتج جديد');
  const nInput = new TextInputBuilder()
    .setCustomId('prod_name')
    .setLabel('اسم المنتج')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);
  const pInput = new TextInputBuilder()
    .setCustomId('prod_price')
    .setLabel('السعر')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(50);
  modal.addComponents(
    new ActionRowBuilder().addComponents(nInput),
    new ActionRowBuilder().addComponents(pInput)
  );
  return modal;
}

function buildSetPanelModal() {
  const modal = new ModalBuilder()
    .setCustomId('set_panel_modal')
    .setTitle('تعديل إعدادات البانل');
  const typeInput = new TextInputBuilder()
    .setCustomId('panel_type')
    .setLabel('نوع البانل (faq / control / store)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('faq');
  const titleInput = new TextInputBuilder()
    .setCustomId('panel_title')
    .setLabel('العنوان الجديد (اتركه فارغاً للتجاهل)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);
  const descInput = new TextInputBuilder()
    .setCustomId('panel_desc')
    .setLabel('الوصف الجديد (اتركه فارغاً)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);
  const bannerInput = new TextInputBuilder()
    .setCustomId('panel_banner')
    .setLabel('رابط البنر الجديد (اتركه فارغاً)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);
  modal.addComponents(
    new ActionRowBuilder().addComponents(typeInput),
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(descInput),
    new ActionRowBuilder().addComponents(bannerInput)
  );
  return modal;
}

function buildReviewModal() {
  const modal = new ModalBuilder()
    .setCustomId('review_modal')
    .setTitle('تقييم العميل');
  const idInput = new TextInputBuilder()
    .setCustomId('review_member_id')
    .setLabel('آيدي العضو (ID)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  const prodInput = new TextInputBuilder()
    .setCustomId('review_product')
    .setLabel('اسم الخدمة / المنتج')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  const rateInput = new TextInputBuilder()
    .setCustomId('review_rating')
    .setLabel('التقييم (1-5)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(1);
  const msgInput = new TextInputBuilder()
    .setCustomId('review_message')
    .setLabel('رسالتك للمتجر')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);
  modal.addComponents(
    new ActionRowBuilder().addComponents(idInput),
    new ActionRowBuilder().addComponents(prodInput),
    new ActionRowBuilder().addComponents(rateInput),
    new ActionRowBuilder().addComponents(msgInput)
  );
  return modal;
}

// ---------- SLASH COMMANDS DEFINITIONS ----------
const commands = [
  new SlashCommandBuilder()
    .setName('اسئلة')
    .setDescription('إرسال بانل الأسئلة الشائعة'),
  new SlashCommandBuilder()
    .setName('لوحة_التحكم')
    .setDescription('إرسال بانل التحكم (بوستات ونيترو)'),
  new SlashCommandBuilder()
    .setName('متجر')
    .setDescription('إرسال بانل المتجر مع المنتجات'),
  new SlashCommandBuilder()
    .setName('تقييم')
    .setDescription('إرسال نموذج تقييم للعميل'),
  new SlashCommandBuilder()
    .setName('اضافة_سؤال')
    .setDescription('إضافة سؤال جديد للأسئلة الشائعة')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName('اضافة_منتج')
    .setDescription('إضافة منتج جديد للمتجر')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName('تعيين_روم_التقييم')
    .setDescription('تعيين الروم الذي تصل إليه التقييمات')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addChannelOption(opt => opt.setName('channel').setDescription('الروم المطلوب').setRequired(true)),
  new SlashCommandBuilder()
    .setName('تعيين_صورة_التقييم')
    .setDescription('تعيين الصورة التي تظهر في تقييم العميل')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addStringOption(opt => opt.setName('url').setDescription('رابط الصورة').setRequired(true)),
  new SlashCommandBuilder()
    .setName('تعديل_بانل')
    .setDescription('تعديل العنوان والوصف والبنر لأي بانل')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

// ---------- REGISTER COMMANDS ----------
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands.map(cmd => cmd.toJSON()) });
    console.log('✅ Slash commands registered globally.');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
}

// ---------- CLIENT EVENTS ----------
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerCommands();
});

client.on('interactionCreate', async interaction => {
  // ---------- SLASH COMMANDS ----------
  if (interaction.isChatInputCommand()) {
    const cfg = loadConfig();

    if (interaction.commandName === 'اسئلة') {
      const embed = buildBaseEmbed(cfg.faq_title, cfg.faq_desc, cfg.faq_banner);
      const row = getFAQView(cfg.faqs);
      await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
      return;
    }

    if (interaction.commandName === 'لوحة_التحكم') {
      const embed = buildBaseEmbed(cfg.control_title, cfg.control_desc, cfg.control_banner);
      const row = getControlView();
      await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
      return;
    }

    if (interaction.commandName === 'متجر') {
      const embed = buildBaseEmbed(cfg.store_title, cfg.store_desc, cfg.store_banner);
      const row = getStoreView(cfg.products);
      await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
      return;
    }

    if (interaction.commandName === 'تقييم') {
      await interaction.showModal(buildReviewModal());
      return;
    }

    if (interaction.commandName === 'اضافة_سؤال') {
      await interaction.showModal(buildFAQModal());
      return;
    }

    if (interaction.commandName === 'اضافة_منتج') {
      await interaction.showModal(buildProductModal());
      return;
    }

    if (interaction.commandName === 'تعيين_روم_التقييم') {
      const channel = interaction.options.getChannel('channel');
      if (!channel || channel.type !== 0) { // 0 = GUILD_TEXT
        await interaction.reply({ content: '❌ الرجاء تحديد روم نصي صالح.', ephemeral: true });
        return;
      }
      cfg.review_channel_id = channel.id;
      saveConfig(cfg);
      await interaction.reply({ content: `✅ تم تعيين روم التقييمات إلى ${channel.toString()}`, ephemeral: true });
      return;
    }

    if (interaction.commandName === 'تعيين_صورة_التقييم') {
      const url = interaction.options.getString('url');
      cfg.review_image = url;
      saveConfig(cfg);
      await interaction.reply({ content: '✅ تم تحديث صورة التقييم.', ephemeral: true });
      return;
    }

    if (interaction.commandName === 'تعديل_بانل') {
      await interaction.showModal(buildSetPanelModal());
      return;
    }
  }

  // ---------- SELECT MENU (FAQ / STORE) ----------
  if (interaction.isStringSelectMenu()) {
    const cfg = loadConfig();

    if (interaction.customId === 'faq_dropdown') {
      const idx = parseInt(interaction.values[0]);
      if (isNaN(idx) || idx < 0 || idx >= cfg.faqs.length) {
        await interaction.reply({ content: '❌ سؤال غير صالح.', ephemeral: true });
        return;
      }
      const faq = cfg.faqs[idx];
      // Embed يظهر الجواب فقط (مع السؤال كعنوان للإيضاح، أو يمكن جعل العنوان "الجواب")
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle(faq.question)
        .setDescription(faq.answer)
        .setFooter({ text: 'الرد التلقائي' });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (interaction.customId === 'store_dropdown') {
      const idx = parseInt(interaction.values[0]);
      if (isNaN(idx) || idx < 0 || idx >= cfg.products.length) {
        await interaction.reply({ content: '❌ منتج غير صالح.', ephemeral: true });
        return;
      }
      const prod = cfg.products[idx];
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle(prod.name)
        .setDescription(`السعر: ${prod.price || 'غير محدد'}`)
        .setFooter({ text: 'متجرنا' });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }
  }

  // ---------- BUTTONS (Control) ----------
  if (interaction.isButton()) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: '❌ لا يمكن استخدام هذا الزر خارج الخادم.', ephemeral: true });
      return;
    }

    if (interaction.customId === 'ctrl_boost') {
      const count = guild.premiumSubscriptionCount || 0;
      const tier = guild.premiumTier;
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle('تقدم البوستات')
        .addFields(
          { name: 'عدد البوستات', value: String(count), inline: true },
          { name: 'المستوى الحالي', value: `Level ${tier}`, inline: true }
        );
      if (tier < 3) {
        const needed = { 0: 2, 1: 7, 2: 14 }[tier] || 0;
        const progress = needed > 0 ? Math.min((count / needed) * 100, 100) : 0;
        embed.addFields(
          { name: 'المطلوب للمستوى التالي', value: `${needed} بوست`, inline: true },
          { name: 'التقدم', value: `${progress.toFixed(1)}%`, inline: false }
        );
      } else {
        embed.addFields({ name: 'المستوى', value: 'الأقصى (Level 3)', inline: false });
      }
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (interaction.customId === 'ctrl_nitro') {
      const count = guild.premiumSubscriptionCount || 0;
      const tier = guild.premiumTier;
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle('حالة النيترو')
        .addFields(
          { name: 'عدد البوستات', value: String(count), inline: true },
          { name: 'مستوى الخادم', value: `Level ${tier}`, inline: true }
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }
  }

  // ---------- MODALS ----------
  if (interaction.isModalSubmit()) {
    const cfg = loadConfig();

    if (interaction.customId === 'add_faq_modal') {
      const question = interaction.fields.getTextInputValue('faq_question');
      const answer = interaction.fields.getTextInputValue('faq_answer');
      cfg.faqs.push({ question, answer });
      saveConfig(cfg);
      await interaction.reply({ content: '✅ تم إضافة السؤال بنجاح.', ephemeral: true });
      return;
    }

    if (interaction.customId === 'add_product_modal') {
      const name = interaction.fields.getTextInputValue('prod_name');
      const price = interaction.fields.getTextInputValue('prod_price');
      cfg.products.push({ name, price });
      saveConfig(cfg);
      await interaction.reply({ content: '✅ تم إضافة المنتج بنجاح.', ephemeral: true });
      return;
    }

    if (interaction.customId === 'set_panel_modal') {
      const type = interaction.fields.getTextInputValue('panel_type').trim().toLowerCase();
      if (!['faq', 'control', 'store'].includes(type)) {
        await interaction.reply({ content: '❌ النوع يجب أن يكون faq أو control أو store', ephemeral: true });
        return;
      }
      const newTitle = interaction.fields.getTextInputValue('panel_title').trim();
      const newDesc = interaction.fields.getTextInputValue('panel_desc').trim();
      const newBanner = interaction.fields.getTextInputValue('panel_banner').trim();
      const prefix = type;
      if (newTitle) cfg[`${prefix}_title`] = newTitle;
      if (newDesc) cfg[`${prefix}_desc`] = newDesc;
      if (newBanner) cfg[`${prefix}_banner`] = newBanner;
      saveConfig(cfg);
      await interaction.reply({ content: `✅ تم تحديث بانل ${type} بنجاح.`, ephemeral: true });
      return;
    }

    if (interaction.customId === 'review_modal') {
      const memberId = interaction.fields.getTextInputValue('review_member_id');
      const product = interaction.fields.getTextInputValue('review_product');
      const rating = interaction.fields.getTextInputValue('review_rating');
      const message = interaction.fields.getTextInputValue('review_message');

      if (!['1','2','3','4','5'].includes(rating)) {
        await interaction.reply({ content: '❌ التقييم يجب أن يكون رقم من 1 إلى 5.', ephemeral: true });
        return;
      }
      const stars = '⭐'.repeat(parseInt(rating));

      const channelId = cfg.review_channel_id;
      if (!channelId) {
        await interaction.reply({ content: '❌ لم يتم تعيين روم التقييمات. استخدم `/تعيين_روم_التقييم`', ephemeral: true });
        return;
      }
      const channel = interaction.guild.channels.cache.get(channelId);
      if (!channel || channel.type !== 0) {
        await interaction.reply({ content: '❌ الروم المحدد غير موجود أو ليس نصياً.', ephemeral: true });
        return;
      }

      let member = null;
      try {
        member = await interaction.guild.members.fetch(memberId);
      } catch (_) { /* ignore */ }

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle('📝 تقييم جديد')
        .setThumbnail(cfg.review_image || 'https://example.com/default.png')
        .addFields(
          { name: '👤 العميل', value: member ? `<@${member.id}>` : `ID: ${memberId}`, inline: true },
          { name: '🛒 المنتج', value: `\`${product}\``, inline: true },
          { name: '⭐ التقييم', value: stars, inline: true },
          { name: '💬 رسالة للمتجر', value: message, inline: false }
        )
        .setFooter({ text: 'شكراً لتقييمك' });

      await channel.send({ embeds: [embed] });
      await interaction.reply({ content: '✅ تم إرسال تقييمك بنجاح.', ephemeral: true });
      return;
    }
  }
});

// ---------- START BOT ----------
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN environment variable is required.');
  process.exit(1);
}
client.login(token);
