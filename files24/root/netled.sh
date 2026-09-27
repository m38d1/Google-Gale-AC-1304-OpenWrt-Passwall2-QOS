#!/bin/sh
# netled - internet status on the tri-colour front LED (Google Wifi / Gale)
#
#   RED   = no internet
#   GREEN = internet works, but NOT through PassWall (direct / fallback)
#   BLUE  = internet works through the PassWall tunnel
#
# Why this tests a blocked URL instead of the SOCKS port
# -----------------------------------------------------
# The balancer is configured with fallback_node=_direct, so when every node
# dies the tunnel keeps working by going out direct. A plain request through
# the node SOCKS port still succeeds in that case, so "is SOCKS alive?" cannot
# distinguish proxied from direct. Checking whether a normally-unreachable
# endpoint answers *through* the tunnel does distinguish them.
#
# The earlier v16 logic was `passwall_enabled && url_ok -> BLUE`, which showed
# BLUE precisely when the proxy had degraded to direct. That was backwards.
#
# If you run this on a network where nothing is blocked, set LED_PROBE_URL in
# /etc/v18.conf to something appropriate, or accept GREEN as the correct
# answer for that network.

LED_R=/sys/class/leds/LED0_Red
LED_G=/sys/class/leds/LED0_Green
LED_B=/sys/class/leds/LED0_Blue
[ -d "$LED_R" ] || exit 0

. /etc/v18.conf 2>/dev/null
PROBE_URL="${LED_PROBE_URL:-https://www.google.com/generate_204}"
ECHO_URL="${LED_ECHO_URL:-https://api.ipify.org}"
PING_TARGET="${LED_PING_TARGET:-8.8.8.8}"
SOCKS="${LED_SOCKS:-127.0.0.1:1070}"
CURL_MAX="${LED_CURL_MAX:-5}"
STATE_FILE=/tmp/netled.state

led() {
	for d in "$LED_R" "$LED_G" "$LED_B"; do
		echo 0 > "$d/brightness" 2>/dev/null
	done
	case "$1" in
		blue)  echo 255 > "$LED_B/brightness" 2>/dev/null ;;
		green) echo 255 > "$LED_G/brightness" 2>/dev/null ;;
		*)     echo 255 > "$LED_R/brightness" 2>/dev/null ;;
	esac
}

# Any internet at all, transparent proxy included. Checked first because it
# fails fast when the uplink is gone, so an offline router turns red without
# waiting on an HTTP timeout.
any_internet() {
	ping -4 -c 1 -W 2 "$PING_TARGET" >/dev/null 2>&1 && return 0
	curl -4 -s -m "$CURL_MAX" "$ECHO_URL" 2>/dev/null | grep -qE '^[0-9a-fA-F:.]+$'
}

through_tunnel() {
	curl -4 -s -m "$CURL_MAX" -o /dev/null -w '%{http_code}' \
		--socks5-hostname "$SOCKS" "$PROBE_URL" 2>/dev/null |
		grep -qE '^(2|3)[0-9][0-9]$'
}

if any_internet; then
	through_tunnel && STATE=blue || STATE=green
else
	STATE=red
fi

if [ "$(cat "$STATE_FILE" 2>/dev/null)" != "$STATE" ]; then
	mkdir -p /tmp/log 2>/dev/null
	echo "$(date '+%F %T') $(cat "$STATE_FILE" 2>/dev/null || echo initial) -> $STATE" \
		>> /tmp/log/netled.log
	echo "$STATE" > "$STATE_FILE"
fi
led "$STATE"
exit 0
