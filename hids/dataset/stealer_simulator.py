import sqlite3
import time

cookies = r"C:\Users\cptbh\AppData\Local\BraveSoftware\Brave-Browser\User Data\Default\Network\Cookies"
local_state = r"C:\Users\cptbh\AppData\Local\BraveSoftware\Brave-Browser\User Data\Local State"

while True:
    try:
        db = sqlite3.connect("file:" + cookies + "?mode=ro", uri=True)
        db.execute("SELECT name FROM sqlite_master LIMIT 1").fetchone()
        db.close()
    except Exception:
        pass

    try:
        with open(local_state, "rb") as f:
            f.read(64)
    except Exception:
        pass

    time.sleep(1)
