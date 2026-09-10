# راهنمای فلش v16.3 — OpenWrt 24.10.8 + PassWall سبک + ایران‌دایرکتِ لیست‌دستی

## فایل
- `v16.3-24.10.8-sysupgrade.bin` (۲۱٬۶۱۷٬۷۱۳ بایت)
- sha256: `7e3d686a8df26cec385ee8c29e61cdd5c22b16aa4d309256693dee6fe3d0267b`
- پایه: رسمی `openwrt-24.10.8-ipq40xx-chromium` (kernel `6.6.144`)، پروفایل `google_wifi` (Gale)
- v16/v16.1/v16.2 جایگزین‌شده با همین فایل

## داخل چیست
| بخش | وضعیت |
|---|---|
| PassWall v1 | `26.9.9-r1` — تنظیمات آمادهٔ بذری‌شده (`zz-passwall-tuned`: DNS shunt=chinadns-ng، tcp/udp=proxy، localhost_proxy، پورت‌ها، ۶ shunt_rule) — **خاموش و بدون نود** |
| هستهٔ پروکسی | فقط `xray-core 26.9.9` (سبک؛ بدون sing-box/ssr/hysteria/geoip) |
| ایران‌دایرکت | ۲۷۷۲ CIDR + ۳۶۵ دامنه، بذری‌شده در `rules/direct_ip` و `direct_host` (خودترمیم در هر بوت) |
| تبلیغات | `block_host` با لیست seed |
| netmon | سهمیه/بازهٔ زمانی per-IP (`tc`+`nft`) — **شمارش از `prerouting`/`postrouting` تا ترافیک پروکسی‌شده هم درست حساب شود (رفع v16.3)**؛ آدرس‌های خاص (0.0.0.0/255.255.255.255) فیلترند |
| netled | چراغ RGB: آبی/سبز/قرمز (curl با `-4`) |
| SSID | فقط `Google Router` (هر دو باند) — SSID دوم Direct در v16.3 حذف شد |
| LAN | ۱۹۲.۱۶۸.۱۰.۱ · رمز root: خالی · hostname: `Google` · timezone: تهران |
| منوها | LuCI: `Developer` (والد) → `Network Speed` |
| فوتر LuCI | `… / Developered by Mehdi Askari` — لینک به `https://mehdiaskari.ir` |

## فلش
- **روی v16/v16.1/v16.3 (opkg 24.10):** بدون `-n` — کانفیگ و نودها می‌مانند:
```sh
scp -O -i ~/.ssh/id_ed25519 v16.3-24.10.8-sysupgrade.bin root@192.168.10.1:/tmp/v162.bin
ssh -i ~/.ssh/id_ed25519 root@192.168.10.1 "sysupgrade /tmp/v162.bin"
```
- **روی 25.12.5 (apk):** حتماً با `-n` (پاک‌سازی کانفیگ).
- روتر ۲-۳ دقیقه ریبوت می‌شود؛ SSID و LAN ثابت می‌مانند.
- اگر اینترنت بعد از بوت تا ~۱ دقیقه take نکرد، یک `service passwall restart` کافی است (balancer تازه سرور را انتخاب کند).

## بعد از فلش (فقط این‌ها دستی است)
1. `ssh root@192.168.10.1` (بدون رمز)
2. کلید عمومی `~/.ssh/id_ed25519.pub` را به `/etc/dropbear/authorized_keys` اضافه کن
3. نودها را در LuCI اضافه کن (VLESS Reality دبی/ترکیه/ایتالیا + Balancer اصلی) و PassWall را enable کن — گاردِ `zz-passwall-tuned` در آپگریدِ keep-config نودهای موجود را پاک نمی‌کند
4. تست: `curl -4 -I https://www.google.com` از LAN؛ چراغ آبی؛ صفحهٔ Network Speed باید ترافیک همه (حتی یوتیوب تلویزیون) را زنده نشان دهد

## نکته‌ها
- WAN سیمی یا بی‌سیم (`phy0-sta0`): هر دو کار می‌کنند؛ شمارش netmon روی `br-lan` است و مستقل از مسیر خروجی.
- `add-nodes-v16.sh` منسوخ (نود UK غلط) — نودها از بکاپ محلی `~/owrt_build/backup/pre-v16-backup.tar.gz`.
- فاکتوری‌ریست = همه‌چیز برمی‌گردد به تنظیمات this build؛ فقط نودها دوباره دستی.
