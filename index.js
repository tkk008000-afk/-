const { Client, Intents } = require('discord.js-selfbot-v13');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (query) => new Promise(resolve => readline.question(query, resolve));

(async () => {
  const token = await ask('[*] أدخل توكن الحساب: ');
  const sourceId = await ask('[*] أدخل آيدي السيرفر المصدر: ');
  const targetId = await ask('[*] أدخل آيدي السيرفر الهدف: ');

  const client = new Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
  });

  client.on('ready', async () => {
    console.log(`[+] تم الدخول كـ ${client.user.tag}`);
    const source = client.guilds.cache.get(sourceId);
    const target = client.guilds.cache.get(targetId);
    if (!source || !target) {
      console.log('[-] تأكد من الآيديات وصحة التوكن.');
      process.exit(0);
    }

    console.log('[*] بدء النسخ (بدون حذف أي شيء في الهدف)...');

    // 1. نسخ الاسم والأيقونة
    await target.setName(source.name);
    if (source.iconURL()) {
      const iconData = await fetch(source.iconURL({ dynamic: true, format: 'png', size: 1024 }))
        .then(res => res.arrayBuffer());
      await target.setIcon(Buffer.from(iconData));
      console.log('[+] تم نسخ الاسم والأيقونة.');
    }

    // 2. نسخ الرتب (تجنب @everyone، وتجنب التكرار بالاسم)
    const roleMap = new Map();
    for (const role of [...source.roles.cache.values()].reverse()) {
      if (role.id === source.roles.everyone.id) continue;
      const existing = target.roles.cache.find(r => r.name === role.name);
      if (existing) {
        roleMap.set(role.id, existing.id);
        console.log(`[!] رتبة '${role.name}' موجودة، تم ربطها.`);
        continue;
      }
      try {
        const newRole = await target.roles.create({
          name: role.name,
          permissions: role.permissions,
          color: role.color,
          hoist: role.hoist,
          mentionable: role.mentionable
        });
        roleMap.set(role.id, newRole.id);
        console.log(`[+] تم نسخ رتبة: ${role.name}`);
        await sleep(500);
      } catch (e) {
        console.log(`[-] فشل نسخ رتبة ${role.name}: ${e.message}`);
      }
    }

    // 3. نسخ الفئات والقنوات (بدون حذف)
    const categoryMap = new Map();

    // أولاً: الفئات
    for (const channel of source.channels.cache.values()) {
      if (channel.type === 'GUILD_CATEGORY') {
        const existingCat = target.channels.cache.find(
          c => c.type === 'GUILD_CATEGORY' && c.name === channel.name
        );
        if (existingCat) {
          categoryMap.set(channel.id, existingCat.id);
          console.log(`[!] فئة '${channel.name}' موجودة، تم استخدامها.`);
          // تحديث الصلاحيات للفئة الموجودة
          for (const [overwriteId, overwrite] of channel.permissionOverwrites.cache) {
            const roleId = roleMap.get(overwriteId) || overwriteId;
            const targetRole = target.roles.cache.get(roleId) || target.members.cache.get(roleId);
            if (targetRole) {
              await existingCat.permissionOverwrites.create(targetRole, overwrite);
            }
          }
          continue;
        }
        try {
          const newCat = await target.channels.create(channel.name, {
            type: 'GUILD_CATEGORY'
          });
          categoryMap.set(channel.id, newCat.id);
          // نسخ الصلاحيات
          for (const [overwriteId, overwrite] of channel.permissionOverwrites.cache) {
            const roleId = roleMap.get(overwriteId) || overwriteId;
            const targetRole = target.roles.cache.get(roleId) || target.members.cache.get(roleId);
            if (targetRole) {
              await newCat.permissionOverwrites.create(targetRole, overwrite);
            }
          }
          console.log(`[+] تم نسخ فئة: ${channel.name}`);
          await sleep(500);
        } catch (e) {
          console.log(`[-] فشل نسخ فئة ${channel.name}: ${e.message}`);
        }
      }
    }

    // ثانياً: القنوات النصية والصوتية
    for (const channel of source.channels.cache.values()) {
      const parentId = channel.parentId ? categoryMap.get(channel.parentId) : null;
      const parent = parentId ? target.channels.cache.get(parentId) : null;

      if (channel.type === 'GUILD_TEXT') {
        const existing = target.channels.cache.find(
          c => c.type === 'GUILD_TEXT' && c.name === channel.name && c.parentId === (parent ? parent.id : null)
        );
        if (existing) {
          console.log(`[!] قناة نصية '${channel.name}' موجودة، تم تخطيها.`);
          continue;
        }
        try {
          const newCh = await target.channels.create(channel.name, {
            type: 'GUILD_TEXT',
            parent: parent,
            topic: channel.topic,
            rateLimitPerUser: channel.rateLimitPerUser,
            nsfw: channel.nsfw
          });
          for (const [overwriteId, overwrite] of channel.permissionOverwrites.cache) {
            const roleId = roleMap.get(overwriteId) || overwriteId;
            const targetRole = target.roles.cache.get(roleId) || target.members.cache.get(roleId);
            if (targetRole) {
              await newCh.permissionOverwrites.create(targetRole, overwrite);
            }
          }
          console.log(`[+] تم نسخ نصي: ${channel.name}`);
          await sleep(500);
        } catch (e) {
          console.log(`[-] فشل نسخ نصي ${channel.name}: ${e.message}`);
        }
      }

      if (channel.type === 'GUILD_VOICE') {
        const existing = target.channels.cache.find(
          c => c.type === 'GUILD_VOICE' && c.name === channel.name && c.parentId === (parent ? parent.id : null)
        );
        if (existing) {
          console.log(`[!] قناة صوتية '${channel.name}' موجودة، تم تخطيها.`);
          continue;
        }
        try {
          const newVc = await target.channels.create(channel.name, {
            type: 'GUILD_VOICE',
            parent: parent,
            bitrate: channel.bitrate,
            userLimit: channel.userLimit
          });
          for (const [overwriteId, overwrite] of channel.permissionOverwrites.cache) {
            const roleId = roleMap.get(overwriteId) || overwriteId;
            const targetRole = target.roles.cache.get(roleId) || target.members.cache.get(roleId);
            if (targetRole) {
              await newVc.permissionOverwrites.create(targetRole, overwrite);
            }
          }
          console.log(`[+] تم نسخ صوتي: ${channel.name}`);
          await sleep(500);
        } catch (e) {
          console.log(`[-] فشل نسخ صوتي ${channel.name}: ${e.message}`);
        }
      }
    }

    console.log('[✔] اكتمل النسخ (تم تخطي الموجود مسبقاً).');
    process.exit(0);
  });

  client.login(token);
})();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
