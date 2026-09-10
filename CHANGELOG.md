# CHANGELOG — Google-Gale-AC-1304-OpenWrt-Passwall2-QOS

## v16.3 — ۱۴۰۵/۰۶/۱۹ (حذف SSID دایرکت)

### تغییرات کاربری
- SSID دوم **`Google Router Direct`** (شبکهٔ جدای ۱۹۲.۱۶۸.۱۱.۰/۲۴، همیشه‌مستقیم) به درخواست کاربر **حذف شد** — فقط `Google Router` روی هر دو باند می‌ماند.
- کل زیرساخت آن شبکه (اینترفیس `direct`، DHCP، زون فایروال، فورواردینگ به wan) هم از ایمیج حذف شد.
- ترافیک دایرکتِ ایران همچنان از مسیر لیست seed (۲۷۷۲ CIDR + ۳۶۵ دامنه) مدیریت می‌شود — نیازی به SSID جدا نبود.

### تغییرات کد (شماره‌دار)
1. `etc/uci-defaults/99-z-direct` — **حذف کامل**؛ فقط بخش هویت (hostname/timezone) به فایل جدید `etc/uci-defaults/99-z-system` منتقل شد.
2. `root/passwall-seed.sh` — بلوک تزریق قوانین bypass برای `192.168.11.0/24` (direct-bypass) حذف شد.
3. `usr/share/passwall/nftables.sh` — پنج خط پخته‌شدهٔ `direct-bypass` (PSW_MANGLE/MANGLE_V6/NAT/DNS) از overlay حذف شد.
4. بقیهٔ overlay بدون تغییر نسبت به v16.2 (netmon با هوک‌های درست، فیلتر 0.0.0.0، مجوز ۷۵۵ nftables.sh).

### باگ‌های رفع‌شده
- (بدون باگ جدید — این نسخه فقط حذف قابلیت SSID دایرکت بود)

### تست‌ها
- `bash -n` روی همهٔ اسکریپت‌های شلِ overlay بدون خطا؛ `grep` هیچ ارجاعی به `192.168.11`/`br-direct`/`Router Direct` نداد (فقط کامنت مستندات).
- بیلد تمیز در ImageBuilder؛ فلش keep-config روی روتر: `Google Router Direct` دیگر ساخته نمی‌شود؛ کانفیگ زندهٔ قدیمی دستی پاک شد (`uci delete` + commit + reload wifi/firewall).
- پس از فلش: passwall ‏`enabled=1`، نودها حفظ، `google: 204` از پروکسی، LED آبی، `0.0.0.0` در ست‌ها صفر، زنجیره‌های netmon کامل.

### این نسخه چه چیزی را عوض نکرد
- netmon (هوک‌های v16.2)، netled، فوتر/منوهای LuCI، seedهای ایران، گارد نودها، رمز root خالی، LAN ‏۱۹۲.۱۶۸.۱۰.۱.
- نودها و xray ‏26.9.9-r1 — عیناً v16.2.

## v16.2 — ۱۴۰۵/۰۶/۱۹ (رفع شمارش ترافیک پروکسی‌شده در netmon)

### تغییرات کاربری
- باگ بزرگ netmon رفع شد: ترافیک دستگاه‌هایی که از **PassWall** سرویس می‌گیرند (مثلاً تماشای یوتیوب روی تلویزیون) در صفحهٔ Network Speed **هیچ** نشان نمی‌داد؛ ترافیک مستقیم (بدون پروکسی) درست بود.
- طبق درخواست کاربر، قانون **کلی** شد: شمارش درست همهٔ دستگاه‌های br-lan در هر دو جهت، چه مستقیم چه پروکسی‌شده.

### تغییرات کد (شماره‌دار)
1. `etc/nftables.d/netmon.nft` — هوک شمارش از `forward` به `prerouting` (آپلود: `nm_acc_up`) و `postrouting` (دانلود: `nm_acc_down`) منتقل شد. دلیل: PassWall با REDIRECT ترافیک کلاینت را به `192.168.10.1:1041` (xray محلی) می‌فرستد؛ این بسته‌ها هرگز هوک `forward` را رد نمی‌شوند و پاسخ‌های xray هم locally-originated هستند. `prerouting` همهٔ بسته‌های ورودی از کلاینت (قبل از redirect، saddr دست‌نخورده) و `postrouting` همهٔ بسته‌های خروجی به کلاینت (فوروارد + پاسخ محلی xray) را می‌بیند.
2. سه زنجیرهٔ بلاک شد (برای کارکرد «Block» روی مسیر پروکسی): `nm_control` (forward، مثل قبل) + `nm_control_pre` (prerouting) + `nm_control_post` (postrouting) — همگی `ip saddr/daddr @nm_block drop` با qmark روی br-lan.
3. `usr/share/passwall/nftables.sh` — بایت اجرایی (۷۵۵) در overlay اضافه شد؛ در `firewall restart` خطای `Permission denied` می‌داد (باگ نهفته برای اعمال قوانین PassWall بعد از ریستارت/ریبوت).
4. `enforce.sh` / `reset.sh` بدون تغییر — خواندن/فلش‌کردن ست‌ها از `inet fw4` از قبل درست بود.
5. **فیلتر آدرس‌های خاص** در `netmon.nft`: چون شمارش آپلود حالا روی `prerouting` است، بسته‌های DHCP DISCOVER (مبدأ `0.0.0.0`) و برادکست (`255.255.255.255`) به‌عنوان «دستگاه» جعلی در لیست Network Speed ظاهر می‌شدند. قوانین `update` با `ip saddr/daddr != { 0.0.0.0, 255.255.255.255 }` محدود شدند.
6. پکیج‌ها از فید ابری pull شدند: `luci-app-passwall 26.9.9-r1`، `xray-core 26.9.9` (در v16.1 ‏26.9.8 بود — ارتقای خودکار فید، نه تغییر عمدی).

### باگ‌های رفع‌شده
- **ترافیک پروکسی‌شده شمرده نمی‌شد (delta=0 روی تلویزیون در حال پخش یوتیوب)** — بعد از رفع: ۷٫۷MB دانلود و ~۲۰۰KB آپلود در ۱۵ ثانیه روی همان IP.
- **`Permission denied` روی `nftables.sh` هنگام `service firewall restart`** (از مسیر `/var/etc/passwall.include`).
- **ورودی جعلی `0.0.0.0` در لیست دستگاه‌های Network Speed** (ناشی از دیدن DHCP DISCOVER در prerouting) — با فیلتر آدرس‌های خاص رفع شد.

### تست‌ها
- `service firewall restart` + بررسی `nft list table inet fw4`: زنجیره‌های `nm_acc_up` (hook prerouting) و `nm_acc_down` (hook postrouting) فعال.
- دلتای ۱۵ ثانیه‌ای `nm_qdown`/`nm_qup` برای IP تلویزیون (ترافیک یوتیوب از مسیر پروکسی): رشد چشمگیر و هم‌تراز. (پیش از رفع: صفر مطلق.)
- عدم خطای nftables در ریستارت فایروال بعد از chmod.
- فلش نهایی v16.2 (sha `faf777…`) با keep-config: ۵ نود حفظ، `enabled=1`، `google: 204` از پروکسی، `aparat: 301` مستقیم، LED آبی، IP تلویزیون داخل ست شمارش، **صفر occurrences از `0.0.0.0` در ست‌ها**.

### این نسخه چه چیزی را عوض نکرد
- کانفیگ PassWall، نودها، لیست‌های seed ایران، فوتر/منوهای LuCI، netled — عیناً v16.1.
- منطق QoS (`tc htb` در `apply.sh`) و فایل `limits.json` — دست‌نخورده.
- گارد `zz-passwall-tuned` (حفظ نودها هنگام آپگرید) — بدون تغییر.

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

## v16 — ۱۴۰۵/۰۶/۱۹ (مهاجرت به OpenWrt 24.10.8 + PassWall v1 سبک + ایران‌دایرکت لیست‌دستی)

### تغییرات کاربری
- مهاجرت از 25.12.5 (apk) به **24.10.8 (opkg)** — پایهٔ رسمی `openwrt-24.10.8-ipq40xx-chromium`، کرنل `6.6.144`، پروفایل `google_wifi` (Gale).
- **PassWall v1 سبک** جای PassWall2: فقط `xray-core` (بدون sing-box/ssr/hysteria/naive/v2ray-geoip) — روت‌فس ~۱۸MB در برابر ~۵۸MB.
- **ایران‌دایرکت لیست‌دستی بذری‌شده**: ۲۷۷۲ CIDR در `rules/direct_ip` + ۳۶۵ دامنه در `direct_host` (بدون GeoIP/在线 دانلود) — در هر بوت خودترمیم.
- لیست تبلیغات seed در `block_host`.
- port کامل netmon (سهمیه/بازهٔ زمانی/block per-IP) و netled (RGB آبی/سبز/قرمز) از v15.
- SSID دوم `Google Router Direct` (شبکهٔ ۱۹۲.۱۶۸.۱۱.۰/۲۴، همیشه مستقیم بدون پروکسی).
- LAN ثابت ۱۹۲.۱۶۸.۱۰.۱، رمز root خالی، hostname `Google`، timezone تهران.

### تغییرات کد (شماره‌دار)
1. `build_v16.sh` — اسکریپت بیلد ImageBuilder (لاک‌داکر `owrt_ib`، `/work`): `PKGS="luci luci-app-passwall xray-core chinadns-ng dnsmasq-full kmod-nft-tproxy … -dnsmasq"` + `make image PROFILE=google_wifi FILES=/work/files24`.
2. `files24/` — overlay کامل: `etc/uci-defaults/zz-passwall-defaults` (خاموش‌کردن passwall بدون نود)، `etc/nftables.d/netmon.nft`، `root/netmon/*` (enforce/apply/reset + ucode)، `etc/uci-defaults/zz-netmon`، `usr/lib/netled/netled.sh` + cron، `etc/hotplug.d/iface/90-netled`، `etc/config/luci` (منوی Developer)، seedها در `etc/passwall/` + `etc/uci-defaults/zz-passwall-seed`.
3. `netled.sh` — کنترل LED RGB بر اساس وضعیت پروکسی/اینترنت.
4. حذف وصلهٔ `header.ut` (وابسته به LuCI 25.12 بود) — منوها با JSON کار می‌کنند.
5. `limits.json`/fallbackهای netmon از `phy0-sta0` به `wan`.

### باگ‌های رفع‌شده
- نبود فضای overlay روی 25.12 با پکیج‌های سنگین PassWall2 → با 24.10 + پروفایل سبک حل شد.

### تست‌ها
- بیلد موفق در ImageBuilder داکر؛ فلش `sysupgrade -n` روی 25.12 (اجباری به دلیل apk→opkg).
- بوت تمیز، SSIDهای دوگانه بالا، LAN پاسخگو.

### این نسخه چه چیزی را عوض نکرد
- سخت‌افزار/فلش پارتیشن‌بندی — همان Gale.
- منطق پایهٔ netmon (tc/htb، ucode) — عیناً از v15 پورت شد.

