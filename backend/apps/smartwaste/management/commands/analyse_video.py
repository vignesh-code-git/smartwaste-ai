import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):

    help = (
        "Analyse a video with the SmartWaste detector and write the "
        "result as JSON, in the format the frontend player loads. Used "
        "to pre-compute the demo footage so it opens without a scan."
    )


    def add_arguments(self, parser):

        parser.add_argument("video", type=Path)

        parser.add_argument("output", type=Path)

        parser.add_argument(
            "--step",
            type=float,
            default=0.2,
            help="Seconds between analysed frames (default 0.2).",
        )


    def handle(self, *args, **options):

        # Imported here so other commands do not load the model
        from apps.smartwaste.detection import analyse_video

        video = options["video"]

        if not video.exists():
            raise CommandError(f"Video not found: {video}")


        def progress(done, total):
            self.stdout.write(f"\rAnalysed {done}/{total} frames", ending="")
            self.stdout.flush()


        analysis = analyse_video(
            video,
            step=options["step"],
            on_progress=progress,
        )

        options["output"].write_text(
            json.dumps(analysis, separators=(",", ":"))
        )

        found = sum(len(sample["detections"]) for sample in analysis["samples"])

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Wrote {len(analysis['samples'])} frames with {found} "
            f"detections to {options['output']}"
        ))
