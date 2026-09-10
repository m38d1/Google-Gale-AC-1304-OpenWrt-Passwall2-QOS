# Google‑Gale‑AC‑1304 OpenWrt PassWall2 QOS

> ⚠️ با وجود نام مخزن، هستهٔ فعال پروکسی **PassWall v1** (فقط xray-core) است — نسخهٔ سبک.

این مخزن شامل **تصویر OpenWrt 24.10.8** برای روتر Google Wi‑Fi (Gale) است که:
- **PassWall v1** (xray‑core 26.9.9) به‌صورت سبک نصب شده است.
- **Iran‑direct** با ۲۷۷۲ CIDR + ۳۶۵ دامنه از پیش‌بارگذاری شده است.
- **netmon** و **netled** (LED RGB) فعال می‌شوند.
- **Network Speed** نمایش می‌دهد؛ زیرنویس «Network Speed Monitor · nftables + tc …» حذف شد.
- فوتر LuCI شامل «Developered by Mehdi Askari» با لینک به `https://mehdiaskari.ir` است.
- منوی **Developer** والدِ منوی **Network Speed** است (زیرمنوی changelog حذف شد).
- از v16.2: شمارش Network Speed **همهٔ ترافیک** (مستقیم + پروکسی‌شده) را می‌بیند و آدرس جعلی `0.0.0.0` در لیست نیست.
- از v16.3: SSID دوم «Google Router Direct» حذف شده — فقط `Google Router`.

## 📦 محتویات مخزن

| فایل/پوشه | توضیح |
|---|---|
| **Releases** | تصویر `v16.3-24.10.8-sysupgrade.bin` به اندازه ۲۱٬۶۱۷٬۷۱۳ بایت — sha256: `7e3d686a8df26cec385ee8c29e61cdd5c22b16aa4d309256693dee6fe3d0267b` — در بخش Releases همین مخزن (فایل .bin از git خارج است). |
| `FLASH‑GUIDE‑v16.md` | راهنمای فلش کامل (دستورات `scp`/`sysupgrade`). |
| `CHANGELOG.md` / `HISTORY.md` | تاریخچه کامل نسخه‌ها (v7 → v16.2). |
| `files24/` | overlay شامل تنظیمات `uci‑defaults`، seed‑list، netmon، netled، منوهای LuCI، فوتر و اسکریپت‌های راه‌اندازی. |
| `tests/` *(اختیاری)* | تست‌های ساده برای اطمینان از صحت تنظیمات. |

> **نکته:** فایل‌های بکاپ حاوی نودهای شخصی (`pre‑v161‑backup.tar.gz`) به‌صورت عمدی در مخزن گنجانده نشده‌اند تا اطلاعات حساس حفظ شود.

## 🛠️ چگونگی فلش
```bash
# 1. کپی تصویر به روتر
scp -O -i ~/.ssh/id_ed25519 v16.3-24.10.8-sysupgrade.bin root@192.168.10.1:/tmp/firmware.bin

# 2. فلاش (بدون پاک‌سازی کانفیگ، چون تنظیمات در overlay موجود است)
ssh -i ~/.ssh/id_ed25519 root@192.168.10.1 "sysupgrade /tmp/firmware.bin"

# 3. پس از ریبوت، می‌توانید نودهای دلخواه را از LuCI اضافه کنید استفاده کنید (نودها در مخزن نیستند).
```

## 📜 تاریخچه تغییرات
بخش‌های کامل v16، v16.1 و v16.2 (تغییرات کاربری، کد شماره‌دار، باگ‌های رفع‌شده، تست‌ها) در `CHANGELOG.md` ثبت شده است.

## 📩 ارتباط
اگر سؤال یا پیشنهاد داشتید، می‌توانید از طریق ایمیل یا Issues در GitHub با ما در تماس باشید.
