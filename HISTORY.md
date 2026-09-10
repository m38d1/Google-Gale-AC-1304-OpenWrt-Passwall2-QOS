# HISTORY — Google Wifi (Gale) Firmware Project

مسیر نسخه‌ها از v7 تا v16.1 (روتر: Google Wifi / Gale / ipq40xx / chromium):

| نسخه | پایه | خلاصه |
|---|---|---|
| v7–v12 | OpenWrt 25.12.5 (apk) | راه‌اندازی ImageBuilder، PassWall کامل، تنظیمات پایه |
| v13–v14 | 25.12.5 | netmon (سهمیه per-IP با nft+tc) و netled (LP5523 RGB) |
| v15 | 25.12.5 | کامل‌ترین نسخهٔ ۲۵.۱۲: netmon + netled + seed ایران‌دایرکت + SSID دوم (`Google Router Direct`) |
| v16 | **24.10.8** (opkg) | مهاجرت به ۲۴.۱۰.۸ با PassWall v1 سبک (فقط xray-core 26.9.8) + لیست‌دستی ایران‌دایرکت (۲۷۷۲ CIDR + ۳۶۵ دامنه) بذری‌شده |
| v16.1 | 24.10.8 | تنظیمات PassWall بذری‌شده (بدون نود) با گارد ضدپاک‌شدن + فوتر اعتبار + منوی Developer والدِ Network Speed + مخزن GitHub |

نکتهٔ مهاجرت 25.12→24.10: فلش با `sysupgrade -n` الزامی (apk→opkg ناسازگار)؛ کانفیگ از بکاپ بازسازی شد.

جزئیات کامل هر نسخه: `CHANGELOG.md` · راهنمای فلش: `FLASH-GUIDE-v16.md` · overlay: `files24/`
