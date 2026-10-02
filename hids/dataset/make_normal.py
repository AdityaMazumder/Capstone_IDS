import csv

p=r"hids/dataset/normal_process_raw.csv"
f=r"hids/dataset/normal_file_raw.csv"
o=r"hids/dataset/normal.csv"

with open(o,"w",newline="",encoding="utf-8") as out:
    w=csv.writer(out)
    w.writerow(["timestamp","process_name","parent_name","cpu_percent","memory_mb","file_type","event_type","label"])

    with open(p,encoding="utf-8") as x:
        for r in csv.DictReader(x):
            if r["time_iso"] >= "2026-10-02T18:31:51":
                w.writerow([r["timestamp"],r["process_name"],r["parent_name"],r["cpu_percent"],r["memory_mb"],"",r["event"],"Normal"])

    with open(f,encoding="utf-8") as x:
        for r in csv.DictReader(x):
            if r["time_iso"] >= "2026-10-02T18:33:23":
                w.writerow([r["timestamp"],r["process_name"],r["parent_name"],"", "",r["file_type"],r["event_type"],"Normal"])
