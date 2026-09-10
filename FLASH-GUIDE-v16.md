# راهنمای فلش v16.1 — OpenWrt 24.10.8 + PassWall سبک + ایران‌دایرکتِ لیست‌دستی

## فایل
- `~/owrt_build/output/v16.1-24.10.8-sysupgrade.bin` (۲۱,۶۲۷,۹۵۳ بایت)
- sha256: `e5d0b195005a20a9a5098af380a00b7f6211268d8d57d1f5d96ce9460ad48f5d`
- پایه: رسمی `openwrt-24.10.8-ipq40xx-chromium` (kernel `6.6.144`)، پروفایل `google_wifi` (Gale)
- v16 قدیمی (`v16-24.10.8-sysupgrade.bin`) = همان ایمیجِ بدون تنظیمات بذری‌شدهٔ PassWall؛ v16.1 جایگزینش می‌شود

## داخل چیست
| بخش | وضعیت |
|---|---|
| PassWall v1 | `26.9.9-r1` — تنظیمات آمادهٔ بذری‌شده (`zz-passwall-tuned`: DNS shunt=chinadns-ng، tcp/udp=proxy، localhost_proxy، پورت‌ها، ۶ shunt_rule) — **خاموش و بدون نود** |
| هستهٔ پروکسی | فقط `xray-core 26.9.8` (سبک؛ بدون sing-box/ssr/hysteria/geoip) |
| ایران‌دایرکت | ۲۷۷۲ CIDR + ۳۶۵ دامنه، بذری‌شده در `rules/direct_ip` و `direct_host` (خودترمیم در هر بوت) |
| تبلیغات | `block_host` با لیست seed |
| netmon | سهمیه/بازهٔ زمانی per-IP (`tc`+`nft`) — `wan_if=wan` |
| netled | چراغ RGB: آبی/سبز/قرمز |
| SSID | `Google Router` (هر دو باند، باز) + `Google Router Direct` (۱۹۲.۱۶۸.۱۱.۰/۲۴، همیشه مستقیم) |
| LAN | ۱۹۲.۱۶۸.۱۰.۱ · رمز root: خالی · hostname: `Google` · timezone: تهران |
| منوها | LuCI: `Developer` (والد) → `Network Speed` (بدون زیرمنوی changelog) |
| فوتر LuCI | `… / Developered by Mehdi Askari` — لینک به `https://mehdiaskari.ir` |

## فلش
- **روی v16/v16.1 فعلی (همان opkg 24.10):** بدون `-n` — کانفیگ می‌ماند:
```sh
scp -i ~/.ssh/id_ed25519 ~/owrt_build/output/v16.1-24.10.8-sysupgrade.bin root@192.168.10.1:/tmp/v161.bin
ssh -i ~/.ssh/id_ed25519 root@192.168.10.1 "sysupgrade /tmp/v161.bin"
```
- **روی 25.12.5 (apk):** حتماً با `-n` (پاک‌سازی کانفیگ):
```sh
ssh -i ~/.ssh/id_ed25519 root@192.168.10.1 "sysupgrade -n /tmp/v161.bin"
```
- روتر ۲-۳ دقیقه ریبوت می‌شود؛ SSID و LAN ثابت می‌مانند.

## بعد از فلش (فقط این‌ها دستی است)
1. `ssh root@192.168.10.1` (بدون رمز؛ اولین اتصال: `StrictHostKeyChecking=accept-new`)
2. کلید SSH ما را برگردان: کلید عمومی `~/.ssh/id_ed25519.pub` را به `/etc/dropbear/authorized_keys` اضافه کن
3. نودها را دستی در LuCI اضافه کن (VLESS Reality دبی/ترکیه/ایتالیا — مشخصات در `~/owrt_build/backup/pre-v16-backup.tar.gz` → `etc/config/passwall`)، Balancer را نود اصلی کن، بعد PassWall را enable کن
4. تست: `curl -I https://www.google.com` از LAN؛ چراغ باید آبی شود

## نسبت به v15 چه عوض شد
- سبک‌تر: بدون sing-box/ssr/hysteria/naive/v2ray-geoip… (روت‌فس ~۱۸MB در برابر ۵۸MB) → فضای overlay خیلی بیشتر
- پایهٔ رسمی 24.10.8 به‌جای 25.12.5 (کرنل سبک‌تر 6.6، اکوسیستم opkg پایدار)
- حذف وصلهٔ `header.ut` (وابسته به LuCI 25.12 بود) — منوهای netmon/dev با JSON کار می‌کنند
- `limits.json` و fallback های netmon از `phy0-sta0` به `wan` (WAN سیمی فعلی)

## نکتهٔ مهم دربارهٔ نودها (به‌روز شد ۱۴۰۵/۰۶/۱۹)
- `add-nodes-v16.sh` منسوخ شد — نود UK (`ukm`) غلط بود.
- کانفیگ کامل PassWall از بکاپ پیش از فلش (`~/owrt_build/backup/pre-v16-backup.tar.gz`) بازگردانده شد: نودهای واقعی **دبی/ترکیه/ایتالیا** + نود اصلی **Balancer (leastLoad)**، `transport='raw'` بدون flow.
- تست انجام‌شده روی روتر پس از فلش: خروجی خارجی از نود (ترکیه `87.120.106.241`)، aparat/digikala/bmi مستقیم و باز، IP آپارات در ست `psw_white` و قانون `return` مسیر مستقیم فعال — با نود روشن، ایران‌دایرکت کار می‌کند.

## این نسخه چه چیزی را عوض نکرد
- رمز WAN سیمی و توپولوژی شبکه (هنوز ۱۹۲.۱۶۸.۱.۱ بالا-دست است)
- نودها/گذرواژه‌های قبلی (با `-n` پاک می‌شوند؛ از اسکریپت نودها برمی‌گردند)
- AdGuard Home نصب نمی‌شود (مسدودسازی فقط با لیست seed در PassWall)
