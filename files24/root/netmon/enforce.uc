// netmon enforce: quota + time-window internet blocking + persistent usage.
// Invoked by enforce.sh (cron, every minute). Reads nft byte-counter dumps +
// limits.json, accumulates per-device usage (period + all-time total that
// survive reboots), decides block state, writes qstate.json (for the LuCI
// view) and a block.nft batch (applied by shell).
//
// ARGV: [epoch, HH:MM, YYYY-MM-DD, YYYY-MM, YYYY-Www, qup.json, qdown.json,
//        cfgpath, statepath, blockpath]
import * as fs from "fs";

let a = ARGV;
let now_hm = a[1];
let day_key = a[2];
let month_key = a[3];
let week_key = a[4];

function readjson(p, def) {
	let s = null, d = null;
	try { s = fs.readfile(p); } catch (e) { s = null; }
	if (s != null && s != "") { try { d = json(s); } catch (e) { d = null; } }
	return d == null ? def : d;
}

// read persistent state with a .bak fallback (survives power loss mid-write)
function read_state(p, def) {
	let s = null, d = null;
	try { s = fs.readfile(p); } catch (e) { s = null; }
	if (s != null && s != "") { try { d = json(s); } catch (e) { d = null; } }
	if (d != null) return d;
	try { s = fs.readfile(p + ".bak"); } catch (e) { s = null; }
	if (s != null && s != "") { try { d = json(s); } catch (e) { d = null; } }
	return d == null ? def : d;
}

let qup = readjson(a[5], { nftables: [] });
let qdown = readjson(a[6], { nftables: [] });
let cfgpath = a[7], statepath = a[8], blockpath = a[9];

// build ip -> cumulative bytes from an `nft -j list set` dump
function bytes_map(dump) {
	let m = {};
	for (let o in dump.nftables) {
		if (o && o.set && o.set.elem) {
			for (let el in o.set.elem) {
				let x = el.elem;
				if (x && x.val)
					m[x.val] = (x.counter && x.counter.bytes) ? x.counter.bytes : 0;
			}
		}
	}
	return m;
}
let up = bytes_map(qup);
let down = bytes_map(qdown);

let cfg = readjson(cfgpath, {});
let state = read_state(statepath, {});

function to_min(hm) {
	if (hm == null || length(hm) < 5) return null;
	return (substr(hm, 0, 2) * 1) * 60 + (substr(hm, 3, 2) * 1);
}
let now_min = to_min(now_hm);

// true if current time is OUTSIDE the allowed [start,end] window
function outside_window(start, end) {
	let s = to_min(start), e = to_min(end);
	if (s == null || e == null || now_min == null) return false;
	if (s == e) return false;
	if (s < e) return !(now_min >= s && now_min <= e);
	return !(now_min >= s || now_min <= e); // overnight window
}

function period_key(period) {
	if (period == "monthly") return month_key;
	if (period == "weekly") return week_key;
	return day_key;
}

// every IP we have ever seen or that has a rule gets persistent accounting
let ips = {};
for (let ip in up) ips[ip] = true;
for (let ip in down) ips[ip] = true;
for (let ip in cfg) { if (ip != "__global_settings") ips[ip] = true; }

let blocked_ips = [];

for (let ip in ips) {
	let dev = cfg[ip];
	let hasrule = (dev != null && type(dev) == "object");

	let st = state[ip];
	if (st == null)
		st = { used_mb: 0, total_up_mb: 0, total_down_mb: 0, sess_up_mb: 0, sess_down_mb: 0, last_up: 0, last_down: 0, pbase_up: 0, pbase_down: 0, period_key: "", blocked: false, reason: "" };
	state[ip] = st;
	if (st.total_up_mb == null) st.total_up_mb = 0;
	if (st.total_down_mb == null) st.total_down_mb = 0;
	if (st.last_up == null) st.last_up = 0;
	if (st.last_down == null) st.last_down = 0;
	if (st.pbase_up == null) st.pbase_up = 0;
	if (st.pbase_down == null) st.pbase_down = 0;

	let cu = up[ip] || 0;
	let cd = down[ip] || 0;
	let pk = period_key(hasrule ? (dev.period || "daily") : "daily");

	// all-time totals: accumulate EVERY byte, including the counter already
	// present the first time we see a device -> guarantees total >= session.
	let du = cu >= st.last_up ? (cu - st.last_up) : cu;   // reboot/flush -> cu<last -> recount from 0
	let dd = cd >= st.last_down ? (cd - st.last_down) : cd;
	st.last_up = cu; st.last_down = cd;
	st.total_up_mb = st.total_up_mb + du / 1048576.0;
	st.total_down_mb = st.total_down_mb + dd / 1048576.0;

	// period (quota) accumulator: independent baseline, resets on rollover
	if (st.period_key != pk) {
		st.period_key = pk; st.pbase_up = cu; st.pbase_down = cd;
	}
	let pu = cu >= st.pbase_up ? (cu - st.pbase_up) : cu;
	let pd = cd >= st.pbase_down ? (cd - st.pbase_down) : cd;
	st.used_mb = (pu + pd) / 1048576.0;

	// raw session counters (since boot / last flush) from the SAME sets
	st.sess_up_mb = cu / 1048576.0;
	st.sess_down_mb = cd / 1048576.0;

	let blocked = false, reason = "";
	if (hasrule) {
		let quota = dev.quota_mb || 0;
		if (quota > 0 && st.used_mb >= quota) { blocked = true; reason = "quota"; }
		if (!blocked && outside_window(dev.t_start, dev.t_end)) { blocked = true; reason = "time"; }
		if (!blocked && dev.blocked == true) { blocked = true; reason = "manual"; }
	}
	st.blocked = blocked;
	st.reason = reason;
	if (blocked) push(blocked_ips, ip);
}

// hand-build JSON (ucode json() only parses)
let parts = [];
for (let ip in state) {
	let s = state[ip];
	push(parts, sprintf("\"%s\":{\"used_mb\":%s,\"total_up_mb\":%s,\"total_down_mb\":%s,\"sess_up_mb\":%s,\"sess_down_mb\":%s,\"last_up\":%d,\"last_down\":%d,\"pbase_up\":%d,\"pbase_down\":%d,\"period_key\":\"%s\",\"blocked\":%s,\"reason\":\"%s\"}",
		ip,
		(s.used_mb == null ? "0" : "" + s.used_mb),
		(s.total_up_mb == null ? "0" : "" + s.total_up_mb),
		(s.total_down_mb == null ? "0" : "" + s.total_down_mb),
		(s.sess_up_mb == null ? "0" : "" + s.sess_up_mb),
		(s.sess_down_mb == null ? "0" : "" + s.sess_down_mb),
		(s.last_up == null ? 0 : s.last_up),
		(s.last_down == null ? 0 : s.last_down),
		(s.pbase_up == null ? 0 : s.pbase_up),
		(s.pbase_down == null ? 0 : s.pbase_down),
		(s.period_key == null ? "" : s.period_key),
		(s.blocked ? "true" : "false"),
		(s.reason == null ? "" : s.reason)));
}
let jsonout = "{" + join(",", parts) + "}\n";
// atomic write: temp file + rename (rename is atomic on f2fs/overlay), so a
// power cut can never leave a half-written qstate.json. Keep a .bak as fallback.
fs.writefile(statepath + ".tmp", jsonout);
fs.rename(statepath + ".tmp", statepath);
fs.writefile(statepath + ".bak", jsonout);

// emit nft batch: atomically replace nm_block membership
let out = "flush set inet fw4 nm_block\n";
if (length(blocked_ips) > 0)
	out += "add element inet fw4 nm_block { " + join(", ", blocked_ips) + " }\n";
fs.writefile(blockpath, out);
