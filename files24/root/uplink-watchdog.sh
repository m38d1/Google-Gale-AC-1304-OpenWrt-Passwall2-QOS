#!/bin/sh
# uplink-watchdog - reports which uplink is carrying traffic, and nudges a
# dead one back to life.
#
# It does NOT move routes. Failover is the kernel's job (see the metric notes
# in zz-uplink). An earlier version of this script did ifdown/ifup on the
# interfaces and oscillated: its reachability probe followed whichever uplink
# owned the default route, so the "primary is down" verdict was really "the
# standby stole the route", and the two interfaces flapped against each other.
# Monitoring is all this needs to do.
STATE_DIR=/tmp/uplink
ACTIVE=$STATE_DIR/active
mkdir -p "$STATE_DIR"

. /etc/v18.conf 2>/dev/null
THRESH_RECOVER="${UPLINK_RECOVER_THRESHOLD:-3}"
C1=$(cat "$STATE_DIR/nc1" 2>/dev/null || echo 0)
C2=$(cat "$STATE_DIR/nc2" 2>/dev/null || echo 0)

dev_of() {
	ifstatus "$1" 2>/dev/null | jsonfilter -e '@.l3_device' 2>/dev/null
}

has_carrier() {
	d=$(dev_of "$1")
	[ -n "$d" ] || return 1
	iw dev "$d" link 2>/dev/null | grep -q 'Connected to'
}

# Which interface owns the lowest-metric default route right now?
active_uplink() {
	ip route show default 2>/dev/null |
		awk '{for(i=1;i<=NF;i++) if($i=="dev"){d=$(i+1)}}
		     d!=""{print d; exit}'
}

now=$(active_uplink)
was=$(cat "$ACTIVE" 2>/dev/null)
if [ -n "$now" ] && [ "$now" != "$was" ]; then
	case "$now" in
		phy0-sta0) name="primary (2.4GHz)" ;;
		phy1-sta0) name="standby (5GHz)" ;;
		*)         name="$now" ;;
	esac
	echo "$(date '+%F %T') active uplink: $name" >> /tmp/log/uplink.log 2>/dev/null
	echo "$now" > "$ACTIVE"
fi

# An upstream router that rebooted can leave a station associated to nothing.
# Re-running ifup makes netifd re-scan and re-associate.
[ "$C1" -lt "$THRESH_RECOVER" ] && [ -n "${UPLINK1_SSID:-}" ] && {
	if has_carrier wan; then echo 0 > "$STATE_DIR/nc1"
	else
		echo $((C1+1)) > "$STATE_DIR/nc1"
		[ "$C1" -ge $((THRESH_RECOVER-1)) ] && {
			echo "$(date '+%F %T') primary has no carrier, re-associating" \
				>> /tmp/log/uplink.log 2>/dev/null
			ifup wan; echo 0 > "$STATE_DIR/nc1"
		}
	fi
}
[ "$C2" -lt "$THRESH_RECOVER" ] && [ -n "${UPLINK2_SSID:-}" ] && {
	if has_carrier wwan2; then echo 0 > "$STATE_DIR/nc2"
	else
		echo $((C2+1)) > "$STATE_DIR/nc2"
		[ "$C2" -ge $((THRESH_RECOVER-1)) ] && {
			echo "$(date '+%F %T') standby has no carrier, re-associating" \
				>> /tmp/log/uplink.log 2>/dev/null
			ifup wwan2; echo 0 > "$STATE_DIR/nc2"
		}
	fi
}
exit 0
