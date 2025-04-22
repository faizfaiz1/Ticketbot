const { Client, IntentsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

let token;
try {
    token = process.env.DISCORD_TOKEN || require('./config.json').token;
} catch (error) {
    console.error('❌ لم يتم العثور على التوكن! تأكد من وجود config.json أو متغير بيئة DISCORD_TOKEN');
    process.exit(1);
}

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent
    ]
});

// Configuration
const TICKET_OPEN_CHANNEL = '1352887984826880041';
const CATEGORY_IDS = {
    'شراء': '1352904381720428545',
    'سؤال': '1352903935916249100',
    'مساعدة': '1352903935685300328'
};

const SUPPORT_ROLES = [
    '1352890360778592369',
    '1352890388205010974',
    '1352890409386512464'
];

const EMOJIS = {
    'شراء': '<:buy:1361724397471400018>',
    'مساعدة': '<:help:1363107873466617957>',
    'سؤال': '<:question:1363107877845467306>'
};

const EMBED_COLOR = 0xbd9bf2; // اللون المطلوب #bd9bf2

let ticketMessageId = null;

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    const channel = await client.channels.fetch(TICKET_OPEN_CHANNEL);
    const messages = await channel.messages.fetch({ limit: 100 });

    const existingMessage = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);

    if (existingMessage) {
        ticketMessageId = existingMessage.id;
        console.log('Found existing ticket message');
    } else {
        await sendTicketMessage(channel);
    }
});

async function sendTicketMessage(channel) {
    const embed = new EmbedBuilder()
        .setTitle('نظام التذاكر')
        .setDescription(`
            اضغط على الزر أدناه لفتح تذكرة جديدة\n\n
            ${EMOJIS['شراء']} **شراء منتج** - للاستفسار عن المنتجات والشراء\n
            ${EMOJIS['مساعدة']} **مساعدة** - إذا كنت بحاجة إلى مساعدة فنية\n
            ${EMOJIS['سؤال']} **سؤال** - لأي استفسارات أخرى
        `)
        .setColor(EMBED_COLOR)
        .setFooter({ text: 'سيتم إنشاء قناة خاصة لكل تذكرة' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel('فتح تذكرة جديدة')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎫')
    );

    const message = await channel.send({ embeds: [embed], components: [row] });
    ticketMessageId = message.id;
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    if (interaction.customId === 'create_ticket') {
        const embed = new EmbedBuilder()
            .setTitle('اختر نوع التذكرة')
            .setDescription('الرجاء اختيار نوع التذكرة التي تريد فتحها')
            .setColor(EMBED_COLOR);

        const row = new ActionRowBuilder().addComponents(
            new SelectMenuBuilder()
                .setCustomId('select_ticket_type')
                .setPlaceholder('اختر نوع التذكرة')
                .addOptions(
                    {
                        label: 'شراء منتج',
                        description: 'للاستفسار عن المنتجات والشراء',
                        value: 'شراء',
                        emoji: { id: '1361724397471400018' }
                    },
                    {
                        label: 'مساعدة',
                        description: 'إذا كنت بحاجة إلى مساعدة فنية',
                        value: 'مساعدة',
                        emoji: { id: '1363107873466617957' }
                    },
                    {
                        label: 'سؤال',
                        description: 'لأي استفسارات أخرى',
                        value: 'سؤال',
                        emoji: { id: '1363107877845467306' }
                    }
                )
        );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    if (interaction.customId === 'select_ticket_type') {
        const ticketType = interaction.values[0];
        await interaction.deferReply({ ephemeral: true });

        const category = await client.channels.fetch(CATEGORY_IDS[ticketType]);
        const guild = interaction.guild;

        const overwrites = [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: interaction.user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            }
        ];

        for (const roleId of SUPPORT_ROLES) {
            overwrites.push({
                id: roleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            });
        }

        const ticketChannel = await guild.channels.create({
            name: `${ticketType}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: overwrites
        });

        const ticketEmbed = new EmbedBuilder()
            .setTitle(`تذكرة ${ticketType} ${EMOJIS[ticketType]}`)
            .setDescription(`
                تم إنشاء التذكرة بواسطة ${interaction.user}\n\n
                الرجاء الانتظار حتى يتم الرد عليك.
            `)
            .setColor(EMBED_COLOR)
            .setFooter({ text: 'اضغط على الزر أدناه لإغلاق التذكرة' });

        const closeButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`close_ticket_${ticketChannel.id}`)
                .setLabel('إغلاق التذكرة')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒')
        );

        await ticketChannel.send({
            content: `${interaction.user} ${SUPPORT_ROLES.map(r => `<@&${r}>`).join(' ')}`,
            embeds: [ticketEmbed],
            components: [closeButton]
        });

        const userEmbed = new EmbedBuilder()
            .setTitle(`تم إنشاء تذكرة ${ticketType} ${EMOJIS[ticketType]}`)
            .setDescription(`تم إنشاء التذكرة في ${ticketChannel}`)
            .setColor(EMBED_COLOR);

        await interaction.followUp({ embeds: [userEmbed], ephemeral: true });
    }

    if (interaction.customId.startsWith('close_ticket_')) {
        const channelId = interaction.customId.replace('close_ticket_', '');
        const channel = await client.channels.fetch(channelId);

        await interaction.reply({ content: 'جارٍ إغلاق التذكرة...', ephemeral: true });
        await channel.delete();
    }
});

client.login(token);
