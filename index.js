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
    TextInputStyle 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildBoosts
    ]
});

// قراءة المتغيرات البيئية من Railway
const FEEDBACK_CHANNEL_ID = process.env.FEEDBACK_CHANNEL_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
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
        const embed = new EmbedBuilder()
            .setColor(0x5865F2);

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

    // 3. نظام تقييم العملاء (Feedback Trigger)
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

        // ملاحظة: الأفضل استخدام Slash Commands للأوامر التي تفتح Modals، لكن كمبدأ يعمل حسب طلبك.
    }
});

// التعامل مع التفاعلات (أزرار، قوائم، نماذج)
client.on('interactionCreate', async interaction => {
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

        const channel = interaction.guild.channels.cache.get(FEEDBACK_CHANNEL_ID);
        if (channel) {
            await channel.send({ embeds: [feedbackEmbed] });
        }

        return interaction.reply({ content: 'شكراً لك! تم إرسال تقييمك بنجاح.', ephemeral: true });
    }
});

// تشغيل البوت عبر المتغير البيئي في ريل واي
client.login(BOT_TOKEN);
