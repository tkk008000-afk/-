import discord
import asyncio
import aiohttp
from discord.ext import commands
import os

TOKEN = input("[*] أدخل توكن الحساب: ")
SOURCE_ID = int(input("[*] أدخل آيدي السيرفر المصدر: "))
TARGET_ID = int(input("[*] أدخل آيدي السيرفر الهدف: "))

intents = discord.Intents.all()
bot = commands.Bot(command_prefix="!", self_bot=True, intents=intents)

@bot.event
async def on_ready():
    print(f"[+] تم الدخول كـ {bot.user}")
    source = bot.get_guild(SOURCE_ID)
    target = bot.get_guild(TARGET_ID)
    if not source or not target:
        print("[-] تأكد من الآيديات وصحة التوكن.")
        await bot.close()
        return

    print("[*] بدء النسخ (بدون حذف أي شيء في الهدف)...")

    # 1. نسخ الاسم والأيقونة (تعديل السيرفر الهدف)
    await target.edit(name=source.name)
    if source.icon:
        async with aiohttp.ClientSession() as session:
            async with session.get(source.icon.url) as resp:
                icon_data = await resp.read()
                await target.edit(icon=icon_data)
        print("[+] تم نسخ الاسم والأيقونة.")

    # 2. نسخ الرتب (مع تجنب @everyone)
    role_map = {}
    for role in reversed(source.roles):
        if role.is_default():
            continue
        # نتجنب تكرار الرتب بنفس الاسم (اختياري)
        existing = discord.utils.get(target.roles, name=role.name)
        if existing:
            role_map[role.id] = existing.id
            print(f"[!] رتبة '{role.name}' موجودة بالفعل، تم ربطها.")
            continue
        try:
            new_role = await target.create_role(
                name=role.name,
                permissions=role.permissions,
                colour=role.colour,
                hoist=role.hoist,
                mentionable=role.mentionable
            )
            role_map[role.id] = new_role.id
            print(f"[+] تم نسخ رتبة: {role.name}")
            await asyncio.sleep(0.5)
        except Exception as e:
            print(f"[-] فشل نسخ رتبة {role.name}: {e}")

    # 3. نسخ الفئات والقنوات (بدون حذف)
    category_map = {}
    # أولاً: إنشاء الفئات إن لم تكن موجودة
    for channel in source.channels:
        if isinstance(channel, discord.CategoryChannel):
            existing_cat = discord.utils.get(target.categories, name=channel.name)
            if existing_cat:
                category_map[channel.id] = existing_cat.id
                print(f"[!] فئة '{channel.name}' موجودة، تم استخدامها.")
                # ننسخ الصلاحيات للفئة الموجودة (تحديث)
                for overwrite in channel.overwrites:
                    if isinstance(overwrite, discord.Role):
                        role_id = role_map.get(overwrite.id)
                        if role_id:
                            target_role = target.get_role(role_id)
                            if target_role:
                                await existing_cat.set_permissions(target_role, overwrite=overwrite)
                continue
            try:
                new_cat = await target.create_category(
                    name=channel.name,
                    overwrites={}
                )
                category_map[channel.id] = new_cat.id
                for overwrite in channel.overwrites:
                    if isinstance(overwrite, discord.Role):
                        role_id = role_map.get(overwrite.id)
                        if role_id:
                            target_role = target.get_role(role_id)
                            if target_role:
                                await new_cat.set_permissions(target_role, overwrite=overwrite)
                print(f"[+] تم نسخ فئة: {channel.name}")
                await asyncio.sleep(0.5)
            except Exception as e:
                print(f"[-] فشل نسخ فئة {channel.name}: {e}")

    # ثانياً: نسخ القنوات النصية والصوتية
    for channel in source.channels:
        if isinstance(channel, discord.TextChannel):
            parent_id = category_map.get(channel.category_id) if channel.category_id else None
            parent = target.get_channel(parent_id) if parent_id else None
            # تحقق من وجود قناة بنفس الاسم ونفس الأب
            existing_ch = discord.utils.get(target.text_channels, name=channel.name, category=parent)
            if existing_ch:
                print(f"[!] قناة نصية '{channel.name}' موجودة، تم تخطيها.")
                continue
            try:
                new_ch = await target.create_text_channel(
                    name=channel.name,
                    category=parent,
                    topic=channel.topic,
                    slowmode_delay=channel.slowmode_delay,
                    nsfw=channel.nsfw,
                    overwrites={}
                )
                for overwrite in channel.overwrites:
                    if isinstance(overwrite, discord.Role):
                        role_id = role_map.get(overwrite.id)
                        if role_id:
                            target_role = target.get_role(role_id)
                            if target_role:
                                await new_ch.set_permissions(target_role, overwrite=overwrite)
                print(f"[+] تم نسخ نصي: {channel.name}")
                await asyncio.sleep(0.5)
            except Exception as e:
                print(f"[-] فشل نسخ نصي {channel.name}: {e}")

        elif isinstance(channel, discord.VoiceChannel):
            parent_id = category_map.get(channel.category_id) if channel.category_id else None
            parent = target.get_channel(parent_id) if parent_id else None
            existing_vc = discord.utils.get(target.voice_channels, name=channel.name, category=parent)
            if existing_vc:
                print(f"[!] قناة صوتية '{channel.name}' موجودة، تم تخطيها.")
                continue
            try:
                new_vc = await target.create_voice_channel(
                    name=channel.name,
                    category=parent,
                    bitrate=channel.bitrate,
                    user_limit=channel.user_limit,
                    overwrites={}
                )
                for overwrite in channel.overwrites:
                    if isinstance(overwrite, discord.Role):
                        role_id = role_map.get(overwrite.id)
                        if role_id:
                            target_role = target.get_role(role_id)
                            if target_role:
                                await new_vc.set_permissions(target_role, overwrite=overwrite)
                print(f"[+] تم نسخ صوتي: {channel.name}")
                await asyncio.sleep(0.5)
            except Exception as e:
                print(f"[-] فشل نسخ صوتي {channel.name}: {e}")

    print("[✔] اكتمل النسخ (تم تخطي الموجود مسبقاً).")
    await bot.close()

bot.run(TOKEN, bot=False)
