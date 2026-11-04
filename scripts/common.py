"""共用工具：路徑、JSON 讀寫、HTTP。"""
import json, os, datetime, urllib.request, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "web", "data", "v1")
UA = "TW-Badminton-Info-Bot/1.0 (+https://github.com/cd60515/TW_BEDMINTON_INFO)"
TZ = datetime.timezone(datetime.timedelta(hours=8))

CITIES = ["臺北市", "新北市", "基隆市", "桃園市", "新竹市", "新竹縣", "苗栗縣", "臺中市",
          "彰化縣", "南投縣", "雲林縣", "嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣",
          "宜蘭縣", "花蓮縣", "臺東縣", "澎湖縣", "金門縣", "連江縣"]
CITY_SLUG = {"臺北市": "taipei", "新北市": "new-taipei", "基隆市": "keelung", "桃園市": "taoyuan",
             "新竹市": "hsinchu-city", "新竹縣": "hsinchu-county", "苗栗縣": "miaoli", "臺中市": "taichung",
             "彰化縣": "changhua", "南投縣": "nantou", "雲林縣": "yunlin", "嘉義市": "chiayi-city",
             "嘉義縣": "chiayi-county", "臺南市": "tainan", "高雄市": "kaohsiung", "屏東縣": "pingtung",
             "宜蘭縣": "yilan", "花蓮縣": "hualien", "臺東縣": "taitung", "澎湖縣": "penghu",
             "金門縣": "kinmen", "連江縣": "lienchiang"}


def now_iso():
    return datetime.datetime.now(TZ).replace(microsecond=0).isoformat()


def today():
    return datetime.datetime.now(TZ).date().isoformat()


def path(*p):
    return os.path.join(DATA, *p)


def load(name, default=None):
    p = path(name)
    if not os.path.exists(p):
        return default
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def save(name, obj, compact=False):
    p = path(name)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        if compact:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")


def get(url, params=None, timeout=30, headers=None):
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    h = {"User-Agent": UA, "Accept-Language": "zh-TW,zh;q=0.9"}
    h.update(headers or {})
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")
