#!/bin/sh
# netled — status LED controller for Google Wifi (Gale, LP5523 RGB LED)
# BLUE  = Passwall enabled and internet reachable
# GREEN = Passwall disabled and internet reachable
# RED   = No internet or other issues

LED_R=/sys/class/leds/LED0_Red
LED_G=/sys/class/leds/LED0_Green
LED_B=/sys/class/leds/LED0_Blue

[ -d "$LED_R" ] || exit 0

led() {
	for d in "$LED_R" "$LED_G" "$LED_B"; do
		echo none > "$d/trigger" 2>/dev/null
	done
	echo "$1" > "$LED_R/brightness" 2>/dev/null
	echo "$2" > "$LED_G/brightness" 2>/dev/null
	echo "$3" > "$LED_B/brightness" 2>/dev/null
}

code() {
	/usr/bin/curl -I -o /dev/null -skL --connect-timeout 4 -m 6 -w %{http_code} "$1" 2>/dev/null
}

ok() {
	c=$(code "$1")
	[ "$c" = "200" ] || [ "$c" = "204" ]
}

# Check if Passwall is enabled
passwall_enabled() {
	uci -q get passwall.@global[0].enabled | grep -q '1'
}

# 1) Passwall enabled and internet reachable -> BLUE
if passwall_enabled && (ok "https://www.youtube.com/generate_204" || ok "https://www.google.com/generate_204"); then
	led 0 0 255
	exit 0
fi

# 2) Passwall disabled and internet reachable -> GREEN
if ! passwall_enabled && (ok "https://cp.cloudflare.com/generate_204" || ok "https://www.digikala.com/"); then
	led 0 255 0
	exit 0
fi

# 3) No internet or other issues -> RED
led 255 0 0
exit 0
