#!/usr/bin/env python3
"""Format and clean up load test summary output into readable text and JSON."""
import sys
import os
import re
import json

def format_summary(run_dir, model="Unknown", workload="Unknown"):
    raw_file = os.path.join(run_dir, "summary.raw.txt")
    out_txt = os.path.join(run_dir, "summary.txt")
    out_json = os.path.join(run_dir, "summary.json")

    # If raw file doesn't exist, check existing summary.txt as raw
    if not os.path.exists(raw_file):
        if os.path.exists(out_txt):
            with open(out_txt, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        else:
            return
    else:
        with open(raw_file, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

    # Strip ANSI escape codes
    clean = re.sub(r"\x1b\[[0-9;]*[a-zA-Z]", "", content)

    # Regex extractions
    samples = re.search(r"samples=(\d+)", clean)
    start_time = re.search(r"startTime=([^\s]+)", clean)
    load_stop = re.search(r"loadStopTime=([^\s]+)", clean)
    end_time = re.search(r"endTime=([^\s]+)", clean)
    tps = re.search(r"tps=([\d\.]+)", clean)
    rps = re.search(r"rps=([\d\.]+)", clean)
    errors = re.search(r"numErrors=(\d+)", clean)
    duration = re.search(r"testDuration=([\d\.]+)", clean)
    rate = re.search(r"finalRateLimit=([\d\.]+)", clean)

    lat_max = re.search(r"max=([\d\.]+)", clean)
    lat_mean = re.search(r"mean=([\d\.]+)", clean)
    lat_med = re.search(r"median=([\d\.]+)", clean)
    lat_min = re.search(r"min=([\d\.]+)", clean)
    lat_std = re.search(r"stddev=([\d\.]+)", clean)

    data = {
        "model": model,
        "workload": workload,
        "samples": int(samples.group(1)) if samples else 0,
        "successful_tps": round(float(tps.group(1)), 2) if tps else 0.0,
        "total_rps": round(float(rps.group(1)), 2) if rps else 0.0,
        "errors": int(errors.group(1)) if errors else 0,
        "test_duration_s": round(float(duration.group(1)), 2) if duration else 0.0,
        "rate_limit": round(float(rate.group(1)), 0) if rate else 0.0,
        "latency_ms": {
            "mean": round(float(lat_mean.group(1)) * 1000, 2) if lat_mean else 0.0,
            "median": round(float(lat_med.group(1)) * 1000, 2) if lat_med else 0.0,
            "min": round(float(lat_min.group(1)) * 1000, 2) if lat_min else 0.0,
            "max": round(float(lat_max.group(1)) * 1000, 2) if lat_max else 0.0,
            "stddev": round(float(lat_std.group(1)) * 1000, 2) if lat_std else 0.0,
        },
        "timeline": {
            "started_at": start_time.group(1) if start_time else "N/A",
            "load_stopped_at": load_stop.group(1) if load_stop else "N/A",
            "finished_at": end_time.group(1) if end_time else "N/A",
        }
    }

    # Beautifully aligned plain text summary
    txt_content = f"""============================================================
BENCHMARK SUMMARY: {model} / {workload}
============================================================
Total Samples:       {data['samples']:,} requests
Successful TPS:      {data['successful_tps']:.2f} tx/s
Total RPS:           {data['total_rps']:.2f} req/s
Total Errors:        {data['errors']}
Test Duration:       {data['test_duration_s']:.2f} s
Target Rate Limit:   {data['rate_limit']:.0f} req/s

--- Latency (Execution) ---
Mean Latency:        {data['latency_ms']['mean']:.2f} ms
Median Latency:      {data['latency_ms']['median']:.2f} ms
Min Latency:         {data['latency_ms']['min']:.2f} ms
Max Latency:         {data['latency_ms']['max']:.2f} ms
StdDev:              {data['latency_ms']['stddev']:.2f} ms

--- Timeline ---
Started At:          {data['timeline']['started_at']}
Load Stopped At:     {data['timeline']['load_stopped_at']}
Finished At:         {data['timeline']['finished_at']}
============================================================
"""

    with open(out_txt, "w", encoding="utf-8") as f:
        f.write(txt_content)

    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    # Clean up raw temp file
    if os.path.exists(raw_file):
        try:
            os.remove(raw_file)
        except OSError:
            pass

if __name__ == "__main__":
    if len(sys.argv) > 1:
        rdir = sys.argv[1]
        m = sys.argv[2] if len(sys.argv) > 2 else "Unknown"
        w = sys.argv[3] if len(sys.argv) > 3 else "Unknown"
        format_summary(rdir, m, w)
