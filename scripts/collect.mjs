// 시청자 수를 수집해 snapshots.json에 저장합니다. 하루 한 번은 멤버 정보도 stations.json에 저장합니다.
import fs from "node:fs";

const IDS = "kimdamsu0112,ansungwoo,n1126jmh,ncasia,ysbns9,gusdn1870,me5567,2peung,hjr0408,aeje1129,csh921114,madnug,grireel,rnrrkdqud4,laytenns,sutnyang,ohzi123,wakgooa,jjw1802,ikemen08,kongji0215,nju123,semsemkoo,cmzlsh940501,yeonmak,olypoly,huisak2592,hxox1s,gksrufdma1,wlstn70,maleunesle,raccoon7546".split(",");
const API = "https://chapi.sooplive.co.kr/api";
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; chootuber-gg/1.0)", Accept: "application/json", Referer: "https://www.sooplive.com/" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) {
  const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const kstNow = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 19).replace("T", " ");

const live = {}, failed = [], stations = {}, at = kstNow(), t = Math.floor(Date.now() / 1000);
const old = readJson("stations.json", { stations: {} });
const daily = !old.at || (at.slice(11, 13) >= "20" && old.at.slice(0, 10) !== at.slice(0, 10));
const errors = {};

for (const id of IDS) {
  try {
    const a = await get(`${API}/${id}/station`);
    if (a.broad) live[id] = [+a.broad.current_sum_viewer || 0, String(a.broad.broad_title || "").slice(0, 120)];
    if (daily) {
      const b = await get(`${API}/${id}/vods/review?page=1&per_page=10&orderby=reg_date`), s = a.station || {}, u = s.upd || {}, d = b.data || [];
      stations[id] = {
        nick: s.user_nick || "", fan: u.fan_cnt || 0, secs: s.total_broad_time || 0,
        last: s.broad_start && !s.broad_start.startsWith("0000") ? s.broad_start : "", vodTotal: b.meta?.total ?? d.length,
        vods: d.map(x => [+x.reg_date.slice(2, 10).replace(/-/g, ""), Math.round((x.ucc?.total_file_duration || 0) / 60000), x.title_no, String(x.title_name || "").slice(0, 80)])
      };
    }
  } catch (e) { failed.push(id); errors[e.message] = (errors[e.message] || 0) + 1; }
  await sleep(150);
}
console.log(`수집 ${at}: 방송 중 ${Object.keys(live).length}명, 실패 ${failed.length}명`, errors);
if (failed.length >= 16) { console.error("실패한 멤버가 많아 저장하지 않습니다."); process.exit(1); }

// 최근 7일은 10분 단위로, 그 이전은 1시간에 한 건만 남깁니다.
const seenHours = new Set();
const rows = readJson("snapshots.json", []).filter(x => x.at.slice(0, 15) !== at.slice(0, 15)).filter(x => {
  if (x.t >= t - 7 * 86400) return true;
  const hour = x.at.slice(0, 13);
  if (seenHours.has(hour)) return false;
  seenHours.add(hour);
  return true;
});
rows.push({ t, at, live, failed });
fs.writeFileSync("snapshots.json", JSON.stringify(rows));
if (daily) {
  for (const id of failed) if (old.stations[id]) stations[id] = old.stations[id];
  fs.writeFileSync("stations.json", JSON.stringify({ at, stations }));
}
