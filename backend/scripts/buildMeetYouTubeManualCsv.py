#!/usr/bin/env python3
"""Build manual YouTube upload CSVs from ready-list + VM upload state (no network)."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
READY = ROOT / "prod-meet-drive-ready-for-youtube.csv"
STATE = ROOT / "prod-meet-youtube-upload-state.json"
OUT_ALL = ROOT / "prod-meet-youtube-manual-upload.csv"
OUT_PENDING = ROOT / "prod-meet-youtube-manual-pending.csv"

FIELDS = [
    "liveClassId",
    "title",
    "suggestedYouTubeTitle",
    "status",
    "batchName",
    "teacherName",
    "scheduledStartIST",
    "classroomLectureId",
    "driveFileId",
    "driveLink",
    "driveOpenHint",
    "youtubeVideoId",
    "youtubeVideoUrl",
    "youtubeStatus",
    "notes",
]


def main():
    state = json.loads(STATE.read_text())
    ok = {
        k: v
        for k, v in (state.get("results") or {}).items()
        if isinstance(v, dict) and v.get("status") == "ok" and v.get("youtubeVideoId")
    }

    with READY.open(newline="", encoding="utf-8") as f:
        ready_rows = list(csv.DictReader(f))

    all_rows = []
    for r in ready_rows:
        lid = (r.get("liveClassId") or "").strip()
        drive_id = (r.get("driveFileId") or "").strip()
        title = (r.get("title") or "").strip()
        batch = (r.get("batchName") or "").strip()
        teacher = (r.get("teacherName") or "").strip()
        suggested = " · ".join(x for x in [title, batch, teacher] if x)[:100]
        drive_link = (
            (r.get("driveLink") or "").strip()
            or (f"https://drive.google.com/file/d/{drive_id}/view" if drive_id else "")
        )
        hit = ok.get(lid)
        # Prefer LMS columns already on ready CSV if ever filled
        yt_id = (r.get("youtubeVideoId") or "").strip() or (hit or {}).get("youtubeVideoId", "")
        yt_url = (r.get("youtubeVideoUrl") or "").strip() or (hit or {}).get(
            "youtubeVideoUrl", ""
        )
        if yt_id and not yt_url:
            yt_url = f"https://www.youtube.com/watch?v={yt_id}"

        done = bool(yt_id)
        all_rows.append(
            {
                "liveClassId": lid,
                "title": title,
                "suggestedYouTubeTitle": suggested,
                "status": r.get("status") or "",
                "batchName": batch,
                "teacherName": teacher,
                "scheduledStartIST": r.get("scheduledStartIST") or "",
                "classroomLectureId": r.get("classroomLectureId") or "",
                "driveFileId": drive_id,
                "driveLink": drive_link,
                "driveOpenHint": "Download MP4 from Drive → Upload unlisted on YouTube Studio",
                "youtubeVideoId": yt_id if done else "",
                "youtubeVideoUrl": yt_url if done else "",
                "youtubeStatus": "done" if done else "pending_manual_upload",
                "notes": (
                    "Already linked via VM upload / LMS"
                    if done
                    else "Fill youtubeVideoId after upload (or paste watch URL in youtubeVideoUrl)"
                ),
            }
        )

    pending = [x for x in all_rows if x["youtubeStatus"] == "pending_manual_upload"]

    for path, rows in ((OUT_ALL, all_rows), (OUT_PENDING, pending)):
        with path.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=FIELDS)
            w.writeheader()
            w.writerows(rows)

    print(
        json.dumps(
            {
                "totalWithDrive": len(all_rows),
                "alreadyOnYouTube": len(all_rows) - len(pending),
                "pendingManual": len(pending),
                "allCsv": str(OUT_ALL),
                "pendingCsv": str(OUT_PENDING),
                "applyCommand": (
                    "cd /root/Shef-LMS/backend && ENV_PATH=.env "
                    "node scripts/applyMeetYouTubeFromCsv.js "
                    "--file=scripts/prod-meet-youtube-manual-pending.csv"
                ),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
