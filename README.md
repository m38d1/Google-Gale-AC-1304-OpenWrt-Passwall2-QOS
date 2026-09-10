# Google‑Gale‑AC‑1304 OpenWrt PassWall2 QOS

> ⚠️ با وجود نام مخزن، هستهٔ فعال پروکسی **PassWall v1** (فقط xray-core) است — نسخهٔ سبک.

این مخزن شامل **تصویر OpenWrt 24.10.8** برای روتر Google Wi‑Fi (Gale) است که:
- **PassWall v1** (xray‑core 26.9.8) به‌صورت سبک نصب شده است.
- **Iran‑direct** با ۲۷۷۲ CIDR + ۳۶۵ دامنه از پیش‌بارگذاری شده است.
- **netmon** و **netled** (LED RGB) فعال می‌شوند.
- **Network Speed** نمایش می‌دهد؛ زیرنویس «Network Speed Monitor · nftables + tc …» حذف شد.
- فوتر LuCI شامل «Developered by Mehdi Askari» با لینک به `https://mehdiaskari.ir` است.
- منوی **Developer** والدِ منوی **Network Speed** است (زیرمنوی changelog حذف شد).

## 📦 محتویات مخزن

| فایل/پوشه | توضیح |
|---|---|
| `v16.1-24.10.8-sysupgrade.bin` | تصویر باینری نهایی (sha256: `e5d0b195005a20a9a5098af380a00b7f6211268d8d57d1f5d96ce9460ad48f5d`). |
| `FLASH‑GUIDE‑v16.md` | راهنمای فلش کامل (دستورات `scp`/`sysupgrade`). |
| `files24/` | overlay شامل تنظیمات `uci‑defaults`، seed‑list، netmon، netled، منوهای LuCI، فوتر و اسکریپت‌های راه‌اندازی. |
| `tests/` *(اختیاری)* | تست‌های ساده برای اطمینان از صحت تنظیمات. |

> **نکته:** فایل‌های بکاپ حاوی نودهای شخصی (`pre‑v161‑backup.tar.gz`) به‌صورت عمدی در مخزن گنجانده نشده‌اند تا اطلاعات حساس حفظ شود.

## 🛠️ چگونگی فلش
```bash
# 1. کپی تصویر به روتر
scp -i ~/.ssh/id_ed25519 v16.1-24.10.8-sysupgrade.bin root@192.168.10.1:/tmp/firmware.bin

# 2. فلاش (بدون پاک‌سازی کانفیگ، چون تنظیمات در overlay موجود است)
ssh -i ~/.ssh/id_ed25519 root@192.168.10.1 "sysupgrade /tmp/firmware.bin"

# 3. پس از ریبوت، می‌توانید نودهای دلخواه را از LuCI اضافه کنید استفاده کنید (نودها در مخزن نیستند).
```

## 📜 تاریخچه تغییرات
قصد می‌گذاریم برای هر نسخهٔ جدید یک بخش «## Changes» در `CHANGELOG.md` اضافه کنیم. در این نسخهٔ اولیه فقط موارد بالا گنجانده شده‌اند.

## 📩 ارتباط
اگر سؤال یا پیشنهاد داشتید، می‌توانید از طریق ایمیل یا Issues در GitHub با ما در تماس باشید.
