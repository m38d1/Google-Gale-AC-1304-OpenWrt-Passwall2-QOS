# CHANGELOG — Google-Gale-AC-1304-OpenWrt-Passwall2-QOS

## v16.1 — ۱۴۰۵/۰۶/۱۹ (OpenWrt 24.10.8 + PassWall v1 light)

### تغییرات کاربری
- افزودن تنظیمات کامل PassWall به‌صورت بذری‌شده (`zz-passwall-tuned`): DNS shunt=chinadns-ng، حالت proxy برای tcp/udp، `localhost_proxy=1`، پورت‌های redirect، ۶ تا `shunt_rules` — از کانفیگ زندهٔ روتر استخراج شد.
- بعد از هر **Reset to defaults** همه‌چیز خودکار برمی‌گردد؛ فقط افزودن نودها در LuCI + enable دستی می‌ماند.
- فوتر LuCI: `… / Developered by Mehdi Askari` — فقط «Mehdi Askari» لینک‌دار به `https://mehdiaskari.ir`؛ اعتبار بیرون شرط `lua_active` (همیشه نمایش).
- منوی **Developer** به‌صورت والدِ **Network Speed** بازگشت؛ زیرمنوی changelog حذف شد.
- زیرنویس «Network Speed Monitor · nftables + tc · built for Mehdi» از صفحهٔ Network Speed حذف شد.
- مخزن عمومی GitHub ساخته شد — بدون هیچ نود/کلید/بکاپ حساس.

### تغییرات کد (شماره‌دار)
1. `etc/uci-defaults/zz-passwall-tuned` — جدید: `uci import passwall` با گارد (skip اگر نود موجود یا مارکر `/etc/passwall-tuned.applied` باشد)؛ پس از اجرا مارکر می‌سازد.
2. `etc/uci-defaults/zz-passwall-defaults` — حذف شد (وظیفه‌اش را import انجام می‌دهد؛ دیگر در هر آپگرید PassWall را خاموش نمی‌کند).
3. `usr/share/ucode/luci/template/themes/bootstrap/footer.ut` — خط اعتبار با لینک اضافه شد (خارج از `{% if (lua_active) %}`).
4. `usr/share/luci/menu.d/luci-app-dev.json` — فقط گره والد `admin/dev` (بدون action چینجلوگ).
5. `www/luci-static/resources/view/netmon/monitor.js` — خط `nm-foot` حذف شد (سینتکس با `node --check` تأیید شد).
6. `build_v16.sh` — بدون تغییر نسبت به v16؛ همان PKGS.
7. `.gitignore` — بکاپ‌های حساس و آرتیفکت‌های بیلد مستثنی شدند.

### باگ‌های رفع‌شده
- **پاک‌شدن نودها هنگام آپگرید keep-config**: ایمیج اولیه v16.1 بدون گارد بود؛ `sysupgrade` بدون `-n` هم `uci-defaults`های تازه را اجرا می‌کند و `uci import` کانفیگ را می‌ریخت. نودها از بکاپ `pre-v161-backup.tar.gz` برگشت و اسکریپت گارددار شد (تست: اجرای دستی روی کانفیگ زنده → بدون تغییر؛ فلش دوم → بدون تغییر).
- **چراغ قرمز به‌جای آبی**: `netled.sh` بدون `-4` روی curl، با نبود IPv6 تایم‌اوت می‌شد → `-4` اضافه شد (آبی درست).

### تست‌ها
- فلش واقعی روی روتر (دو بار) + بوت مجدد: کانفیگ حفظ شد (`enabled=1`، ۵ نود، Balancer اصلی).
- خروجی خارجی از نود (ترکیه `87.120.106.241`)، گوگل `200` (~۱.۹s)، aparat/digikala/bmi مستقیم و باز.
- IP آپارات در ست `psw_white` nft و قانون `return` مسیر مستقیم فعال (شمارنده بالا می‌رود).
- LED آبی؛ `admin/dev/netmon` → 200، `admin/dev/dev` → 404.
- پارس `uci import` روی کانفیگ آزمایشی → OK.

### این نسخه چه چیزی را عوض نکرد
- رمز WAN سیمی و توپولوژی (بالا-دست ۱۹۲.۱۶۸.۱.۱).
- خودِ نودها (عمداً از ایمیج و مخزن خارج‌اند) — از بکاپ محلی اضافه می‌شوند.
- AdGuard Home نصب نمی‌شود؛ بلاک فقط با لیست seed.
- netmon/netled منطق قبلی (فقط فلگ `-4` در netled).
