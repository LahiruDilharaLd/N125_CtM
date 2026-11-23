"""Build the ENCRYPTED rider database (data.enc.json) from the Google Form responses sheet.

Usage:  ADMIN_PASSWORD='...' python tools/build_data.py Responses.xlsx
The file is AES-256-GCM encrypted; the key comes from  "<username>:<password>"  (PBKDF2-SHA256),
so the public GitHub repo never exposes names, bike numbers or phone numbers.
Never commit the .xlsx or any plain-text copy of the data."""
import sys, os, json, re, base64, getpass
import pandas as pd
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

USER = "syntax"
ITER = 200_000
CONFIG = {                      # sent inside the encrypted payload
    "groupName": os.environ.get("N125_GROUP_NAME", "Pulsar N125 Official Club"),   # shown in the WhatsApp message
}

def phone(v):
    d = re.sub(r"\D", "", str(v))
    if d.startswith("94") and len(d) == 11: return d
    if d.startswith("0") and len(d) == 10: return "94" + d[1:]
    if len(d) == 9: return "94" + d
    return d                     # unusual length: left as typed (digits only)

src = sys.argv[1] if len(sys.argv) > 1 else "Pulsar_N125_Official_Club__Responses_.xlsx"
pw = os.environ.get("ADMIN_PASSWORD") or getpass.getpass("Admin password: ")
df = pd.read_excel(src)
col = lambda k: next(c for c in df.columns if k in c)
cid, cname, cbike, cmob = col("Registration ID"), col("User Name"), col("Bike Registration"), col("Mobile Number")
riders = [{"id": str(r[cid]).strip(), "name": " ".join(str(r[cname]).split()),
           "bike": " ".join(str(r[cbike]).split()).upper(), "phone": phone(r[cmob])}
          for _, r in df.iterrows() if str(r[cid]).strip() not in ("", "nan")]
assert len({r["id"].upper() for r in riders}) == len(riders), "duplicate registration IDs"

salt, iv = os.urandom(16), os.urandom(12)
key = PBKDF2HMAC(hashes.SHA256(), 32, salt, ITER).derive(f"{USER}:{pw}".encode())
ct = AESGCM(key).encrypt(iv, json.dumps({"riders": riders, "config": CONFIG}, ensure_ascii=False).encode(), None)
b = lambda x: base64.b64encode(x).decode()
json.dump({"v": 1, "iter": ITER, "salt": b(salt), "iv": b(iv), "ct": b(ct)}, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data", "data.enc.json"), "w"))
print(len(riders), "riders encrypted ->", "data.enc.json")
