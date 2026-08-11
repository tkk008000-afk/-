const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    REST,
    Routes,
    PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildBoosts
    ]
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID; // آيدي البوت لتسجيل أوامر السلاش

// ملف لحفظ إعدادات الرومات لكل سيرفر
const configPath = path.join(__dirname, 'config.json');

function loadConfig() {
    if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    return {};
}

function saveConfig(data) {
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // تسجيل أمر السلاش تلقائياً عند تشغيل البوت
    const commands = [
        {
            name: 'تعيين-روم-التقييم',
            description: 'تحديد الروم المخصصة لإرسال تقييمات العملاء',
            default_member_permissions: PermissionFlagsBits.Administrator.toString(),
            options: [
                {
                    name: 'الروم',
                    description: 'اختر الروم التي ستستقبل التقييمات',
                    type: 7, // Channel Type
                    required: true,
                    channel_types: [0] // Text Channel only
                }
            ]
        }
    ];

    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Successfully registered slash commands.');
    } catch (error) {
        console.error(error);
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // 1. نظام الأسئلة الشائعة (FAQ)
    if (message.content === '!أسئلة') {
        const embed = new EmbedBuilder()
            .setTitle('الأسئلة الشائعة - FAQ')
            .setDescription('للحصول على إجابة سريعة لاستفسارك، يرجى اختيار السؤال الذي تريد اجابته من القائمة بالأسفل. نحن هنا لخدمتك :')
            .setColor(0x5865F2);

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('faq_select')
                .setPlaceholder('...اختر من القائمة')
                .addOptions([
                    { label: 'ما هي طرق الدفع المتاحة؟', value: 'q1', description: 'معرفة وسائل الدفع المتوفرة' },
                    { label: 'كيف أستلم طلبي بعد الشراء؟', value: 'q2', description: 'طريقة استلام المنتجات والبوستات' },
                    { label: 'هل يوجد ضمان على البوستات؟', value: 'q3', description: 'تفاصيل الضمان ومدة الأمان' }
                ])
        );

        return message.reply({ embeds: [embed], components: [row] });
    }

    // 2. نظام فحص النيترو والبوستات (Control)
    if (message.content === '!كنترول' || message.content === '!control') {
        const embed = new EmbedBuilder().setColor(0x5865F2);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('check_nitro')
                .setLabel('فحص شارة النيترو')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🚀'),
            new ButtonBuilder()
                .setCustomId('check_boost')
                .setLabel('فحص شارة البوست')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('💎')
        );

        return message.reply({ embeds: [embed], components: [row] });
    }

    // 3. أمر فتح نموذج التقييم
    if (message.content === '!تقييم') {
        const modal = new ModalBuilder()
            .setCustomId('feedback_modal')
            .setTitle('تقييم المتجر');

        const productInput = new TextInputBuilder()
            .setCustomId('feedback_product')
            .setLabel('اسم المنتج أو الخدمة')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('مثال: بوستات سيرفر - 14 بوست شهر')
            .setRequired(true);

        const ratingInput = new TextInputBuilder()
            .setCustomId('feedback_rating')
            .setLabel('التقييم من 5 نجوم')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('اكتب رقم من 1 إلى 5')
            .setRequired(true);

        const messageInput = new TextInputBuilder()
            .setCustomId('feedback_message')
            .setLabel('رسالتك للمتجر')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('اكتب رأيك بكل صراحة...')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(productInput),
            new ActionRowBuilder().addComponents(ratingInput),
            new ActionRowBuilder().addComponents(messageInput)
        );

        // ملاحظة: تفعيل الـ Modal مباشرة يتطلب التفاعل عبر زر أو Slash Command، لكن تم وضعه هنا للتوضيح.
    }
});

client.on('interactionCreate', async interaction => {
    // التعامل مع أوامر السلاش (Slash Commands)
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'تعيين-روم-التقييم') {
            const channel = interaction.options.getChannel('الروم');
            const config = loadConfig();

            config[interaction.guildId] = channel.id;
            saveConfig(config);

            return interaction.reply({ content: `✅ تم بنجاح تعيين روم التقييمات لتصبح: ${channel}`, ephemeral: true });
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'faq_select') {
        let answer = '';
        if (interaction.values[0] === 'q1') answer = 'نوفر وسائل دفع متعددة تشمل بطاقات مدى، فودافون كاش، وباي بال.';
        if (interaction.values[0] === 'q2') answer = 'يتم تسليم الطلب بشكل تلقائي أو عبر فتح تذكرة دعم فني مباشرة.';
        if (interaction.values[0] === 'q3') answer = 'نعم، جميع خدماتنا مضمونة طوال فترة الاشتراك.';

        return interaction.reply({ content: `**الجواب:** ${answer}`, ephemeral: true });
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'check_nitro') {
            return interaction.reply({ content: '🔍 جاري فحص حالة اشتراك النيترو الخاص بك...', ephemeral: true });
        }
        if (interaction.customId === 'check_boost') {
            const guild = interaction.guild;
            const boostCount = guild.premiumSubscriptionCount;
            const tier = guild.premiumTier;
            return interaction.reply({ content: `💎 عدد بوستات السيرفر الحالية هي: **${boostCount}** والمستوى الحالي هو: **Level ${tier}**`, ephemeral: true });
        }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'feedback_modal') {
        const product = interaction.fields.getTextInputValue('feedback_product');
        const ratingNum = parseInt(interaction.fields.getTextInputValue('feedback_rating')) || 5;
        const msgText = interaction.fields.getTextInputValue('feedback_message');

        const stars = '⭐'.repeat(Math.min(Math.max(ratingNum, 1), 5));

        const feedbackEmbed = new EmbedBuilder()
            .setTitle(`تقييم جديد من ${interaction.user.username}`)
            .addFields(
                { name: '👤 العضو', value: `<@${interaction.user.id}>` },
                { name: '📦 المنتج', value: `\`${product}\`` },
                { name: '⭐ التقييم', value: stars },
                { name: '📝 رسالة للمتجر', value: `\`\`\`${msgText}\`\`\`` }
            )
            .setColor(0x5865F2)
            .setTimestamp()
            .setFooter({ text: 'Candy Store | Feedback' });

        // جلب الروم المحفوظة لهذا السيرفر
        const config = loadConfig();
        const feedbackChannelId = config[interaction.guildId];

        if (feedbackChannelId) {
            const channel = interaction.guild.channels.cache.get(feedbackChannelId);
            if (channel) {
                await channel.send({ embeds: [feedbackEmbed] });
            }
        }

        return interaction.reply({ content: 'شكراً لك! تم إرسال تقييمك بنجاح.', ephemeral: true });
    }
});

client.login(BOT_TOKEN);
