#!/bin/sh
# Apply per-device bandwidth limits using tc + htb.
# Stored rates in limits.json are in KB/s; tc htb wants kbit/s -> multiply by 8.
#   Upload  : htb on WAN egress, u32 filter by source IP.
#   Download: htb on ifb0 (WAN ingress redirected), u32 filter by dest IP.
CONFIG=/root/netmon/limits.json
PARSER=/root/netmon/parse.uc
[ -f "$CONFIG" ] || exit 0

# Parse JSON robustly via ucode (handles pretty-printed / multi-line JSON).
PARSED=$(ucode "$PARSER" "$CONFIG" 2>/dev/null)
[ -z "$PARSED" ] && exit 0

GLINE=$(printf '%s\n' "$PARSED" | grep '^G ')
MAXDL=$(printf '%s\n' "$GLINE" | awk '{print $2}')
MAXUL=$(printf '%s\n' "$GLINE" | awk '{print $3}')
LAN=$(printf '%s\n' "$GLINE" | awk '{print $4}')
WAN=$(printf '%s\n' "$GLINE" | awk '{print $5}')
[ -z "$WAN" ] && WAN=wan
[ -z "$LAN" ] && LAN=br-lan
[ -z "$MAXDL" ] && MAXDL=12500
[ -z "$MAXUL" ] && MAXUL=12500

DEVS=$(printf '%s\n' "$PARSED" | grep '^D ')

# Clear any previous QoS setup
tc qdisc del dev "$WAN" root 2>/dev/null
tc qdisc del dev "$WAN" ingress 2>/dev/null
tc qdisc del dev "$LAN" root 2>/dev/null
tc qdisc del dev ifb0 root 2>/dev/null

# Nothing to shape if no device rules at all
[ -z "$DEVS" ] && exit 0

# ---------- Upload limiting (egress on WAN) ----------
tc qdisc add dev "$WAN" root handle 1: htb default 9999
tc class add dev "$WAN" parent 1: classid 1:1 htb rate $((MAXUL*8))kbit
tc class add dev "$WAN" parent 1:1 classid 1:9999 htb rate $((MAXUL*8))kbit ceil $((MAXUL*8))kbit prio 4

# ---------- Download limiting (ingress on WAN -> ifb0) ----------
IFB_OK=0
modprobe ifb 2>/dev/null
ip link add ifb0 type ifb 2>/dev/null
ip link set ifb0 up 2>/dev/null
if ip link show ifb0 >/dev/null 2>&1; then
    IFB_OK=1
    tc qdisc add dev ifb0 root handle 1: htb default 9999
    tc class add dev ifb0 parent 1: classid 1:1 htb rate $((MAXDL*8))kbit
    tc class add dev ifb0 parent 1:1 classid 1:9999 htb rate $((MAXDL*8))kbit ceil $((MAXDL*8))kbit prio 4
    tc qdisc add dev "$WAN" ingress 2>/dev/null
    tc filter add dev "$WAN" parent ffff: protocol ip u32 match u32 0 0 action mirred egress redirect dev ifb0 2>/dev/null
fi

# htb prio: 1 = High, 4 = Normal (default), 7 = Low. Lower number is served
# first when the link is congested. A device gets its own class if it has a
# bandwidth cap OR a non-normal priority (priority-only devices still matter).
id=10
printf '%s\n' "$DEVS" | while read -r tag ip dl ul prio; do
    [ "$tag" = "D" ] || continue
    [ -z "$ip" ] && continue
    [ -z "$dl" ] && dl=0
    [ -z "$ul" ] && ul=0
    [ -z "$prio" ] && prio=4
    if [ "$dl" -gt 0 ] || [ "$ul" -gt 0 ] || [ "$prio" != "4" ]; then
        uceil=$ul; [ "$uceil" -le 0 ] && uceil=$MAXUL
        dceil=$dl; [ "$dceil" -le 0 ] && dceil=$MAXDL
        if [ "$uceil" -gt 0 ]; then
            tc class add dev "$WAN" parent 1:1 classid 1:$id htb rate $((uceil*8))kbit ceil $((uceil*8))kbit prio $prio 2>/dev/null
            tc filter add dev "$WAN" parent 1: protocol ip u32 match ip src "$ip" flowid 1:$id 2>/dev/null
        fi
        if [ "$dceil" -gt 0 ] && [ "$IFB_OK" = "1" ]; then
            tc class add dev ifb0 parent 1:1 classid 1:$id htb rate $((dceil*8))kbit ceil $((dceil*8))kbit prio $prio 2>/dev/null
            tc filter add dev ifb0 parent 1: protocol ip u32 match ip dst "$ip" flowid 1:$id 2>/dev/null
        fi
        id=$((id + 1))
    fi
done
exit 0
